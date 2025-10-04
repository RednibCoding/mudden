// Give command - Player-to-player transfers

import { Player, Item } from './types';
import { gameState } from './game';
import { send } from './messaging';
import { savePlayer } from './player';
import { getConfig, findInInventory, hasInventorySpace } from './utils';

/**
 * Give an item or gold to another player
 * Usage: give <player> <item> OR give <player> <amount> gold
 */
export function give(player: Player, args: string[]): void {
  if (args.length < 2) {
    send(player, 'Usage: give <player> <item> OR give <player> <amount> gold', 'error');
    return;
  }
  
  const targetName = args[0]; // First arg is always the player
  
  // Check if it's gold: "give bob 50 gold"
  if (args.length >= 3 && args[args.length - 1].toLowerCase() === 'gold') {
    giveGold(player, targetName, args);
    return;
  }
  
  // Otherwise it's an item: "give bob sword"
  giveItem(player, targetName, args);
}

/**
 * Give gold to another player
 */
function giveGold(player: Player, targetName: string, args: string[]): void {
  // Parse amount from args[1] (e.g., "give bob 50 gold")
  const amount = parseInt(args[1]);
  
  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    send(player, 'Invalid amount.', 'error');
    return;
  }
  
  // Check if player has enough gold
  if (player.gold < amount) {
    send(player, `You don't have ${amount} gold.`, 'error');
    return;
  }
  
  // Find target player in same location
  const target = findPlayerInLocation(player.location, targetName);
  
  if (!target) {
    send(player, `You don't see "${targetName}" here.`, 'error');
    return;
  }
  
  if (target.id === player.id) {
    send(player, "You can't give gold to yourself.", 'error');
    return;
  }
  
  // Transfer gold
  player.gold -= amount;
  target.gold += amount;
  
  send(player, `You give ${amount} gold to ${target.displayName}.`, 'success');
  send(target, `${player.displayName} gives you ${amount} gold.`, 'success');
  
  // Save both players
  savePlayer(player);
  savePlayer(target);
}

/**
 * Give an item to another player
 */
function giveItem(player: Player, targetName: string, args: string[]): void {
  // Everything after target name is the item name (e.g., "give bob rusty sword")
  const itemName = args.slice(1).join(' ');
  
  // Find item in inventory (exact match only for safety)
  const item = findInInventory(player, itemName);
  
  if (!item) {
    send(player, `You don't have "${itemName}".`, 'error');
    return;
  }
  
  // Find target player in same location
  const target = findPlayerInLocation(player.location, targetName);
  
  if (!target) {
    send(player, `You don't see "${targetName}" here.`, 'error');
    return;
  }
  
  if (target.id === player.id) {
    send(player, "You can't give items to yourself.", 'error');
    return;
  }
  
  // Check if target has inventory space
  const maxSlots = getConfig().gameplay.maxInventorySlots;
  if (target.inventory.length >= maxSlots) {
    send(player, `${target.displayName}'s inventory is full!`, 'error');
    return;
  }
  
  // Transfer item
  const index = player.inventory.indexOf(item);
  player.inventory.splice(index, 1);
  target.inventory.push(item);
  
  send(player, `You give ${item.name} to ${target.displayName}.`, 'success');
  send(target, `${player.displayName} gives you ${item.name}.`, 'success');
  
  // Save both players
  savePlayer(player);
  savePlayer(target);
}

/**
 * Find player by name in same location
 */
function findPlayerInLocation(locationId: string, name: string): Player | null {
  const nameLower = name.toLowerCase();
  
  // Find all players in location
  const playersHere = Array.from(gameState.players.values())
    .filter(p => p.location === locationId && p.socket);
  
  // Exact match
  let found = playersHere.find(p => p.username.toLowerCase() === nameLower);
  if (found) return found;
  
  // Starts with
  found = playersHere.find(p => p.username.toLowerCase().startsWith(nameLower));
  if (found) return found;
  
  return null;
}
