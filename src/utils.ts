// Utility functions to reduce code duplication

import { Player, Item, Enemy, NPC, Location, Config } from './types';
import { gameState } from './game';

/**
 * Get the current location object for a player
 * @param player - The player whose location to retrieve
 * @returns The location object, or null if location not found
 */
export function getLocation(player: Player): Location | null {
  return gameState.gameData.locations.get(player.location) || null;
}

/**
 * Get the global game configuration
 * @returns The game configuration object
 */
export function getConfig(): Config {
  return gameState.gameData.config;
}

/**
 * Find an item in the player's inventory using fuzzy matching
 * Searches by exact name, partial name, or item ID (case-insensitive)
 * @param player - The player whose inventory to search
 * @param name - The item name or ID to search for
 * @returns The matching item, or null if not found
 */
export function findInInventory(player: Player, name: string): Item | null {
  const lower = name.toLowerCase();
  
  // Exact match
  let item = player.inventory.find(i => i.name.toLowerCase() === lower);
  if (item) return item;
  
  // Partial match
  item = player.inventory.find(i => i.name.toLowerCase().includes(lower));
  if (item) return item;
  
  // ID match
  item = player.inventory.find(i => i.id === lower);
  return item || null;
}

/**
 * Find an item on the ground in a location using fuzzy matching
 * Searches by exact name, partial name, or item ID (case-insensitive)
 * @param location - The location to search
 * @param name - The item name or ID to search for
 * @returns The matching item, or null if not found
 */
export function findInLocation(location: Location, name: string): Item | null {
  if (!location.items) return null;
  
  const lower = name.toLowerCase();
  
  // Exact match
  let item = location.items.find(i => i.name.toLowerCase() === lower);
  if (item) return item;
  
  // Partial match
  item = location.items.find(i => i.name.toLowerCase().includes(lower));
  if (item) return item;
  
  // ID match
  item = location.items.find(i => i.id === lower);
  return item || null;
}

/**
 * Find an enemy in a location using fuzzy matching
 * Searches by exact name, partial name, or enemy ID (case-insensitive)
 * @param location - The location to search
 * @param name - The enemy name or ID to search for
 * @returns The matching enemy, or null if not found
 */
export function findEnemy(location: Location, name: string): Enemy | null {
  if (!location.enemies) return null;
  
  const lower = name.toLowerCase();
  
  // Exact match
  let enemy = location.enemies.find(e => e.name.toLowerCase() === lower);
  if (enemy) return enemy;
  
  // Partial match
  enemy = location.enemies.find(e => e.name.toLowerCase().includes(lower));
  if (enemy) return enemy;
  
  // ID match
  enemy = location.enemies.find(e => e.id === lower);
  return enemy || null;
}

/**
 * Find an NPC in a location using fuzzy matching
 * Searches by exact name, partial name, or NPC ID (case-insensitive)
 * @param location - The location to search
 * @param name - The NPC name or ID to search for
 * @returns The matching NPC, or null if not found
 */
export function findNpc(location: Location, name: string): NPC | null {
  if (!location.npcs) return null;
  
  const lower = name.toLowerCase();
  
  // Exact match
  let npc = location.npcs.find(n => n.name.toLowerCase() === lower);
  if (npc) return npc;
  
  // Partial match
  npc = location.npcs.find(n => n.name.toLowerCase().includes(lower));
  if (npc) return npc;
  
  // ID match
  npc = location.npcs.find(n => n.id === lower);
  return npc || null;
}

/**
 * Calculate total player stats including equipment bonuses
 * Sums base stats with bonuses from all equipped items (weapon, armor, shield, accessory)
 * @param player - The player to calculate stats for
 * @returns Object containing total stats and equipment bonus breakdown
 */
export function calculateStats(player: Player) {
  const eq = player.equipped;
  
  const equipmentDamage = 
    (eq.weapon?.damage || 0) + (eq.armor?.damage || 0) +
    (eq.shield?.damage || 0) + (eq.accessory?.damage || 0);
  
  const equipmentDefense = 
    (eq.weapon?.defense || 0) + (eq.armor?.defense || 0) +
    (eq.shield?.defense || 0) + (eq.accessory?.defense || 0);
  
  const equipmentHealth = 
    (eq.weapon?.health || 0) + (eq.armor?.health || 0) +
    (eq.shield?.health || 0) + (eq.accessory?.health || 0);
  
  const equipmentMana = 
    (eq.weapon?.mana || 0) + (eq.armor?.mana || 0) +
    (eq.shield?.mana || 0) + (eq.accessory?.mana || 0);
  
  return {
    damage: player.damage + equipmentDamage,
    defense: player.defense + equipmentDefense,
    maxHealth: player.maxHealth + equipmentHealth,
    maxMana: player.maxMana + equipmentMana,
    equipmentDamage,
    equipmentDefense,
    equipmentHealth,
    equipmentMana
  };
}

/**
 * Remove a specific item from the player's inventory
 * Only removes the first occurrence if there are duplicates
 * @param player - The player whose inventory to modify
 * @param item - The exact item instance to remove
 */
export function removeFromInventory(player: Player, item: Item): void {
  const index = player.inventory.indexOf(item);
  if (index !== -1) {
    player.inventory.splice(index, 1);
  }
}

/**
 * Check if player has space in their inventory
 * @param player - The player to check
 * @returns true if player has available inventory slots, false otherwise
 */
export function hasInventorySpace(player: Player): boolean {
  const maxSlots = getConfig().gameplay.maxInventorySlots;
  return player.inventory.length < maxSlots;
}

/**
 * Format equipped items as a display string
 * Used by inventory and equipment commands for consistent formatting
 * @param player - The player whose equipment to format
 * @returns Formatted equipment list, or empty string if nothing equipped
 */
export function formatEquipmentList(player: Player): string {
  const equipped = [
    player.equipped.weapon && `  - ${player.equipped.weapon.name} (weapon)`,
    player.equipped.armor && `  - ${player.equipped.armor.name} (armor)`,
    player.equipped.shield && `  - ${player.equipped.shield.name} (shield)`,
    player.equipped.accessory && `  - ${player.equipped.accessory.name} (accessory)`
  ].filter(Boolean);
  
  return equipped.length > 0 ? equipped.join('\n') + '\n' : '';
}

/**
 * Generate a visual map centered on the player's current location
 * Shows locations up to 5 steps away with connections (ignores up/down)
 * @param player - The player whose map to generate
 * @returns ASCII art map string
 */
export function generateMap(player: Player): string {
  const currentLoc = getLocation(player);
  if (!currentLoc) return 'You are nowhere!';
  
  // Build graph of reachable locations (BFS to depth 2, excluding up/down)
  const visited = new Map<string, { loc: Location; depth: number; x: number; y: number }>();
  const queue: Array<{ id: string; depth: number; x: number; y: number }> = [
    { id: currentLoc.id, depth: 0, x: 0, y: 0 }
  ];
  
  // Direction to coordinate offset (ignoring up/down)
  const dirToOffset: { [key: string]: { dx: number; dy: number } } = {
    north: { dx: 0, dy: -1 },
    south: { dx: 0, dy: 1 },
    east: { dx: 1, dy: 0 },
    west: { dx: -1, dy: 0 }
  };
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.id) || current.depth > 2) continue;
    
    const loc = gameState.gameData.locations.get(current.id);
    if (!loc) continue;
    
    visited.set(current.id, { loc, depth: current.depth, x: current.x, y: current.y });
    
    // Explore neighbors
    for (const [direction, targetId] of Object.entries(loc.exits)) {
      if (direction === 'up' || direction === 'down') continue; // Ignore vertical
      
      const offset = dirToOffset[direction];
      if (offset && !visited.has(targetId)) {
        queue.push({
          id: targetId,
          depth: current.depth + 1,
          x: current.x + offset.dx,
          y: current.y + offset.dy
        });
      }
    }
  }
  
  // Find grid bounds
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const { x, y } of visited.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  
  // Build grid (each location cell is 17 chars wide, 3 rows tall)
  const CELL_WIDTH = 17;
  const CELL_HEIGHT = 3;
  const gridWidth = (maxX - minX + 1) * CELL_WIDTH;
  const gridHeight = (maxY - minY + 1) * CELL_HEIGHT;
  const grid: string[][] = Array.from({ length: gridHeight }, () => 
    Array(gridWidth).fill(' ')
  );
  
  // Helper to write string to grid safely
  const writeToGrid = (row: number, col: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      if (row >= 0 && row < gridHeight && col + i >= 0 && col + i < gridWidth) {
        grid[row][col + i] = text[i];
      }
    }
  };
  
  // Place locations and connections
  for (const [locId, { loc, x, y }] of visited.entries()) {
    const cellX = (x - minX) * CELL_WIDTH;
    const cellY = (y - minY) * CELL_HEIGHT;
    const centerRow = cellY + 1; // Middle row of the cell
    
    // Format location name (max 11 chars inside brackets = 13 total)
    const isCurrent = locId === currentLoc.id;
    let displayName = loc.name;
    
    // Truncate if needed
    if (isCurrent && displayName.length > 9) {
      displayName = displayName.substring(0, 9);
    } else if (!isCurrent && displayName.length > 11) {
      displayName = displayName.substring(0, 11);
    }
    
    // Add current location markers
    if (isCurrent) {
      displayName = `*${displayName}*`;
    }
    
    // Pad to 11 chars (or 11 for current with asterisks)
    const paddedName = displayName.padEnd(11, ' ');
    const locationText = `[${paddedName}]`;
    
    // Write location name centered in cell
    writeToGrid(centerRow, cellX, locationText);
    
    // Draw east connection (after the location name)
    if (loc.exits.east && visited.has(loc.exits.east)) {
      writeToGrid(centerRow, cellX + 13, ' -- ');
    }
    
    // Draw south connection (below the location)
    if (loc.exits.south && visited.has(loc.exits.south)) {
      writeToGrid(centerRow + 1, cellX + 6, '|');
    }
  }
  
  // Convert grid to string, trim trailing whitespace, and remove empty lines
  const lines = grid
    .map(row => row.join('').trimEnd())
    .filter(line => line.trim().length > 0);
  
  return '\n' + lines.join('\n') + '\n';
}
