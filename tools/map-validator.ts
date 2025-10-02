#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Location } from '../src/types';

interface Coord {
  x: number;
  y: number;
  z: number;
}

// Load locations from JSON
function loadLocations(): Map<string, Location> {
  const locationsPath = path.join(__dirname, '../data/locations.json');
  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf-8')) as Location[];
  const locations = new Map<string, Location>();
  
  locationsData.forEach(loc => {
    locations.set(loc.id, loc);
  });
  
  return locations;
}

// Validate map connections with grid consistency
function validateMapConnections(locations: Map<string, Location>, originId: string): { 
  valid: boolean; 
  errors: string[]; 
  coords: Map<string, Coord> 
} {
  const errors: string[] = [];
  
  // Opposite directions mapping
  const opposites: Record<string, string> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
    northeast: 'southwest',
    southwest: 'northeast',
    northwest: 'southeast',
    southeast: 'northwest',
    up: 'down',
    down: 'up'
  };
  
  // Direction vectors for grid consistency
  const vectors: Record<string, Coord> = {
    north: { x: 0, y: 1, z: 0 },
    south: { x: 0, y: -1, z: 0 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 },
    northeast: { x: 1, y: 1, z: 0 },
    northwest: { x: -1, y: 1, z: 0 },
    southeast: { x: 1, y: -1, z: 0 },
    southwest: { x: -1, y: -1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    down: { x: 0, y: 0, z: -1 }
  };
  
  // Build coordinate grid using BFS from origin
  const coords = new Map<string, Coord>();
  
  if (!locations.has(originId)) {
    errors.push(`Origin location '${originId}' does not exist!`);
    return { valid: false, errors, coords };
  }
  
  coords.set(originId, { x: 0, y: 0, z: 0 });
  const queue: string[] = [originId];
  const visited = new Set<string>([originId]);
  
  while (queue.length > 0) {
    const locId = queue.shift()!;
    const location = locations.get(locId)!;
    const currentCoord = coords.get(locId)!;
    
    // Process each exit
    for (const [direction, targetId] of Object.entries(location.exits)) {
      const targetLoc = locations.get(targetId);
      
      // Check if target location exists
      if (!targetLoc) {
        errors.push(`${location.name} (${locId}): exit '${direction}' points to non-existent location '${targetId}'`);
        continue;
      }
      
      // Check if direction is valid
      const vector = vectors[direction];
      if (!vector) {
        errors.push(`${location.name} (${locId}): invalid direction '${direction}'`);
        continue;
      }
      
      // Calculate expected coordinates for target
      const expectedCoord: Coord = {
        x: currentCoord.x + vector.x,
        y: currentCoord.y + vector.y,
        z: currentCoord.z + vector.z
      };
      
      // Check if target already has coordinates assigned
      const existingCoord = coords.get(targetId);
      if (existingCoord) {
        // Verify grid consistency
        if (existingCoord.x !== expectedCoord.x || 
            existingCoord.y !== expectedCoord.y || 
            existingCoord.z !== expectedCoord.z) {
          errors.push(
            `Grid inconsistency: ${location.name} (${currentCoord.x},${currentCoord.y},${currentCoord.z}) --[${direction}]--> ` +
            `${targetLoc.name} should be at (${expectedCoord.x},${expectedCoord.y},${expectedCoord.z}) ` +
            `but was already placed at (${existingCoord.x},${existingCoord.y},${existingCoord.z})`
          );
        }
      } else {
        // Assign coordinates and add to queue
        coords.set(targetId, expectedCoord);
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
      
      // Check reverse direction consistency
      const reverseDir = opposites[direction];
      if (targetLoc.exits[reverseDir]) {
        if (targetLoc.exits[reverseDir] !== locId) {
          errors.push(
            `Connection mismatch: ${location.name} --[${direction}]--> ${targetLoc.name}, ` +
            `but ${targetLoc.name} --[${reverseDir}]--> ${locations.get(targetLoc.exits[reverseDir])?.name || 'unknown'} ` +
            `(should point back to ${location.name})`
          );
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    coords
  };
}

// Fix map connections based on grid layout
function fixMapConnections(
  locations: Map<string, Location>, 
  coords: Map<string, Coord>
): void {
  const vectors: Record<string, Coord> = {
    north: { x: 0, y: 1, z: 0 },
    south: { x: 0, y: -1, z: 0 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 },
    northeast: { x: 1, y: 1, z: 0 },
    northwest: { x: -1, y: 1, z: 0 },
    southeast: { x: 1, y: -1, z: 0 },
    southwest: { x: -1, y: -1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    down: { x: 0, y: 0, z: -1 }
  };
  
  // Build reverse lookup: coord -> locationId
  const coordToLoc = new Map<string, string>();
  coords.forEach((coord, locId) => {
    const key = `${coord.x},${coord.y},${coord.z}`;
    coordToLoc.set(key, locId);
  });
  
  console.log('\nFixing map connections based on grid layout...');
  let fixCount = 0;
  
  // For each location, ensure all valid grid connections exist
  coords.forEach((coord, locId) => {
    const location = locations.get(locId)!;
    
    // Check each possible direction
    Object.entries(vectors).forEach(([direction, vector]) => {
      const targetCoord: Coord = {
        x: coord.x + vector.x,
        y: coord.y + vector.y,
        z: coord.z + vector.z
      };
      const targetKey = `${targetCoord.x},${targetCoord.y},${targetCoord.z}`;
      const targetId = coordToLoc.get(targetKey);
      
      if (targetId) {
        // There's a location at this grid position
        const currentExit = location.exits[direction];
        
        if (currentExit !== targetId) {
          if (currentExit) {
            console.log(`  Fixing: ${location.name} [${direction}] ${locations.get(currentExit)?.name} -> ${locations.get(targetId)?.name}`);
          } else {
            console.log(`  Adding: ${location.name} [${direction}] -> ${locations.get(targetId)?.name}`);
          }
          location.exits[direction] = targetId;
          fixCount++;
        }
      } else {
        // No location at this grid position - remove invalid exit if it exists
        if (location.exits[direction]) {
          const oldTarget = locations.get(location.exits[direction]);
          console.log(`  Removing invalid: ${location.name} [${direction}] -> ${oldTarget?.name}`);
          delete location.exits[direction];
          fixCount++;
        }
      }
    });
  });
  
  console.log(`\nFixed ${fixCount} connection(s).`);
  
  // Save updated locations to file
  const locationsArray = Array.from(locations.values());
  const locationsPath = path.join(__dirname, '../data/locations.json');
  fs.writeFileSync(locationsPath, JSON.stringify(locationsArray, null, 2));
  console.log('Saved updated locations to data/locations.json');
}

// Prompt user for input
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// Main function
async function main() {
  console.log('=== Mudden Map Validator ===\n');
  
  // Get origin location from command line argument or default
  const originId = process.argv[2] || 'town_square';
  
  console.log(`Loading locations...`);
  const locations = loadLocations();
  console.log(`Loaded ${locations.size} location(s)\n`);
  
  console.log(`Validating map grid with origin: ${originId}`);
  const validation = validateMapConnections(locations, originId);
  
  if (validation.valid) {
    console.log('\n✓ Map validation passed! All connections form a valid grid.');
    
    // Show visual grid
    visualizeGrid(locations, validation.coords, originId);
  } else {
    console.log('\n✗ Map validation failed:\n');
    validation.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
    
    console.log('\n');
    const answer = await promptUser('Do you want to auto-fix these issues? (yes/no): ');
    
    if (answer === 'yes' || answer === 'y') {
      fixMapConnections(locations, validation.coords);
      console.log('\n✓ Map has been fixed! Run the validator again to verify.');
    } else {
      console.log('\nNo changes made.');
    }
  }
}

// Visualize grid as ASCII map
function visualizeGrid(
  locations: Map<string, Location>,
  coords: Map<string, Coord>,
  originId: string
): void {
  if (coords.size === 0) return;
  
  // Find bounds
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  coords.forEach(coord => {
    minX = Math.min(minX, coord.x);
    maxX = Math.max(maxX, coord.x);
    minY = Math.min(minY, coord.y);
    maxY = Math.max(maxY, coord.y);
  });
  
  // Build reverse lookup: coord -> locationId and assign unique letters
  const coordToLoc = new Map<string, string>();
  const locToLetter = new Map<string, string>();
  const usedLetters = new Set<string>();
  
  coords.forEach((coord, locId) => {
    if (coord.z === 0) { // Only show z=0 level
      const key = `${coord.x},${coord.y}`;
      coordToLoc.set(key, locId);
      
      if (locId !== originId) {
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
    }
  });
  
  console.log('\nGrid visualization (z=0):');
  console.log('(Origin location marked with [ ])');
  console.log();
  
  // Draw grid with connections - each cell is 4 chars wide, 2 rows high
  for (let y = maxY; y >= minY; y--) {
    // Row 1: Location boxes with horizontal connections
    let row1 = '';
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`;
      const locId = coordToLoc.get(key);
      
      if (locId) {
        const location = locations.get(locId)!;
        const letter = locId === originId ? ' ' : locToLetter.get(locId) || '?';
        
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
    
    // Row 2: Vertical and diagonal connections
    if (y > minY) {
      let row2 = '';
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const locId = coordToLoc.get(key);
        
        if (locId) {
          const location = locations.get(locId)!;
          let connChar = ' ';
          
          // Check for connections going down
          const southKey = `${x},${y - 1}`;
          const swKey = `${x - 1},${y - 1}`;
          const seKey = `${x + 1},${y - 1}`;
          
          const hasSouth = location.exits.south && coordToLoc.get(southKey) === location.exits.south;
          const hasSW = location.exits.southwest && coordToLoc.get(swKey) === location.exits.southwest;
          const hasSE = location.exits.southeast && coordToLoc.get(seKey) === location.exits.southeast;
          
          if (hasSouth) {
            connChar = '|';
          } else if (hasSW && hasSE) {
            connChar = 'X';
          } else if (hasSW) {
            connChar = '/';  // SW goes down-left: /
          } else if (hasSE) {
            connChar = '\\'; // SE goes down-right: \
          }
          
          row2 += connChar === '|' ? ' | ' : (connChar === 'X' ? '/|\\' : (connChar === '/' ? ' / ' : (connChar === '\\' ? ' \\ ' : '   ')));
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
    const letter = locId === originId ? ' ' : locToLetter.get(locId) || '?';
    console.log(`  [${letter}] (${coord.x},${coord.y}) ${location.name}`);
  });
  
  // Show other z-levels if any
  const otherLevels = Array.from(coords.entries())
    .filter(([_, coord]) => coord.z !== 0);
  
  if (otherLevels.length > 0) {
    console.log('\nOther levels:');
    otherLevels.forEach(([locId, coord]) => {
      const location = locations.get(locId)!;
      console.log(`  (${coord.x},${coord.y},${coord.z}) ${location.name}`);
    });
  }
}

main().catch(console.error);
