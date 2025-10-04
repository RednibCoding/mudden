// Quest System - Accept, track, and complete quests

import { Player, Quest, QuestProgress } from './types';
import { gameState } from './game';
import { send } from './messaging';
import { savePlayer } from './player';
import { getLocation, getConfig } from './utils';

/**
 * Check if player can accept a quest
 * Validates level requirements, prerequisites, and quest state
 * @param player - The player attempting to accept the quest
 * @param questId - The quest ID to check
 * @returns true if quest can be accepted, false otherwise
 */
export function canAcceptQuest(player: Player, questId: string): boolean {
  const quest = gameState.gameData.quests.get(questId);
  if (!quest) return false;
  
  // Already active?
  if (player.activeQuests[questId]) return false;
  
  // Already completed?
  if (player.completed.includes(questId)) return false;
  
  // Check level requirement
  if (quest.levelRequirement && player.level < quest.levelRequirement) {
    return false;
  }
  
  // Check prerequisite
  if (quest.requiresQuest && !player.completed.includes(quest.requiresQuest)) {
    return false;
  }
  
  return true;
}

/**
 * Accept a new quest and add it to player's active quests
 * @param player - The player accepting the quest
 * @param questId - The quest ID to accept
 */
export function acceptQuest(player: Player, questId: string): void {
  const quest = gameState.gameData.quests.get(questId);
  if (!quest) {
    send(player, 'Quest not found.', 'error');
    return;
  }
  
  if (!canAcceptQuest(player, questId)) {
    send(player, "You can't accept this quest right now.", 'error');
    return;
  }
  
  // Initialize quest progress
  player.activeQuests[questId] = {
    questId: questId,
    progress: 0
  };
  
  send(player, `Quest accepted: ${quest.name}`, 'success');
  send(player, `"${quest.dialogue}"`, 'npc');
  
  savePlayer(player);
}

/**
 * Check if player can complete a quest
 */
export function canCompleteQuest(player: Player, questId: string): boolean {
  const quest = gameState.gameData.quests.get(questId);
  if (!quest) return false;
  
  const progress = player.activeQuests[questId];
  if (!progress) return false;
  
  // Check if progress meets requirement
  if (progress.progress < quest.count) return false;
  
  // For collect quests, also check questItems using itemDrop field
  if (quest.type === 'collect' && quest.itemDrop) {
    const collected = player.questItems[quest.itemDrop] || 0;
    if (collected < quest.count) return false;
  }
  
  return true;
}

/**
 * Complete a quest and give rewards
 */
export function completeQuest(player: Player, questId: string): void {
  const quest = gameState.gameData.quests.get(questId);
  if (!quest) {
    send(player, 'Quest not found.', 'error');
    return;
  }
  
  if (!canCompleteQuest(player, questId)) {
    send(player, "You haven't completed this quest yet.", 'error');
    return;
  }
  
  // Remove from active quests
  delete player.activeQuests[questId];
  
  // Add to completed
  player.completed.push(questId);
  
  // Clear quest items if collect quest (using itemDrop field)
  if (quest.type === 'collect' && quest.itemDrop) {
    delete player.questItems[quest.itemDrop];
  }
  
  // Give rewards
  player.gold += quest.reward.gold;
  player.xp += quest.reward.xp;
  
  // Optional item reward
  if (quest.reward.item) {
    const item = gameState.gameData.items.get(quest.reward.item);
    if (item) {
      player.inventory.push({ ...item });
      send(player, `You receive ${item.name}!`, 'loot');
    }
  }
  
  send(player, `Quest complete: ${quest.name}!`, 'success');
  send(player, `Rewards: ${quest.reward.gold} gold, ${quest.reward.xp} XP`, 'loot');
  
  // Check for level up
  checkLevelUp(player);
  
  savePlayer(player);
}

/**
 * Update quest progress (called when killing enemies, collecting items, or visiting NPCs)
 */
export function updateQuestProgress(player: Player, type: 'kill' | 'collect' | 'visit', target: string): void {
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.gameData.quests.get(questId);
    if (!quest) continue;
    
    // Check if this quest matches the event
    if (quest.type === type && quest.target === target) {
      progress.progress++;
      
      // For collect quests, track quest items and show pickup message
      if (type === 'collect' && quest.itemDrop) {
        if (!player.questItems[quest.itemDrop]) {
          player.questItems[quest.itemDrop] = 0;
        }
        player.questItems[quest.itemDrop]++;
        
        // Try to get the material name, fallback to ID if not found
        const material = gameState.gameData.materials.get(quest.itemDrop);
        const itemName = material ? material.name : quest.itemDrop;
        
        // Show quest item pickup message
        send(player, `You obtain ${itemName}! (Quest)`, 'loot');
        send(player, `Quest progress: ${player.questItems[quest.itemDrop]}/${quest.count} ${itemName}`, 'info');
        
        // Check if complete
        if (progress.progress >= quest.count) {
          const questGiverName = quest.npc ? gameState.gameData.npcs.get(quest.npc)?.name || 'the quest giver' : 'the quest giver';
          send(player, `Quest objective complete! Return to ${questGiverName}.`, 'success');
        }
      } else if (type === 'visit') {
        // Visit quests complete immediately - just show completion message once
        const questGiverName = quest.npc ? gameState.gameData.npcs.get(quest.npc)?.name || 'the quest giver' : 'the quest giver';
        send(player, `Quest objective complete! Return to ${questGiverName}.`, 'success');
      } else {
        // Kill quests
        send(player, `Quest progress: ${progress.progress}/${quest.count} ${target}`, 'info');
        
        // Check if complete
        if (progress.progress >= quest.count) {
          const questGiverName = quest.npc ? gameState.gameData.npcs.get(quest.npc)?.name || 'the quest giver' : 'the quest giver';
          send(player, `Quest objective complete! Return to ${questGiverName}.`, 'success');
        }
      }
      
      savePlayer(player);
    }
  }
}

/**
 * Show active quests
 */
export function showQuests(player: Player): void {
  let message = '\n=== Active Quests ===\n';
  
  const activeQuests = Object.entries(player.activeQuests);
  
  if (activeQuests.length === 0) {
    message += 'No active quests.\n';
  } else {
    for (const [questId, progress] of activeQuests) {
      const quest = gameState.gameData.quests.get(questId);
      if (!quest) continue;
      
      message += `\n${quest.name}:\n`;
      message += `  ${quest.dialogue}\n`;
      
      if (quest.type === 'collect' && quest.itemDrop) {
        const collected = player.questItems[quest.itemDrop] || 0;
        
        // Try to get the material name, fallback to ID if not found
        const material = gameState.gameData.materials.get(quest.itemDrop);
        const itemName = material ? material.name : quest.itemDrop;
        
        message += `  Progress: ${collected}/${quest.count} ${itemName}\n`;
      } else {
        message += `  Progress: ${progress.progress}/${quest.count}\n`;
      }
      
      if (canCompleteQuest(player, questId)) {
        const questGiverName = quest.npc ? gameState.gameData.npcs.get(quest.npc)?.name || quest.npc : 'quest giver';
        message += `  ✓ Ready to turn in! Talk to ${questGiverName}\n`;
      }
    }
  }
  
  // Show completed quests count
  message += `\nCompleted: ${player.completed.length} quest(s)\n`;
  
  send(player, message, 'info');
}

/**
 * Check for level up after gaining XP
 */
function checkLevelUp(player: Player): void {
  const config = getConfig();
  const xpNeeded = Math.floor(
    config.progression.baseXpPerLevel * 
    Math.pow(config.progression.xpMultiplier, player.level - 1)
  );
  
  if (player.xp >= xpNeeded) {
    player.level++;
    player.xp -= xpNeeded;
    
    // Increase stats
    player.maxHealth += config.progression.healthPerLevel;
    player.maxMana += config.progression.manaPerLevel;
    player.damage += config.progression.damagePerLevel;
    player.defense += config.progression.defensePerLevel;
    
    // Full restore on level up
    player.health = player.maxHealth;
    player.mana = player.maxMana;
    
    send(player, `Level up! You are now level ${player.level}!`, 'success');
    send(player, `Stats increased! Health: ${player.maxHealth}, Mana: ${player.maxMana}, Damage: ${player.damage}, Defense: ${player.defense}`, 'success');
    
    // Broadcast to location
    const location = getLocation(player);
    if (location) {
      for (const p of gameState.players.values()) {
        if (p.location === player.location && p.id !== player.id && p.socket) {
          send(p, `${player.username} has reached level ${player.level}!`, 'system');
        }
      }
    }
  }
}
