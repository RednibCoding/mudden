// shops.ts - Shop system (buy/sell)
import type { Player, Item, Shop } from './types';
import { send } from './messaging';
import { gameState } from './game';

/**
 * List shop inventory with prices
 */
export function list(player: Player): void {
  const location = gameState.gameData.locations.get(player.location);
  if (!location) return;

  const shop = location.shop;
  if (!shop) {
    return send(player, "There's no shop here.", 'error');
  }

  let message = `\n=== ${shop.name} ===\n\n`;
  
  if (shop.items.length === 0) {
    message += "This shop has nothing for sale.";
    return send(player, message, 'info');
  }

  const config = gameState.gameData.config;
  for (const itemId of shop.items) {
    const item = gameState.gameData.items.get(itemId);
    if (!item) continue;
    
    const price = Math.floor(item.value * config.economy.shopBuyMultiplier);
    message += `${item.name} - ${price}g\n`;
  }

  send(player, message, 'info');
}

/**
 * Buy an item from shop (accepts item name, does fuzzy matching)
 */
export function buy(player: Player, itemName: string): void {
  const location = gameState.gameData.locations.get(player.location);
  if (!location) return;

  const shop = location.shop;
  if (!shop) {
    return send(player, "There's no shop here.", 'error');
  }

  // Find item in shop inventory (fuzzy match against shop item IDs)
  const itemId = findItemInShop(shop, itemName);
  if (!itemId) {
    return send(player, "This shop doesn't sell that.", 'error');
  }

  const item = gameState.gameData.items.get(itemId);
  if (!item) {
    return send(player, "That item doesn't exist.", 'error');
  }

  const config = gameState.gameData.config;
  const price = Math.floor(item.value * config.economy.shopBuyMultiplier);

  if (player.gold < price) {
    return send(player, `You can't afford that. You need ${price}g.`, 'error');
  }

  if (player.inventory.length >= config.gameplay.maxInventorySlots) {
    return send(player, "Your inventory is full!", 'error');
  }

  player.gold -= price;
  player.inventory.push({ ...item });
  send(player, `You buy ${item.name} for ${price}g.`, 'success');
}

/**
 * Find item ID in shop (exact match only for safety)
 * Priority: exact name match → exact ID match
 */
function findItemInShop(shop: Shop, name: string): string | null {
  const lower = name.toLowerCase();
  const gameData = gameState.gameData;
  
  // Exact name match (case-insensitive)
  for (const itemId of shop.items) {
    const item = gameData.items.get(itemId);
    if (item && item.name.toLowerCase() === lower) {
      return itemId;
    }
  }
  
  // Exact ID match
  if (shop.items.includes(lower)) {
    return lower;
  }
  
  return null;
}

/**
 * Sell an item to shop (any shop buys anything)
 */
export function sell(player: Player, itemName: string): void {
  const location = gameState.gameData.locations.get(player.location);
  if (!location) return;

  const shop = location.shop;
  if (!shop) {
    return send(player, "There's no shop here.", 'error');
  }

  // Find item in inventory (fuzzy match)
  const item = findItemInInventory(player.inventory, itemName);
  if (!item) {
    return send(player, "You don't have that item.", 'error');
  }

  const config = gameState.gameData.config;
  const price = Math.floor(item.value * config.economy.shopSellMultiplier);

  player.gold += price;
  const index = player.inventory.indexOf(item);
  player.inventory.splice(index, 1);
  
  send(player, `You sell ${item.name} for ${price}g.`, 'success');
}

/**
 * Find item in inventory (exact match only for shop safety)
 * Priority: exact name match → exact ID match
 */
function findItemInInventory(inventory: Item[], name: string): Item | null {
  const lower = name.toLowerCase();
  
  // Exact name match (case-insensitive)
  let found = inventory.find(item => item.name.toLowerCase() === lower);
  if (found) return found;
  
  // Exact ID match
  found = inventory.find(item => item.id === lower);
  if (found) return found;
  
  return null;
}
