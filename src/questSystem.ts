/**
 * Quest system logic
 */
import { Player, Quest } from './types';
import { gameState } from './gameState';
import { savePlayer } from './auth';
import { sendToPlayer } from './messaging';
import { meetsQuestPrerequisites, checkLevelUp, applyLevelUp } from './utils';

/**
 * Gets an available quest for an NPC that the player can accept
 */
export function getAvailableQuestForNPC(player: Player, npcId: string): Quest | null {
  const npc = gameState.npcs.get(npcId);
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  for (const questId of npc.quests) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    if (player.completedQuests.includes(questId)) continue;
    if (player.activeQuests[questId] !== undefined) continue;
    if (player.level < quest.levelRequirement) continue;

    if (quest.prerequisiteQuests.some(prereq => !player.completedQuests.includes(prereq))) {
      continue;
    }

    return quest;
  }

  return null;
}

/**
 * Gets a completed quest ready to be turned in at an NPC
 */
export function getCompletedQuestForNPC(player: Player, npcId: string): Quest | null {
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    if (quest.turnInNPC === npcId && progress >= quest.amount) {
      return quest;
    }
  }

  return null;
}

/**
 * Handles NPC quest progression and returns appropriate dialogue/action
 */
export function handleNPCQuestProgression(
  player: Player,
  npcId: string
): { message: string; quest: Quest; action: 'complete' | 'activate' | 'show' | 'inventory_full' } | null {
  const npc = gameState.npcs.get(npcId);

  // Fix for players with activeQuests as array
  if (Array.isArray(player.activeQuests)) {
    player.activeQuests = {};
  }

  // Check if NPC is turnInNPC for active quests
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest || quest.turnInNPC !== npcId) continue;

    if (quest.type === 'visit') {
      return { message: quest.rewardDialogue, quest, action: 'complete' };
    }

    if (quest.type === 'kill' && progress >= quest.amount) {
      return { message: quest.rewardDialogue, quest, action: 'complete' };
    }

    if (quest.type === 'collect') {
      const itemCount = player.inventory.filter(item => item.id === quest.target).length;
      if (itemCount >= quest.amount) {
        if (!checkInventorySpaceForReward(player, quest, quest.amount)) {
          return {
            message: `I can see you have the items I need, but you don't have enough space in your inventory for your reward!`,
            quest,
            action: 'inventory_full'
          };
        }
        return { message: quest.rewardDialogue, quest, action: 'complete' };
      }
    }
  }

  // Quest progression for NPCs with quests
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  for (let i = 0; i < npc.quests.length; i++) {
    const questId = npc.quests[i];
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    const isCompleted = player.completedQuests.includes(questId);
    const isActive = player.activeQuests[questId] !== undefined;

    if (isCompleted) {
      const nextQuestIndex = i + 1;
      if (nextQuestIndex < npc.quests.length) {
        const nextQuest = gameState.quests.get(npc.quests[nextQuestIndex]);
        if (!nextQuest) continue;

        const nextIsActive = player.activeQuests[nextQuest.id] !== undefined;

        if (nextIsActive) {
          return { message: nextQuest.questDialogue, quest: nextQuest, action: 'show' };
        }

        if (canActivateQuest(player, nextQuest)) {
          return { message: nextQuest.questDialogue, quest: nextQuest, action: 'activate' };
        }
      }
      continue;
    }

    if (isActive) {
      const progress = player.activeQuests[questId] || 0;

      if (quest.type === 'visit' && quest.turnInNPC === npcId) {
        if (!checkInventorySpaceForReward(player, quest, 0)) {
          return {
            message: `I have your reward ready, but you don't have enough space in your inventory!`,
            quest,
            action: 'inventory_full'
          };
        }
        return { message: quest.rewardDialogue, quest, action: 'complete' };
      }

      if (progress >= quest.amount) {
        if (!checkInventorySpaceForReward(player, quest, 0)) {
          return {
            message: `I have your reward ready, but you don't have enough space in your inventory!`,
            quest,
            action: 'inventory_full'
          };
        }
        return { message: quest.rewardDialogue, quest, action: 'complete' };
      }

      return { message: quest.questDialogue, quest, action: 'show' };
    }

    if (canActivateQuest(player, quest)) {
      return { message: quest.questDialogue, quest, action: 'activate' };
    }

    return null;
  }

  return null;
}

/**
 * Checks if a player can activate a quest
 */
function canActivateQuest(player: Player, quest: Quest): boolean {
  return player.level >= quest.levelRequirement &&
    !quest.prerequisiteQuests.some(prereq => !player.completedQuests.includes(prereq));
}

/**
 * Checks if player has inventory space for quest rewards
 */
function checkInventorySpaceForReward(player: Player, quest: Quest, itemsBeingRemoved: number): boolean {
  const rewardItemCount = quest.reward.items ? quest.reward.items.length : 0;
  if (rewardItemCount === 0) return true;

  const maxSlots = gameState.defaults.player.maxInventorySlots;
  const currentSlots = player.inventory.length;
  const slotsAfterRemoval = currentSlots - itemsBeingRemoved;
  const availableSlots = maxSlots - slotsAfterRemoval;

  return availableSlots >= rewardItemCount;
}

/**
 * Checks for follow-up quest after completing a quest
 */
export function checkForFollowUpQuest(player: Player, npcId: string, completedQuestId: string): Quest | null {
  const npc = gameState.npcs.get(npcId);
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  for (const questId of npc.quests) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    if (player.completedQuests.includes(questId)) continue;
    if (player.activeQuests[questId] !== undefined) continue;
    if (player.level < quest.levelRequirement) continue;

    if (quest.prerequisiteQuests.includes(completedQuestId)) {
      if (!quest.prerequisiteQuests.some(prereq =>
        prereq !== completedQuestId && !player.completedQuests.includes(prereq)
      )) {
        return quest;
      }
    }
  }

  return null;
}

/**
 * Activates a quest for a player
 */
export function activateQuest(player: Player, quest: Quest): void {
  player.activeQuests[quest.id] = 0;
  savePlayer(player);
}

/**
 * Completes a quest and awards rewards
 */
export function completeQuest(player: Player, quest: Quest): void {
  // Remove collected items first for collect quests
  if (quest.type === 'collect') {
    let itemsToRemove = quest.amount;
    player.inventory = player.inventory.filter(item => {
      if (item.id === quest.target && itemsToRemove > 0) {
        itemsToRemove--;
        return false;
      }
      return true;
    });
  }

  delete player.activeQuests[quest.id];
  player.completedQuests.push(quest.id);

  player.gold += quest.reward.gold;
  player.experience += quest.reward.experience;

  const newLevel = checkLevelUp(player);
  if (newLevel > player.level) {
    applyLevelUp(player, newLevel);
  }

  if (quest.reward.items && quest.reward.items.length > 0) {
    quest.reward.items.forEach(itemId => {
      const item = gameState.items.get(itemId);
      if (item) {
        player.inventory.push({ ...item });
      }
    });
  }

  savePlayer(player);
}

/**
 * Updates quest progress for a player
 */
export function updateQuestProgress(player: Player, questType: string, target: string, playerName: string): void {
  for (const [questId, currentProgress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    if (quest.type === questType && quest.target === target) {
      const newProgress = currentProgress + 1;
      player.activeQuests[questId] = newProgress;

      if (newProgress >= quest.amount && quest.killCompleteMessage) {
        const npcName = gameState.npcs.get(quest.turnInNPC)?.name || quest.turnInNPC;
        sendToPlayer(playerName, {
          type: 'message',
          data: { text: `${quest.killCompleteMessage} Return to ${npcName} to claim your reward.`, type: 'system' }
        });
      }
    }
  }
}
