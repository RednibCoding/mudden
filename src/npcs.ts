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
  
  // Portal Master? Show available destinations
  if (npc.portals) {
    let portalList = '\nAvailable destinations:\n';
    for (const [keyword, portal] of Object.entries(npc.portals)) {
      const destination = gameState.gameData.locations.get(portal.destination);
      const destName = destination ? destination.name : portal.destination;
      portalList += `  - "${keyword}" → ${destName} (${portal.cost}g)\n`;
    }
    send(player, portalList, 'info');
  }
  
  // Quest interactions will be added in Phase 5
}

// Say to Portal Master NPC (for portals)
export function sayToNPC(player: Player, message: string): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location || !location.npcs) {
    return; // No NPCs here, just regular say
  }
  
  // Find portal master in location
  const portalMaster = location.npcs.find(npc => npc.portals);
  
  if (!portalMaster) {
    return; // No portal master, just regular say
  }
  
  // Check if message matches a portal keyword
  const keyword = message.toLowerCase();
  const portal = portalMaster.portals![keyword];
  
  if (!portal) {
    send(player, `${portalMaster.name}: "I don't know that destination."`, 'npc');
    return;
  }
  
  // Check if player has enough gold
  if (player.gold < portal.cost) {
    send(player, `${portalMaster.name}: "You need ${portal.cost} gold for that journey."`, 'npc');
    return;
  }
  
  // Check if destination exists
  const destination = gameState.gameData.locations.get(portal.destination);
  if (!destination) {
    send(player, `${portalMaster.name}: "That portal seems to be broken..."`, 'error');
    return;
  }
  
  // Charge gold
  player.gold -= portal.cost;
  
  // Announce departure
  const oldLocation = player.location;
  send(player, `${portalMaster.name}: "Step into the portal..."`, 'npc');
  broadcast(oldLocation, `${player.username} steps into a shimmering portal and vanishes!`, 'system', player.id);
  
  // Teleport
  player.location = portal.destination;
  
  // Announce arrival
  send(player, 'You step through the portal...', 'success');
  broadcast(portal.destination, `A portal shimmers into existence and ${player.username} steps through!`, 'system', player.id);
  
  // Save and show location
  savePlayer(player);
  
  const { look } = require('./movement');
  look(player);
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
