/**
 * NPC interaction commands (talk)
 */
import { Player } from '../types';
import { gameState } from '../gameState';
import { sendToLocation } from '../messaging';
import { handleNPCQuestProgression, activateQuest, completeQuest, checkForFollowUpQuest } from '../questSystem';
import { savePlayer } from '../auth';

/**
 * Handles talk command - interacts with NPCs
 */
export function handleTalkCommand(socket: any, player: Player, npcName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return;
  }

  // Find NPC in current location
  let targetNPC = null;
  let targetNPCId = null;
  for (const npcId of location.npcs) {
    const npc = gameState.npcs.get(npcId);
    if (npc && npc.name.toLowerCase().includes(npcName.toLowerCase())) {
      targetNPC = npc;
      targetNPCId = npcId;
      break;
    }
  }

  if (!targetNPC || !targetNPCId) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `There is no one named "${npcName}" here to talk to.`, type: 'system' } 
    });
    return;
  }

  // Handle quest progression for this NPC
  const questResult = handleNPCQuestProgression(player, targetNPCId);
  if (questResult) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `${targetNPC.name} says: "${questResult.message}"`, type: 'dialogue' } 
    });

    if (questResult.action === 'inventory_full') {
      // Don't complete quest - inventory is full
      
    } else if (questResult.action === 'complete') {
      completeQuest(player, questResult.quest);
      
      // Show reward message
      let rewardMessage = `Quest completed: ${questResult.quest.name}!`;
      const rewards = [];
      
      if (questResult.quest.reward.gold > 0) {
        rewards.push(`${questResult.quest.reward.gold} gold`);
      }
      if (questResult.quest.reward.experience > 0) {
        rewards.push(`${questResult.quest.reward.experience} experience`);
      }
      
      if (questResult.quest.reward.items && questResult.quest.reward.items.length > 0) {
        questResult.quest.reward.items.forEach(itemId => {
          const item = gameState.items.get(itemId);
          if (item) {
            rewards.push(`${item.name}`);
          }
        });
      }
      
      if (rewards.length > 0) {
        rewardMessage += ` You got ${rewards.join(', ')}!`;
      }

      socket.emit('message', { type: 'message', data: { text: rewardMessage, type: 'success' } });
      
      // Check for follow-up quest
      const followUpQuest = checkForFollowUpQuest(player, targetNPCId, questResult.quest.id);
      if (followUpQuest) {
        activateQuest(player, followUpQuest);
        socket.emit('message', { 
          type: 'message', 
          data: { text: `${targetNPC.name} says: "${followUpQuest.questDialogue}"`, type: 'dialogue' } 
        });
      }
      
    } else if (questResult.action === 'activate') {
      activateQuest(player, questResult.quest);
    }

    sendToLocation(player.location, { 
      type: 'message', 
      data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
    }, player.username);

    return;
  }

  // No quest-related dialogue, use regular NPC dialogue
  if (!targetNPC.dialogue || targetNPC.dialogue.length === 0) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `${targetNPC.name} doesn't seem to have anything to say.`, type: 'system' } 
    });
    return;
  }

  const randomDialogue = targetNPC.dialogue[Math.floor(Math.random() * targetNPC.dialogue.length)];

  socket.emit('message', { 
    type: 'message', 
    data: { text: `${targetNPC.name} says: "${randomDialogue}"`, type: 'dialogue' } 
  });

  // Check if this is a healer NPC
  if (targetNPC.healer) {
    if (player.health < player.maxHealth) {
      const healingAmount = player.maxHealth - player.health;
      player.health = player.maxHealth;
      savePlayer(player);
      
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${targetNPC.name} channels healing energy into you, restoring ${healingAmount} health!`, type: 'info' } 
      });
      
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${targetNPC.name} heals ${player.username} with magical energy.`, type: 'info' } 
      }, player.username);
    } else {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${targetNPC.name} nods approvingly. "You are already at full health, adventurer."`, type: 'info' } 
      });
      
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
      }, player.username);
    }
  } else {
    sendToLocation(player.location, { 
      type: 'message', 
      data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
    }, player.username);
  }
}
