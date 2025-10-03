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
  
  let message = `\n=== Inventory (${itemCount}/${maxSlots}) ===\nGold: ${player.gold}`;
  
  // Show equipped items
  const equipped = [
    player.equipped.weapon,
    player.equipped.armor,
    player.equipped.shield,
    player.equipped.accessory
  ].filter(item => item !== null);
  
  if (equipped.length > 0) {
    message += '\n\nEquipped:\n';
    if (player.equipped.weapon) message += `  - ${player.equipped.weapon.name} (weapon)\n`;
    if (player.equipped.armor) message += `  - ${player.equipped.armor.name} (armor)\n`;
    if (player.equipped.shield) message += `  - ${player.equipped.shield.name} (shield)\n`;
    if (player.equipped.accessory) message += `  - ${player.equipped.accessory.name} (accessory)\n`;
  }
  
  // Show inventory items
  if (player.inventory.length === 0) {
    message += '\n\nInventory: empty\n';
  } else {
    message += '\n\nInventory:\n';
    
    // Group items by ID for stacking display
    const itemGroups = new Map<string, number>();
    player.inventory.forEach(item => {
      itemGroups.set(item.id, (itemGroups.get(item.id) || 0) + 1);
    });
    
    itemGroups.forEach((count, itemId) => {
      const item = player.inventory.find(i => i.id === itemId);
      if (item) {
        const countStr = count > 1 ? ` x${count}` : '';
        message += `  - ${item.name}${countStr}\n`;
      }
    });
  }
  
  send(player, message, 'info');
}

// Equipment command
export function equipment(player: Player): void {
  const weapon = player.equipped.weapon;
  const armor = player.equipped.armor;
  const shield = player.equipped.shield;
  const accessory = player.equipped.accessory;
  
  let message = '\n=== Equipment ===\n';
  message += `Weapon:    ${weapon ? `${weapon.name} (+${weapon.damage} damage)` : '(none)'}\n`;
  message += `Armor:     ${armor ? `${armor.name} (+${armor.defense} defense)` : '(none)'}\n`;
  message += `Shield:    ${shield ? `${shield.name} (+${shield.defense} defense)` : '(none)'}\n`;
  
  if (accessory) {
    const stats = [];
    if (accessory.damage) stats.push(`+${accessory.damage} damage`);
    if (accessory.defense) stats.push(`+${accessory.defense} defense`);
    if (accessory.health) stats.push(`+${accessory.health} health`);
    if (accessory.mana) stats.push(`+${accessory.mana} mana`);
    message += `Accessory: ${accessory.name} (${stats.join(', ')})\n`;
  } else {
    message += `Accessory: (none)\n`;
  }
  
  send(player, message, 'info');
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
  if (item.type !== 'equipment' || !item.slot) {
    send(player, `You can't equip ${item.name}.`, 'error');
    return;
  }
  
  // Unequip current item in that slot
  const slot = item.slot;
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
  
  // If equipping ANY item with health/mana bonuses, cap current values
  if (item.health) {
    // Calculate new total max health from ALL equipped items
    const equipmentHealth = 
      (player.equipped.weapon?.health || 0) +
      (player.equipped.armor?.health || 0) +
      (player.equipped.shield?.health || 0) +
      (player.equipped.accessory?.health || 0);
    const newMaxHealth = player.maxHealth + equipmentHealth;
    // Don't exceed new max (player may have been damaged)
    player.health = Math.min(player.health, newMaxHealth);
  }
  if (item.mana) {
    // Calculate new total max mana from ALL equipped items
    const equipmentMana = 
      (player.equipped.weapon?.mana || 0) +
      (player.equipped.armor?.mana || 0) +
      (player.equipped.shield?.mana || 0) +
      (player.equipped.accessory?.mana || 0);
    const newMaxMana = player.maxMana + equipmentMana;
    // Don't exceed new max (player may have used mana)
    player.mana = Math.min(player.mana, newMaxMana);
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
  
  // If unequipping ANY item with health/mana bonuses, cap current values
  if (item.health) {
    // Calculate remaining max health from ALL equipped items (after unequipping)
    const equipmentHealth = 
      (player.equipped.weapon?.health || 0) +
      (player.equipped.armor?.health || 0) +
      (player.equipped.shield?.health || 0) +
      (player.equipped.accessory?.health || 0);
    const newMaxHealth = player.maxHealth + equipmentHealth;
    // Cap current health to new max (losing this item's bonus)
    player.health = Math.min(player.health, newMaxHealth);
  }
  if (item.mana) {
    // Calculate remaining max mana from ALL equipped items (after unequipping)
    const equipmentMana = 
      (player.equipped.weapon?.mana || 0) +
      (player.equipped.armor?.mana || 0) +
      (player.equipped.shield?.mana || 0) +
      (player.equipped.accessory?.mana || 0);
    const newMaxMana = player.maxMana + equipmentMana;
    // Cap current mana to new max (losing this item's bonus)
    player.mana = Math.min(player.mana, newMaxMana);
  }
  
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
    // Calculate max health with ALL equipment bonuses
    const equipmentHealth = 
      (player.equipped.weapon?.health || 0) +
      (player.equipped.armor?.health || 0) +
      (player.equipped.shield?.health || 0) +
      (player.equipped.accessory?.health || 0);
    const totalMaxHealth = player.maxHealth + equipmentHealth;
    
    const healed = Math.min(item.health, totalMaxHealth - player.health);
    player.health += healed;
    send(player, `You drink ${item.name}. Healed ${healed} HP!`, 'success');
    removeItemFromInventory(player, item);
    savePlayer(player);
    return;
  }
  
  // Mana potions (anytime)
  if (item.mana && !item.manaCost && !item.damage) {
    // Calculate max mana with ALL equipment bonuses
    const equipmentMana = 
      (player.equipped.weapon?.mana || 0) +
      (player.equipped.armor?.mana || 0) +
      (player.equipped.shield?.mana || 0) +
      (player.equipped.accessory?.mana || 0);
    const totalMaxMana = player.maxMana + equipmentMana;
    
    const restored = Math.min(item.mana, totalMaxMana - player.mana);
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
    
    send(player, `You use ${item.name}! ${enemy.name} takes ${item.damage} damage! (-${item.manaCost} mana)`, 'combat');
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
    
    send(player, `You use ${item.name} and are teleported! (-${item.manaCost} mana)`, 'success');
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

// Examine command - view detailed item information
export function examine(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Examine what?', 'error');
    return;
  }
  
  // Search in inventory
  let item = findItemInInventory(player, itemName);
  
  // Search in equipped items
  if (!item) {
    const itemLower = itemName.toLowerCase();
    const equipped = Object.values(player.equipped).find(i => 
      i && (i.name.toLowerCase().includes(itemLower) || 
            i.id.toLowerCase().includes(itemLower))
    );
    if (equipped) item = equipped;
  }
  
  // Search on ground
  if (!item) {
    const location = gameState.gameData.locations.get(player.location);
    if (location?.items) {
      const itemLower = itemName.toLowerCase();
      item = location.items.find(i => 
        i.name.toLowerCase().includes(itemLower) ||
        i.id.toLowerCase().includes(itemLower)
      ) || null;
    }
  }
  
  if (!item) {
    send(player, `You don't see "${itemName}" anywhere.`, 'error');
    return;
  }
  
  // Display item details
  let message = `\n=== ${item.name} ===\n`;
  
  // Type with usage info for consumables
  if (item.type === 'consumable' && item.usableIn) {
    const usageText = item.usableIn === 'any' ? 'Usable anytime' :
                      item.usableIn === 'combat' ? 'Combat only' :
                      'Peaceful only';
    message += `Type: Consumable (${usageText})\n`;
  } else {
    const typeText = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    message += `Type: ${typeText}\n`;
  }
  
  message += `Value: ${item.value} gold\n`;
  
  // Stats
  const stats = [];
  if (item.damage) stats.push(`  Damage: +${item.damage}`);
  if (item.defense) stats.push(`  Defense: +${item.defense}`);
  if (item.health && item.type !== 'consumable') stats.push(`  Health: +${item.health}`);
  if (item.mana && item.type !== 'consumable') stats.push(`  Mana: +${item.mana}`);
  
  if (stats.length > 0) {
    message += '\nStats:\n';
    stats.forEach(s => message += `${s}\n`);
  }
  
  // Consumable effects
  if (item.type === 'consumable') {
    const effects = [];
    if (item.health) effects.push(`  Restores ${item.health} health`);
    if (item.mana && !item.manaCost) effects.push(`  Restores ${item.mana} mana`);
    if (item.damage) effects.push(`  Deals ${item.damage} damage`);
    if (item.manaCost) effects.push(`  Costs ${item.manaCost} mana`);
    if (item.destination) effects.push(`  Teleports to ${item.destination}`);
    
    if (effects.length > 0) {
      message += '\nEffect:\n';
      effects.forEach(e => message += `${e}\n`);
    }
  }
  
  // Description
  if (item.description) {
    message += `\n"${item.description}"\n`;
  }
  
  send(player, message, 'info');
}
