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
