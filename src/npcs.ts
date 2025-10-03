// NPC interaction system

import { Player, NPC } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';
import { savePlayer } from './player';

// Talk to NPC command
export function talk(player: Player, npcName: string): void {
  if (!npcName) {
    send(player, 'Talk to who?', 'error');
    return;
  }
  
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // Find NPC in location
  const npc = findNPC(location.npcs || [], npcName);
  
  if (!npc) {
    send(player, `You don't see "${npcName}" here.`, 'error');
    return;
  }
  
  // Regular dialogue
  send(player, `${npc.name}: "${npc.dialogue}"`, 'npc');
  
  // Healer NPC?
  if (npc.healer) {
    handleHealer(player, npc);
  }
  
  // Quest interactions will be added in Phase 5
  // Shop interactions will be added separately
}

// Helper: Find NPC by name (fuzzy matching)
function findNPC(npcs: NPC[], name: string): NPC | null {
  const nameLower = name.toLowerCase();
  
  // Exact match
  let match = npcs.find(n => n.name.toLowerCase() === nameLower);
  if (match) return match;
  
  // Partial match (starts with)
  match = npcs.find(n => n.name.toLowerCase().startsWith(nameLower));
  if (match) return match;
  
  // Contains match
  match = npcs.find(n => n.name.toLowerCase().includes(nameLower));
  if (match) return match;
  
  // ID match
  match = npcs.find(n => n.id === nameLower);
  if (match) return match;
  
  return null;
}

// Handle healer NPC
function handleHealer(player: Player, npc: NPC): void {
  const config = gameState.gameData.config;
  
  // Calculate equipment bonuses for max health/mana
  const equipmentHealth = 
    (player.equipped.weapon?.health || 0) +
    (player.equipped.armor?.health || 0) +
    (player.equipped.shield?.health || 0) +
    (player.equipped.accessory?.health || 0);
  
  const equipmentMana = 
    (player.equipped.weapon?.mana || 0) +
    (player.equipped.armor?.mana || 0) +
    (player.equipped.shield?.mana || 0) +
    (player.equipped.accessory?.mana || 0);
  
  const totalMaxHealth = player.maxHealth + equipmentHealth;
  const totalMaxMana = player.maxMana + equipmentMana;
  
  const missingHealth = totalMaxHealth - player.health;
  const missingMana = totalMaxMana - player.mana;
  
  // Already at full health and mana?
  if (missingHealth === 0 && missingMana === 0) {
    return; // Silent - no message
  }
  
  // Calculate healing cost
  const costFactor = config.economy.healerCostFactor;
  const totalCost = Math.ceil((missingHealth + missingMana) * costFactor / 100);
  
  // Can player afford it?
  if (player.gold < totalCost) {
    send(player, `${npc.name}: "You need ${totalCost} gold for full healing."`, 'npc');
    return;
  }
  
  // Heal the player
  player.gold -= totalCost;
  player.health = totalMaxHealth;
  player.mana = totalMaxMana;
  
  send(player, `You are healed for ${totalCost} gold!`, 'success');
  broadcast(player.location, `${npc.name} heals ${player.username}.`, 'system', player.id);
  
  savePlayer(player);
}
