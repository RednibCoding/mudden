/**
 * Shop system for buying and selling items
 */
import { Player, Item } from './types';
import { gameState } from './gameState';
import { sendToPlayer, sendToLocation } from './messaging';
import { savePlayer } from './auth';

/**
 * Lists items available in the current location's shop
 */
export function handleListShop(socket: any, player: Player): void {
  const location = gameState.locations.get(player.location);
  if (!location || !location.shop) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'There is no shop here.', type: 'system' }
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'There is no shop here.', type: 'system' }
    });
    return;
  }

  let text = `=== ${shop.name} ===\nAvailable Items:\n`;

  shop.items.forEach(itemId => {
    const item = gameState.items.get(itemId);
    if (item) {
      const buyPrice = Math.ceil(item.value * shop.margin);
      text += `- ${item.name}: ${buyPrice}g`;

      if (item.stats) {
        const stats = [];
        if (item.stats.damage) stats.push(`Dmg: ${item.stats.damage}`);
        if (item.stats.defense) stats.push(`Def: ${item.stats.defense}`);
        if (item.stats.health) stats.push(`HP: ${item.stats.health}`);
        if (stats.length > 0) {
          text += ` (${stats.join(', ')})`;
        }
      }
      text += `\n`;
    }
  });

  socket.emit('message', {
    type: 'message',
    data: { text, type: 'info' }
  });
}

/**
 * Handles buying an item from a shop
 */
export function handleBuy(socket: any, player: Player, itemName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location || !location.shop) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'There is no shop here.', type: 'system' }
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', { type: 'system', data: 'Shop not found' });
    return;
  }

  const searchName = itemName.toLowerCase();
  let itemToBuy: Item | null = null;

  for (const itemId of shop.items) {
    const item = gameState.items.get(itemId);
    if (item && (item.name.toLowerCase() === searchName || item.id.toLowerCase() === searchName)) {
      itemToBuy = item;
      break;
    }
  }

  if (!itemToBuy) {
    socket.emit('message', {
      type: 'message',
      data: { text: `The shop doesn't sell '${itemName}'.`, type: 'system' }
    });
    return;
  }

  const maxSlots = gameState.defaults.player.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'Your inventory is full!', type: 'error' }
    });
    return;
  }

  const buyPrice = Math.ceil(itemToBuy.value * shop.margin);

  if (player.gold < buyPrice) {
    socket.emit('message', {
      type: 'message',
      data: { text: `You need ${buyPrice} gold to buy ${itemToBuy.name}. You only have ${player.gold} gold.`, type: 'error' }
    });
    return;
  }

  player.gold -= buyPrice;
  player.inventory.push({ ...itemToBuy });
  savePlayer(player);

  socket.emit('message', {
    type: 'message',
    data: { text: `You bought ${itemToBuy.name} for ${buyPrice} gold.`, type: 'success' }
  });

  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} buys something from the shop.`, type: 'system' }
  }, player.username);
}

/**
 * Handles selling an item to a shop
 */
export function handleSell(socket: any, player: Player, itemName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location || !location.shop) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'There is no shop here.', type: 'system' }
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', { type: 'system', data: 'Shop not found' });
    return;
  }

  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item =>
    item.name.toLowerCase() === searchName || item.id.toLowerCase() === searchName
  );

  if (itemIndex === -1) {
    socket.emit('message', {
      type: 'message',
      data: { text: `You don't have '${itemName}' in your inventory.`, type: 'system' }
    });
    return;
  }

  const itemToSell = player.inventory[itemIndex];
  const sellPrice = itemToSell.value;

  player.inventory.splice(itemIndex, 1);
  player.gold += sellPrice;
  savePlayer(player);

  socket.emit('message', {
    type: 'message',
    data: { text: `You sold ${itemToSell.name} for ${sellPrice} gold.`, type: 'success' }
  });

  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} sells something to the shop.`, type: 'system' }
  }, player.username);
}
