#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface RawLocation {
  id: string;
  name: string;
  description: string;
  exits: { [direction: string]: string };
  npcs?: string[];
  enemies?: string[];
  items?: string[];
}

interface Config {
  newPlayer: {
    startingLocation: string;
  };
}

interface Coord {
  x: number;
  y: number;
  z: number;
}

const OPPOSITE_DIRECTIONS: { [key: string]: string } = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up'
};

const DIRECTION_VECTORS: { [key: string]: Coord } = {
  north: { x: 0, y: 1, z: 0 },
  south: { x: 0, y: -1, z: 0 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  down: { x: 0, y: 0, z: -1 }
};

// Helper to load config
function loadConfig(): Config {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as Config;
}

// Helper to load all locations from the locations folder
function loadLocations(): Map<string, RawLocation> {
  const locations = new Map<string, RawLocation>();
  const locationsDir = path.join(__dirname, '..', 'data', 'locations');
  
  if (!fs.existsSync(locationsDir)) {
    throw new Error(`Locations directory not found: ${locationsDir}`);
  }

  const files = fs.readdirSync(locationsDir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(locationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const location = JSON.parse(content) as RawLocation;
    
    locations.set(location.id, location);
  }

  return locations;
}

function validateMap(locations: Map<string, RawLocation>, originId: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const coords = new Map<string, Coord>();
  const visited = new Set<string>();

  // Get origin location name for display
  const originLocation = locations.get(originId);
  if (!originLocation) {
    console.error(`❌ Origin location "${originId}" not found!`);
    process.exit(1);
  }

  // Start BFS from origin
  const queue: Array<{ id: string; x: number; y: number; z: number }> = [
    { id: originId, x: 0, y: 0, z: 0 }
  ];

  visited.add(originId);
  coords.set(originId, { x: 0, y: 0, z: 0 });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const location = locations.get(current.id);
    
    if (!location) continue;

    for (const [direction, targetId] of Object.entries(location.exits)) {
      const targetLocation = locations.get(targetId);
      
      // Check if target location exists
      if (!targetLocation) {
        errors.push(`${location.name} (${current.id}): exit '${direction}' points to non-existent location '${targetId}'`);
        continue;
      }

      // Check if direction is valid
      const vector = DIRECTION_VECTORS[direction];
      if (!vector) {
        errors.push(`${location.name} (${current.id}): invalid direction '${direction}'`);
        continue;
      }

      // Calculate expected coordinates for target
      const expectedCoord: Coord = {
        x: current.x + vector.x,
        y: current.y + vector.y,
        z: current.z + vector.z
      };

      // Check if target already has coordinates assigned
      const existingCoord = coords.get(targetId);
      if (existingCoord) {
        // Verify grid consistency
        if (existingCoord.x !== expectedCoord.x || 
            existingCoord.y !== expectedCoord.y || 
            existingCoord.z !== expectedCoord.z) {
          errors.push(
            `Grid inconsistency: ${location.name} (${current.x},${current.y},${current.z}) --[${direction}]--> ` +
            `${targetLocation.name} should be at (${expectedCoord.x},${expectedCoord.y},${expectedCoord.z}) ` +
            `but was already placed at (${existingCoord.x},${existingCoord.y},${existingCoord.z})`
          );
        }
      } else {
        // Assign coordinates and add to queue
        coords.set(targetId, expectedCoord);
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push({ id: targetId, ...expectedCoord });
        }
      }

      // Check reverse direction (bidirectional validation)
      const oppositeDir = OPPOSITE_DIRECTIONS[direction];
      if (oppositeDir && targetLocation.exits[oppositeDir]) {
        if (targetLocation.exits[oppositeDir] !== current.id) {
          errors.push(
            `Connection mismatch: ${location.name} --[${direction}]--> ${targetLocation.name}, ` +
            `but ${targetLocation.name} --[${oppositeDir}]--> ${locations.get(targetLocation.exits[oppositeDir])?.name || 'unknown'} ` +
            `(should point back to ${location.name})`
          );
        }
      }
    }
  }

  // Check for orphaned locations (not reachable from origin)
  const reachableLocations = new Set(coords.keys());
  const orphanedLocations: string[] = [];

  locations.forEach((location, locationId) => {
    if (!reachableLocations.has(locationId)) {
      orphanedLocations.push(locationId);
    }
  });

  if (orphanedLocations.length > 0) {
    console.log(`\n⚠️  WARNING: Found orphaned locations (not connected to the map):`);
    orphanedLocations.forEach(id => {
      const location = locations.get(id)!;
      const exitCount = Object.keys(location.exits || {}).length;
      console.log(`  - ${location.name} (${id}) - has ${exitCount} exit(s) but is unreachable from origin`);
      if (exitCount > 0) {
        console.log(`    Exits: ${Object.entries(location.exits).map(([dir, dest]) => `${dir}→${dest}`).join(', ')}`);
      }
    });
    console.log(`\n  These locations exist but cannot be reached from the starting point!`);
  }

  return { 
    errors, 
    warnings, 
    coords,
    totalLocations: locations.size,
    reachableLocations: reachableLocations.size,
    orphanedLocations: orphanedLocations.length,
    originName: originLocation.name
  };
}

function visualizeMap(coords: Map<string, Coord>, locations: Map<string, RawLocation>): void {
  if (coords.size === 0) return;
  
  // Find bounds for z=0 level
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  coords.forEach(coord => {
    if (coord.z === 0) {
      minX = Math.min(minX, coord.x);
      maxX = Math.max(maxX, coord.x);
      minY = Math.min(minY, coord.y);
      maxY = Math.max(maxY, coord.y);
    }
  });
  
  // Build reverse lookup: coord -> locationId
  const coordToLoc = new Map<string, string>();
  const locToLetter = new Map<string, string>();
  const usedLetters = new Set<string>();
  
  coords.forEach((coord, locId) => {
    if (coord.z === 0) {
      const key = `${coord.x},${coord.y}`;
      coordToLoc.set(key, locId);
      
      const location = locations.get(locId)!;
      const name = location.name;
      
      // Try to find a unique letter
      let letter = '';
      
      // First try first letter of each word (capitalized)
      const words = name.split(/[\s-]+/);
      for (const word of words) {
        const candidate = word.charAt(0).toUpperCase();
        if (!usedLetters.has(candidate)) {
          letter = candidate;
          break;
        }
      }
      
      // If still no unique letter, try other letters in name
      if (!letter) {
        for (const char of name.toUpperCase()) {
          if (/[A-Z]/.test(char) && !usedLetters.has(char)) {
            letter = char;
            break;
          }
        }
      }
      
      // Last resort: use a number
      if (!letter) {
        let num = 1;
        while (usedLetters.has(num.toString())) num++;
        letter = num.toString();
      }
      
      usedLetters.add(letter);
      locToLetter.set(locId, letter);
    }
  });
  
  console.log('\nGrid visualization (z=0):');
  console.log();
  
  // Draw grid with connections
  for (let y = maxY; y >= minY; y--) {
    // Row 1: Location boxes with horizontal connections
    let row1 = '';
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`;
      const locId = coordToLoc.get(key);
      
      if (locId) {
        const location = locations.get(locId)!;
        const letter = locToLetter.get(locId) || '?';
        
        // Check for east connection
        const eastKey = `${x + 1},${y}`;
        const hasEast = location.exits.east && coordToLoc.get(eastKey) === location.exits.east;
        
        row1 += `[${letter}]`;
        row1 += hasEast ? '-' : ' ';
      } else {
        row1 += '    ';
      }
    }
    console.log(row1);
    
    // Row 2: Vertical connections
    if (y > minY) {
      let row2 = '';
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const locId = coordToLoc.get(key);
        
        if (locId) {
          const location = locations.get(locId)!;
          
          // Check for south connection
          const southKey = `${x},${y - 1}`;
          const hasSouth = location.exits.south && coordToLoc.get(southKey) === location.exits.south;
          
          row2 += hasSouth ? ' | ' : '   ';
          row2 += ' ';
        } else {
          row2 += '    ';
        }
      }
      console.log(row2);
    }
  }
  
  // Show legend
  console.log('\nLegend:');
  const sortedCoords = Array.from(coords.entries())
    .filter(([_, coord]) => coord.z === 0)
    .sort((a, b) => {
      if (a[1].y !== b[1].y) return b[1].y - a[1].y;
      return a[1].x - b[1].x;
    });
  
  sortedCoords.forEach(([locId, coord]) => {
    const location = locations.get(locId)!;
    const letter = locToLetter.get(locId) || '?';
    console.log(`  [${letter}] ${location.name}`);
  });
  
  // Show other z-levels if any
  const otherLevels = Array.from(coords.entries())
    .filter(([_, coord]) => coord.z !== 0);
  
  if (otherLevels.length > 0) {
    console.log('\nOther levels:');
    otherLevels.forEach(([locId, coord]) => {
      const location = locations.get(locId)!;
      console.log(`  ${location.name} (z=${coord.z})`);
    });
  }
}

// Main execution
try {
  const locations = loadLocations();
  const config = loadConfig();
  
  // Get origin from command line args, default to config setting
  const originId = process.argv[2] || config.newPlayer.startingLocation;
  
  const validation = validateMap(locations, originId);
  
  if (validation.errors.length > 0) {
    console.log('\n❌ Map validation failed:\n');
    validation.errors.forEach((error: string) => console.log(`  - ${error}`));
    process.exit(1);
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');
    validation.warnings.forEach((warning: string) => console.log(`  - ${warning}`));
  }
  
  console.log('\n✓ Map validation passed! All connections form a valid grid.\n');
  
  visualizeMap(validation.coords, locations);
  
  // Summary
  console.log(`\nMap Summary:`);
  console.log(`  Origin: ${validation.originName} (${originId})`);
  console.log(`  Total locations: ${validation.totalLocations}`);
  console.log(`  Reachable from origin: ${validation.reachableLocations}`);
  if (validation.orphanedLocations > 0) {
    console.log(`  Orphaned locations: ${validation.orphanedLocations} ⚠️`);
  }
  
} catch (error) {
  console.error('Error during validation:', error);
  process.exit(1);
}
