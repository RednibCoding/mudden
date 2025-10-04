// Utility functions to reduce code duplication

import { Player, Item, Enemy, NPC, Location, Config } from './types';
import { gameState } from './game';

// Get current location for a player
export function getLocation(player: Player): Location | null {
  return gameState.gameData.locations.get(player.location) || null;
}

// Get game config
export function getConfig(): Config {
  return gameState.gameData.config;
}

// Find item in player's inventory (fuzzy matching)
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

// Find item in location (on ground)
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

// Find enemy in location (fuzzy matching)
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

// Find NPC in location (fuzzy matching)
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

// Calculate total player stats (base + equipment bonuses)
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

// Remove item from player's inventory
export function removeFromInventory(player: Player, item: Item): void {
  const index = player.inventory.indexOf(item);
  if (index !== -1) {
    player.inventory.splice(index, 1);
  }
}

// Check if player has inventory space
export function hasInventorySpace(player: Player): boolean {
  const maxSlots = getConfig().gameplay.maxInventorySlots;
  return player.inventory.length < maxSlots;
}

// Format equipment display (used in inventory/equipment commands)
export function formatEquipmentList(player: Player): string {
  const equipped = [
    player.equipped.weapon && `  - ${player.equipped.weapon.name} (weapon)`,
    player.equipped.armor && `  - ${player.equipped.armor.name} (armor)`,
    player.equipped.shield && `  - ${player.equipped.shield.name} (shield)`,
    player.equipped.accessory && `  - ${player.equipped.accessory.name} (accessory)`
  ].filter(Boolean);
  
  return equipped.length > 0 ? equipped.join('\n') + '\n' : '';
}
