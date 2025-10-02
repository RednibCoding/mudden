/**
 * Item-related commands (get, drop, equip, unequip, use)
 */
import { Player, Item, GroundItem, Location } from '../types';
import { gameState } from '../gameState';
import { sendToLocation } from '../messaging';
import { isPlayerInCombat, findItemByName, isGroundItemVisibleToPlayer } from '../utils';
import { updateQuestProgress } from '../questSystem';
import { savePlayer } from '../auth';

/**
 * Handles get command - picks up items from ground
 */
export function handleGetCommand(socket: any, player: Player, itemName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'error', data: 'Location not found' });
    return;
  }

  const searchName = itemName.toLowerCase();
  let foundGroundItem: GroundItem | null = null;
  let foundItem: Item | null = null;
  let isDroppedItem = false;

  // First check predefined ground items
  if (location.groundItems) {
    for (const groundItem of location.groundItems) {
      const item = gameState.items.get(groundItem.itemId);
      if (item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)) {
        if (isGroundItemVisibleToPlayer(groundItem, player, player.location)) {
          foundGroundItem = groundItem;
          foundItem = item;
          break;
        }
      }
    }
  }

  // If not found, check dropped items
  if (!foundItem && location.droppedItems) {
    for (const groundItem of location.droppedItems) {
      const item = gameState.items.get(groundItem.itemId);
      if (item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)) {
        foundGroundItem = groundItem;
        foundItem = item;
        isDroppedItem = true;
        break;
      }
    }
  }

  if (!foundItem || !foundGroundItem) {
    socket.emit('message', { type: 'message', data: { text: `There is no ${itemName} here to take.`, type: 'system' } });
    return;
  }

  // Check inventory space
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    socket.emit('message', { type: 'message', data: { text: 'Your inventory is full!', type: 'system' } });
    return;
  }

  // Add item to player inventory (create a copy)
  player.inventory.push({ ...foundItem });

  // Track one-time items
  if (foundGroundItem.oneTime) {
    const oneTimeKey = `${player.location}.${foundGroundItem.itemId}`;
    if (!player.oneTimeItemsPickedUp.includes(oneTimeKey)) {
      player.oneTimeItemsPickedUp.push(oneTimeKey);
    }
  }

  // Handle dropped items vs predefined ground items
  if (isDroppedItem) {
    const itemIndex = location.droppedItems!.indexOf(foundGroundItem);
    if (itemIndex !== -1) {
      location.droppedItems!.splice(itemIndex, 1);
    }
  } else {
    // Predefined ground items - handle respawn
    if (foundGroundItem.respawnTime && !foundGroundItem.oneTime) {
      foundGroundItem.lastPickedUp = Date.now();
      
      setTimeout(() => {
        if (foundGroundItem!.lastPickedUp) {
          const timeSincePickup = Date.now() - foundGroundItem!.lastPickedUp;
          if (timeSincePickup >= foundGroundItem!.respawnTime!) {
            sendToLocation(player.location, {
              type: 'message',
              data: { text: `${foundItem!.name} appears on the ground.`, type: 'system' }
            });
          }
        }
      }, foundGroundItem.respawnTime);
    }
  }

  savePlayer(player);

  socket.emit('message', { type: 'message', data: { text: `You pick up ${foundItem.name}.`, type: 'success' } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} picks up ${foundItem.name}.`, type: 'system' }
  }, player.username);

  // Update quest progress for collect quests
  updateQuestProgress(player, 'collect', foundItem.id, player.username);
}

/**
 * Handles drop command - drops items to ground
 */
export function handleDropCommand(socket: any, player: Player, itemName: string): void {
  if (isPlayerInCombat(player)) {
    socket.emit('message', { type: 'message', data: { text: 'You cannot drop items while in combat!', type: 'system' } });
    return;
  }

  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'error', data: 'Location not found' });
    return;
  }

  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || 
    item.id.toLowerCase() === searchName
  );

  if (itemIndex === -1) {
    socket.emit('message', { type: 'error', data: `You don't have "${itemName}".` });
    return;
  }

  const itemToDrop = player.inventory[itemIndex];

  // Initialize droppedItems array if it doesn't exist
  if (!location.droppedItems) {
    location.droppedItems = [];
  }

  // Clean up expired dropped items first
  cleanupExpiredDroppedItems(location);

  const maxDropped = gameState.defaults.droppedItems?.maxDroppedItemsPerLocation || 10;

  // If we're at max capacity, remove the oldest dropped item
  if (location.droppedItems.length >= maxDropped) {
    const oldestDropped = location.droppedItems.reduce((oldest, item) => 
      (item.droppedAt! < oldest.droppedAt!) ? item : oldest
    );
    const oldestIndex = location.droppedItems.indexOf(oldestDropped);
    if (oldestIndex !== -1) {
      const removedItem = gameState.items.get(oldestDropped.itemId);
      location.droppedItems.splice(oldestIndex, 1);
      sendToLocation(player.location, {
        type: 'message',
        data: { text: `${removedItem?.name || 'An item'} crumbles to dust.`, type: 'system' }
      });
    }
  }

  // Add the item to dropped items with droppedAt timestamp
  const groundItem: GroundItem = {
    itemId: itemToDrop.id,
    droppedAt: Date.now()
  };
  location.droppedItems.push(groundItem);

  // Remove from player inventory
  player.inventory.splice(itemIndex, 1);
  savePlayer(player);

  // Schedule automatic cleanup after lifetime expires
  const lifetime = gameState.defaults.droppedItems?.droppedItemLifetimeMs || 300000;
  setTimeout(() => {
    const itemStillExists = location.droppedItems?.findIndex(gi => gi === groundItem);
    if (itemStillExists !== undefined && itemStillExists !== -1) {
      location.droppedItems?.splice(itemStillExists, 1);
      sendToLocation(player.location, {
        type: 'message',
        data: { text: `${itemToDrop.name} crumbles to dust.`, type: 'system' }
      });
    }
  }, lifetime);

  socket.emit('message', { type: 'message', data: { text: `You drop ${itemToDrop.name}.`, type: 'success' } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} drops ${itemToDrop.name}.`, type: 'system' }
  }, player.username);
}

/**
 * Cleanup expired dropped items from a location
 */
function cleanupExpiredDroppedItems(location: Location): void {
  if (!location.droppedItems) return;

  const lifetime = gameState.defaults.droppedItems?.droppedItemLifetimeMs || 300000;
  const now = Date.now();

  location.droppedItems = location.droppedItems.filter(gi => {
    return (now - gi.droppedAt!) < lifetime;
  });
}

/**
 * Handles equip command
 */
export function handleEquipCommand(socket: any, player: Player, itemName: string): void {
  const item = findItemByName(player.inventory, itemName);
  
  if (!item) {
    socket.emit('message', { type: 'message', data: { text: `You don't have ${itemName}.`, type: 'system' } });
    return;
  }

  if (!['weapon', 'armor', 'shield'].includes(item.type)) {
    socket.emit('message', { type: 'message', data: { text: `You cannot equip ${item.name}.`, type: 'system' } });
    return;
  }

  const slot = item.type as 'weapon' | 'armor' | 'shield';
  const currentItem = player.equipment[slot];

  if (currentItem) {
    player.inventory.push(currentItem);
    socket.emit('message', { type: 'message', data: { text: `You unequip ${currentItem.name}.`, type: 'action' } });
  }

  player.equipment[slot] = item;
  const itemIndex = player.inventory.indexOf(item);
  player.inventory.splice(itemIndex, 1);

  socket.emit('message', { type: 'message', data: { text: `You equip ${item.name}.`, type: 'action' } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} equips ${item.name}.`, type: 'action' }
  }, player.username);
}

/**
 * Handles unequip command
 */
export function handleUnequipCommand(socket: any, player: Player, itemName: string): void {
  const searchName = itemName.toLowerCase();
  const equipment = player.equipment;
  
  let item: Item | null = null;
  let slot: 'weapon' | 'armor' | 'shield' | null = null;

  if (equipment.weapon && equipment.weapon.name.toLowerCase().includes(searchName)) {
    item = equipment.weapon;
    slot = 'weapon';
  } else if (equipment.armor && equipment.armor.name.toLowerCase().includes(searchName)) {
    item = equipment.armor;
    slot = 'armor';
  } else if (equipment.shield && equipment.shield.name.toLowerCase().includes(searchName)) {
    item = equipment.shield;
    slot = 'shield';
  }

  if (!item || !slot) {
    socket.emit('message', { type: 'message', data: { text: `You don't have ${itemName} equipped.`, type: 'system' } });
    return;
  }

  if (player.inventory.length >= gameState.defaults.player.maxInventorySlots) {
    socket.emit('message', { type: 'message', data: { text: 'Your inventory is full.', type: 'system' } });
    return;
  }

  player.equipment[slot] = undefined;
  player.inventory.push(item);

  socket.emit('message', { type: 'message', data: { text: `You unequip ${item.name}.`, type: 'action' } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} unequips ${item.name}.`, type: 'action' }
  }, player.username);
}

/**
 * Handles use command - uses consumable items
 */
export function handleUseCommand(socket: any, player: Player, itemName: string): void {
  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase().includes(searchName)
  );

  if (itemIndex === -1) {
    socket.emit('message', { type: 'message', data: { text: `You don't have '${itemName}' in your inventory.`, type: 'system' } });
    return;
  }

  const item = player.inventory[itemIndex];

  if (item.type !== 'consumable') {
    socket.emit('message', { type: 'message', data: { text: `You can't use ${item.name}.`, type: 'system' } });
    return;
  }

  if (!item.effect) {
    socket.emit('message', { type: 'message', data: { text: `${item.name} has no effect.`, type: 'system' } });
    return;
  }

  // Check global cooldown
  const cooldownMs = gameState.defaults.items.useCooldownMs;
  const timeSinceLastUse = Date.now() - (player.lastItemUse || 0);
  
  if (timeSinceLastUse < cooldownMs) {
    const remainingMs = cooldownMs - timeSinceLastUse;
    const remainingSec = (remainingMs / 1000).toFixed(1);
    socket.emit('message', { type: 'message', data: { text: `You must wait ${remainingSec} seconds before using another item.`, type: 'system' } });
    return;
  }

  const isInCombat = isPlayerInCombat(player);

  // Check usage context
  if (item.effect.usableIn === 'combat' && !isInCombat) {
    socket.emit('message', { type: 'message', data: { text: `You can only use ${item.name} during combat.`, type: 'system' } });
    return;
  }

  if (item.effect.usableIn === 'non-combat' && isInCombat) {
    socket.emit('message', { type: 'message', data: { text: `You can't use ${item.name} during combat.`, type: 'system' } });
    return;
  }

  // Apply effect
  let effectMessage = '';
  
  if (item.effect.type === 'heal') {
    if (player.health >= player.maxHealth) {
      socket.emit('message', { type: 'message', data: { text: `You are already at full health.`, type: 'system' } });
      return;
    }
    
    const healAmount = item.effect.amount || 0;
    const actualHeal = Math.min(healAmount, player.maxHealth - player.health);
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    effectMessage = `You use ${item.name} and restore ${actualHeal} health.`;
  }

  // Update lastItemUse
  player.lastItemUse = Date.now();

  // Remove item from inventory
  player.inventory.splice(itemIndex, 1);

  socket.emit('message', { type: 'message', data: { text: effectMessage, type: 'success' } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} uses ${item.name}.`, type: 'action' }
  }, player.username);

  savePlayer(player);
}
