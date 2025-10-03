// Items and Equipment system

import { Player, Item } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';
import { savePlayer } from './player';
import { isInCombat } from './combat';

// Inventory command
export function inventory(player: Player): void {
  const maxSlots = gameState.gameData.config.gameplay.maxInventorySlots;
  const itemCount = player.inventory.length;
  
  send(player, `\n=== Inventory (${itemCount}/${maxSlots}) ===`, 'info');
  send(player, `Gold: ${player.gold}`, 'info');
  
  if (player.inventory.length === 0) {
    send(player, '\nYour inventory is empty.', 'info');
  } else {
    send(player, '\nItems:', 'info');
    
    // Group items by ID for stacking display
    const itemGroups = new Map<string, number>();
    player.inventory.forEach(item => {
      itemGroups.set(item.id, (itemGroups.get(item.id) || 0) + 1);
    });
    
    itemGroups.forEach((count, itemId) => {
      const item = player.inventory.find(i => i.id === itemId);
      if (item) {
        const equipped = isItemEquipped(player, item) ? ' (equipped)' : '';
        const countStr = count > 1 ? ` x${count}` : '';
        send(player, `  - ${item.name}${countStr}${equipped}`, 'info');
      }
    });
  }
  
  send(player, '', 'info');
}

// Equipment command
export function equipment(player: Player): void {
  send(player, '\n=== Equipment ===', 'info');
  
  const weapon = player.equipped.weapon;
  const armor = player.equipped.armor;
  const shield = player.equipped.shield;
  const accessory = player.equipped.accessory;
  
  send(player, `Weapon:    ${weapon ? `${weapon.name} (+${weapon.damage} damage)` : '(none)'}`, 'info');
  send(player, `Armor:     ${armor ? `${armor.name} (+${armor.defense} defense)` : '(none)'}`, 'info');
  send(player, `Shield:    ${shield ? `${shield.name} (+${shield.defense} defense)` : '(none)'}`, 'info');
  
  if (accessory) {
    const stats = [];
    if (accessory.damage) stats.push(`+${accessory.damage} damage`);
    if (accessory.defense) stats.push(`+${accessory.defense} defense`);
    if (accessory.health) stats.push(`+${accessory.health} health`);
    if (accessory.mana) stats.push(`+${accessory.mana} mana`);
    send(player, `Accessory: ${accessory.name} (${stats.join(', ')})`, 'info');
  } else {
    send(player, `Accessory: (none)`, 'info');
  }
  
  send(player, '', 'info');
}

// Equip command
export function equip(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Equip what?', 'error');
    return;
  }
  
  // Find item in inventory
  const item = findItemInInventory(player, itemName);
  
  if (!item) {
    send(player, `You don't have "${itemName}".`, 'error');
    return;
  }
  
  // Check if item is equippable
  if (!['weapon', 'armor', 'shield', 'accessory'].includes(item.type)) {
    send(player, `You can't equip ${item.name}.`, 'error');
    return;
  }
  
  // Unequip current item in that slot
  const slot = item.type as 'weapon' | 'armor' | 'shield' | 'accessory';
  const currentItem = player.equipped[slot];
  
  if (currentItem) {
    player.inventory.push(currentItem);
  }
  
  // Equip new item
  player.equipped[slot] = item;
  
  // Remove from inventory
  const index = player.inventory.indexOf(item);
  if (index > -1) {
    player.inventory.splice(index, 1);
  }
  
  send(player, `You equip ${item.name}.`, 'success');
  savePlayer(player);
}

// Unequip command
export function unequip(player: Player, slotName: string): void {
  if (!slotName) {
    send(player, 'Unequip what? (weapon, armor, shield, accessory)', 'error');
    return;
  }
  
  const slot = slotName.toLowerCase() as 'weapon' | 'armor' | 'shield' | 'accessory';
  
  if (!['weapon', 'armor', 'shield', 'accessory'].includes(slot)) {
    send(player, 'Invalid slot. Use: weapon, armor, shield, or accessory', 'error');
    return;
  }
  
  const item = player.equipped[slot];
  
  if (!item) {
    send(player, `You don't have anything equipped in that slot.`, 'error');
    return;
  }
  
  // Check if inventory is full
  const maxSlots = gameState.gameData.config.gameplay.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    send(player, 'Your inventory is full!', 'error');
    return;
  }
  
  // Move to inventory
  player.inventory.push(item);
  player.equipped[slot] = null;
  
  send(player, `You unequip ${item.name}.`, 'success');
  savePlayer(player);
}

// Drop command
export function drop(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Drop what?', 'error');
    return;
  }
  
  const item = findItemInInventory(player, itemName);
  
  if (!item) {
    send(player, `You don't have "${itemName}".`, 'error');
    return;
  }
  
  // Remove from inventory
  const index = player.inventory.indexOf(item);
  if (index > -1) {
    player.inventory.splice(index, 1);
  }
  
  // Add to location
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  if (!location.items) {
    location.items = [];
  }
  location.items.push(item);
  
  send(player, `You drop ${item.name}.`, 'info');
  broadcast(player.location, `${player.username} drops ${item.name}.`, 'system', player.id);
  savePlayer(player);
}

// Get/Take command
export function get(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Get what?', 'error');
    return;
  }
  
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // TypeScript now knows location is defined
  if (!location.items || location.items.length === 0) {
    send(player, 'There are no items here.', 'error');
    return;
  }
  
  // Find item on ground
  const itemLower = itemName.toLowerCase();
  const item = location.items.find(i => 
    i.name.toLowerCase().includes(itemLower) || 
    i.id.toLowerCase().includes(itemLower)
  );
  
  if (!item) {
    send(player, `You don't see "${itemName}" here.`, 'error');
    return;
  }
  
  // Check if inventory is full
  const maxSlots = gameState.gameData.config.gameplay.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    send(player, 'Your inventory is full!', 'error');
    return;
  }
  
  // Remove from location
  const index = location.items.indexOf(item);
  if (index > -1) {
    location.items.splice(index, 1);
  }
  
  // Add to inventory
  player.inventory.push(item);
  
  send(player, `You get ${item.name}.`, 'success');
  broadcast(player.location, `${player.username} picks up ${item.name}.`, 'system', player.id);
  savePlayer(player);
}

// Use command (for consumables)
export function use(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Use what?', 'error');
    return;
  }
  
  const item = findItemInInventory(player, itemName);
  
  if (!item) {
    send(player, `You don't have "${itemName}".`, 'error');
    return;
  }
  
  if (item.type !== 'consumable') {
    send(player, `You can't use ${item.name}.`, 'error');
    return;
  }
  
  useConsumable(player, item);
}

// Use consumable (with situation checks)
function useConsumable(player: Player, item: Item): void {
  const inCombat = isInCombat(player);
  
  // Validate usage situation
  if (item.usableIn === 'combat' && !inCombat) {
    send(player, 'You can only use this in combat!', 'error');
    return;
  }
  
  if (item.usableIn === 'peaceful' && inCombat) {
    send(player, "You can't use this while fighting!", 'error');
    return;
  }
  
  // Health potions (anytime)
  if (item.health && !item.damage) {
    const healed = Math.min(item.health, player.maxHealth - player.health);
    player.health += healed;
    send(player, `You drink ${item.name}. Healed ${healed} HP!`, 'success');
    removeItemFromInventory(player, item);
    savePlayer(player);
    return;
  }
  
  // Mana potions (anytime)
  if (item.mana && !item.manaCost && !item.damage) {
    const restored = Math.min(item.mana, player.maxMana - player.mana);
    player.mana += restored;
    send(player, `You drink ${item.name}. Restored ${restored} mana!`, 'success');
    removeItemFromInventory(player, item);
    savePlayer(player);
    return;
  }
  
  // Attack scrolls (combat only - already validated above)
  if (item.damage && item.manaCost) {
    if (player.mana < item.manaCost) {
      send(player, 'Not enough mana!', 'error');
      return;
    }
    
    const location = gameState.gameData.locations.get(player.location);
    
    if (!location) {
      send(player, 'You are nowhere!', 'error');
      return;
    }
    
    if (!location.enemies || location.enemies.length === 0) {
      send(player, "You're not fighting anything.", 'error');
      return;
    }
    
    // Find enemy player is fighting
    const enemy = location.enemies.find(e => e.fighters.includes(player.username));
    if (!enemy) {
      send(player, "You're not fighting anything.", 'error');
      return;
    }
    
    player.mana -= item.manaCost;
    enemy.health -= item.damage;
    
    send(player, `You use ${item.name}! ${enemy.name} takes ${item.damage} damage!`, 'combat');
    send(player, `(-${item.manaCost} mana)`, 'info');
    broadcast(player.location, `${player.username} uses ${item.name}!`, 'combat', player.id);
    
    removeItemFromInventory(player, item);
    
    // Check if enemy died
    if (enemy.health <= 0) {
      const { handleEnemyDeath } = require('./combat');
      handleEnemyDeath(player, enemy, player.location);
    }
    
    savePlayer(player);
    return;
  }
  
  // Teleport scrolls (peaceful only - already validated above)
  if (item.destination && item.manaCost) {
    if (player.mana < item.manaCost) {
      send(player, 'Not enough mana!', 'error');
      return;
    }
    
    const oldLocation = player.location;
    player.mana -= item.manaCost;
    player.location = item.destination;
    
    send(player, `You use ${item.name} and are teleported!`, 'success');
    send(player, `(-${item.manaCost} mana)`, 'info');
    broadcast(oldLocation, `${player.username} vanishes in a flash of light!`, 'system', player.id);
    broadcast(item.destination, `${player.username} appears in a flash of light!`, 'system', player.id);
    
    removeItemFromInventory(player, item);
    savePlayer(player);
    
    const { look } = require('./movement');
    look(player);
    return;
  }
  
  send(player, "You can't use that.", 'error');
}

// Helper: Find item in inventory (fuzzy match)
function findItemInInventory(player: Player, itemName: string): Item | null {
  const itemLower = itemName.toLowerCase();
  
  // Exact match
  let item = player.inventory.find(i => i.name.toLowerCase() === itemLower);
  if (item) return item;
  
  // Starts with
  item = player.inventory.find(i => i.name.toLowerCase().startsWith(itemLower));
  if (item) return item;
  
  // Contains
  item = player.inventory.find(i => i.name.toLowerCase().includes(itemLower));
  if (item) return item;
  
  // ID match
  item = player.inventory.find(i => i.id === itemLower);
  if (item) return item;
  
  return null;
}

// Helper: Check if item is equipped
function isItemEquipped(player: Player, item: Item): boolean {
  return player.equipped.weapon === item ||
         player.equipped.armor === item ||
         player.equipped.shield === item ||
         player.equipped.accessory === item;
}

// Helper: Remove item from inventory
function removeItemFromInventory(player: Player, item: Item): void {
  const index = player.inventory.indexOf(item);
  if (index > -1) {
    player.inventory.splice(index, 1);
  }
}
