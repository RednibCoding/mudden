// NPC interaction system

import { Player, NPC } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';
import { savePlayer } from './player';
import { canAcceptQuest, canCompleteQuest, acceptQuest, completeQuest, updateQuestProgress } from './quests';
import { look } from './movement';
import { getLocation, getConfig, findNpc } from './utils';

// Talk to NPC command
export function talk(player: Player, npcName: string): void {
  if (!npcName) {
    send(player, 'Talk to who?', 'error');
    return;
  }
  
  const location = getLocation(player);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // Find NPC in location
  const npc = findNpc(location, npcName);
  
  if (!npc) {
    send(player, `You don't see "${npcName}" here.`, 'error');
    return;
  }
  
  // Check if this NPC is a visit quest target and has questDialogue
  let hasActiveVisitQuest = false;
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.gameData.quests.get(questId);
    if (quest && quest.type === 'visit' && quest.target === npc.id) {
      hasActiveVisitQuest = true;
      break;
    }
  }
  
  // Show quest-specific dialogue if NPC is a visit quest target
  if (hasActiveVisitQuest && npc.questDialogue) {
    send(player, `${npc.name}: "${npc.questDialogue}"`, 'npc');
    // Update quest progress
    updateQuestProgress(player, 'visit', npc.id);
    return;
  }
  
  // Quest handling - check BEFORE showing regular dialogue
  // NPCs can offer multiple quests - find the first available one
  if (npc.quests && npc.quests.length > 0) {
    // Find first quest that player can interact with (order matters!)
    for (const questId of npc.quests) {
      // Can complete quest?
      if (canCompleteQuest(player, questId)) {
        const quest = gameState.gameData.quests.get(questId);
        if (quest) {
          send(player, `${npc.name}: "${quest.completionDialogue}"`, 'npc');
        } else {
          send(player, `${npc.name}: "${npc.dialogue}"`, 'npc');
        }
        completeQuest(player, questId);
        return;
      }
      
      // Can accept quest?
      if (canAcceptQuest(player, questId)) {
        send(player, `${npc.name}: "${npc.dialogue}"`, 'npc');
        acceptQuest(player, questId);
        return;
      }
      
      // Quest already active - show quest dialogue again as reminder
      if (player.activeQuests[questId]) {
        const quest = gameState.gameData.quests.get(questId);
        if (quest) {
          send(player, `${npc.name}: "${quest.dialogue}"`, 'npc');
          const progress = player.activeQuests[questId];
          
          // Show different progress based on quest type
          if (quest.type === 'collect' && quest.materialDrop) {
            const collected = player.questItems[quest.materialDrop] || 0;
            send(player, `Quest in progress: ${collected}/${quest.count} ${quest.materialDrop}`, 'info');
          } else {
            send(player, `Quest in progress: ${progress.progress}/${quest.count}`, 'info');
          }
        }
        return;
      }
    }
  }
  
  // Regular dialogue (only if no quest interaction)
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
}

// Say to Portal Master NPC (for portals)
export function sayToNPC(player: Player, message: string): void {
  const location = getLocation(player);
  
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
  if (!portalMaster.portals) return;
  
  const portal = portalMaster.portals[keyword];
  
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
  broadcast(oldLocation, `${player.displayName} steps into a shimmering portal and vanishes!`, 'system', player.id);
  
  // Teleport
  player.location = portal.destination;
  
  // Announce arrival
  send(player, 'You step through the portal...', 'success');
  broadcast(portal.destination, `A portal shimmers into existence and ${player.displayName} steps through!`, 'system', player.id);
  
  // Save and show location
  savePlayer(player);
  
  look(player);
}



// Handle healer NPC
function handleHealer(player: Player, npc: NPC): void {
  const config = getConfig();
  
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
  broadcast(player.location, `${npc.name} heals ${player.displayName}.`, 'system', player.id);
  
  savePlayer(player);
}
