import SessionService from '../../utils/session'
import { DatabaseService } from '../../database/supabase'
import { ContentService } from '../../database/content'

// Helper function to check if player meets quest requirements
async function checkQuestRequirements(player: any, quest: any, playerId: string): Promise<boolean> {
  // Check level requirement (backward compatibility)
  if (quest.levelRequired && player.level < quest.levelRequired) {
    return false
  }
  
  // Check new requirements structure
  if (quest.requirements) {
    // Check level requirement in new structure
    if (quest.requirements.level && player.level < quest.requirements.level) {
      return false
    }
    
    // Check completed quest requirements
    if (quest.requirements.completedQuests && quest.requirements.completedQuests.length > 0) {
      for (const requiredQuestId of quest.requirements.completedQuests) {
        const completionCount = await DatabaseService.getQuestCompletionCount(playerId, requiredQuestId)
        if (completionCount === 0) {
          return false // Required quest not completed
        }
      }
    }
  }
  
  return true
}

export default defineEventHandler(async (event) => {
  try {
    // Verify session
    const session = await SessionService.requireAuth(event)
    const playerId = session.playerId

    const body = await readBody(event)
    const { npcId, npcName, topic } = body

    if ((!npcId && !npcName) || !topic) {
      return {
        success: false,
        message: 'NPC ID/name and topic are required'
      }
    }

    // Get current player location to check NPCs
    const currentLocation = await DatabaseService.getPlayerLocation(playerId)
    if (!currentLocation) {
      return {
        success: false,
        message: 'Unable to determine your location'
      }
    }

    // Get room data with NPCs using new area system
    const roomData = ContentService.getAreaRoom(currentLocation.current_area, currentLocation.current_room)
    if (!roomData || !roomData.npcs || roomData.npcs.length === 0) {
      return {
        success: false,
        message: 'There is no one here to talk to'
      }
    }

    let targetNpc: any = null

    if (npcId) {
      // Direct lookup by ID (more efficient when client sends exact ID)
      if (roomData.npcs && roomData.npcs.includes(npcId)) {
        targetNpc = ContentService.getNPC(npcId)
        if (!targetNpc) {
          return {
            success: false,
            message: `NPC not found`
          }
        }
      } else {
        return {
          success: false,
          message: `That NPC is not here`
        }
      }
    } else {
      // Fallback: fuzzy matching by name (for backward compatibility)
      const npcIds = roomData.npcs
      const npcs = npcIds.map((id: string) => {
        const npc = ContentService.getNPC(id)
        return npc ? { ...npc, searchName: npc.name } : null
      }).filter(Boolean)

      // Simple fuzzy matching for NPC names
      targetNpc = npcs.find((npc: any) => 
        npc.name.toLowerCase().includes(npcName!.toLowerCase()) ||
        npc.id.toLowerCase().includes(npcName!.toLowerCase())
      )

      if (!targetNpc) {
        return {
          success: false,
          message: `There is no "${npcName}" here to talk to`
        }
      }
    }

    // Get dialogue data
    const dialogue = targetNpc.dialogue
    if (!dialogue || !dialogue.responses) {
      return {
        success: false,
        message: `${targetNpc.name} doesn't seem to know about that`
      }
    }

    // Find the response for this topic (with fuzzy matching)
    const topicLower = topic.toLowerCase()
    const availableTopics = Object.keys(dialogue.responses)
    
    // Try exact match first
    let matchedTopic = availableTopics.find(t => t.toLowerCase() === topicLower)
    
    // If no exact match, try partial match
    if (!matchedTopic) {
      matchedTopic = availableTopics.find(t => 
        t.toLowerCase().includes(topicLower) || topicLower.includes(t.toLowerCase())
      )
    }

    // Special handling for "quests" topic
    if (matchedTopic === 'quests') {
      let questsInfo = ""
      let availableQuests: any[] = []
      
      // Get available quests from this NPC
      const npcData = targetNpc as any
      if (npcData.quests && npcData.quests.length > 0) {
        const player = await DatabaseService.getPlayerById(playerId)
        if (player) {
          
          for (const questId of npcData.quests) {
            const quest = ContentService.getQuest(questId)
            if (quest) {
              // Check if player meets requirements
              const meetsRequirements = await checkQuestRequirements(player, quest, playerId)
              if (meetsRequirements) {
                // Check if quest is already active
                const activeQuests = await DatabaseService.getPlayerQuests(playerId, 'active')
                const isActive = activeQuests.some((q: any) => q.quest_id === questId)
                
                if (!isActive) {
                  // Check if already completed and not repeatable
                  if (quest.repeatable) {
                    availableQuests.push(quest)
                  } else {
                    const completionCount = await DatabaseService.getQuestCompletionCount(playerId, questId)
                    if (completionCount === 0) {
                      availableQuests.push(quest)
                    }
                  }
                }
              }
            }
          }
          
          if (availableQuests.length > 0) {
            questsInfo += "\n\nAvailable quests:"
            for (let i = 0; i < availableQuests.length; i++) {
              const quest = availableQuests[i]
              questsInfo += `\n${i + 1}. ${quest.title} - Level ${quest.levelRequired}`
              questsInfo += `\n   ${quest.questText}`
              questsInfo += `\n   Reward: ${quest.rewards.gold} gold, ${quest.rewards.xp} XP`
              if (quest.rewards.items && quest.rewards.items.length > 0) {
                // Convert item IDs to item names
                const itemNames = quest.rewards.items.map((itemId: string) => {
                  const item = ContentService.getItem(itemId)
                  return item ? item.name : itemId
                })
                questsInfo += `, items: ${itemNames.join(', ')}`
              }
              questsInfo += `\n`
            }
          } else {
            questsInfo += "\n\nI have no quests available for you right now."
          }
        }
      }
      
      // Log the action
      await DatabaseService.logAction(playerId, 'ask_npc', `Asked ${targetNpc.name} about quests`, { 
        npcId: targetNpc.id, 
        npcName: targetNpc.name,
        topic: 'quests'
      })
      
      return {
        success: true,
        npc: {
          id: targetNpc.id,
          name: targetNpc.name
        },
        topic: 'quests',
        response: questsInfo,
        availableQuests: availableQuests.map((quest, index) => ({
          index: index + 1,
          id: quest.id,
          title: quest.title
        }))
      }
    }

    if (!matchedTopic || !dialogue.responses[matchedTopic]) {
      // Check if this is the "quests" topic and the NPC has quests
      if (topicLower === 'quests') {
        const npcData = targetNpc as any
        if (npcData.quests && npcData.quests.length > 0) {
          // Handle quests topic even if not in dialogue responses
          const player = await DatabaseService.getPlayerById(playerId)
          let availableQuests: any[] = []
          
          if (player) {
            for (const questId of npcData.quests) {
              const quest = ContentService.getQuest(questId)
              if (quest) {
                // Check if player meets requirements
                const meetsRequirements = await checkQuestRequirements(player, quest, playerId)
                if (meetsRequirements) {
                  // Check if quest is already active
                  const activeQuests = await DatabaseService.getPlayerQuests(playerId, 'active')
                  const isActive = activeQuests.some((q: any) => q.quest_id === questId)
                  
                  if (!isActive) {
                    // Check if already completed and not repeatable
                    if (quest.repeatable) {
                      availableQuests.push(quest)
                    } else {
                      const completionCount = await DatabaseService.getQuestCompletionCount(playerId, questId)
                      if (completionCount === 0) {
                        availableQuests.push(quest)
                      }
                    }
                  }
                }
              }
            }
          }
          
          let questsInfo = ""
          if (availableQuests.length > 0) {
            questsInfo += "Available quests:"
            for (let i = 0; i < availableQuests.length; i++) {
              const quest = availableQuests[i]
              questsInfo += `\n${i + 1}. ${quest.title} - Level ${quest.levelRequired || quest.requirements?.level || 1}`
              questsInfo += `\n   ${quest.questText}`
              questsInfo += `\n   Reward: ${quest.rewards.gold} gold, ${quest.rewards.xp} XP`
              if (quest.rewards.items && quest.rewards.items.length > 0) {
                // Convert item IDs to item names
                const itemNames = quest.rewards.items.map((itemId: string) => {
                  const item = ContentService.getItem(itemId)
                  return item ? item.name : itemId
                })
                questsInfo += `, items: ${itemNames.join(', ')}`
              }
              questsInfo += `\n`
            }
          } else {
            questsInfo += "I have no quests available for you right now."
          }
          
          // Log the action
          await DatabaseService.logAction(playerId, 'ask_npc', `Asked ${targetNpc.name} about quests`, { 
            npcId: targetNpc.id, 
            npcName: targetNpc.name,
            topic: 'quests'
          })
          
          return {
            success: true,
            npc: {
              id: targetNpc.id,
              name: targetNpc.name
            },
            topic: 'quests',
            response: questsInfo,
            availableQuests: availableQuests.map((quest, index) => ({
              index: index + 1,
              id: quest.id,
              title: quest.title
            }))
          }
        }
      }
      
      // Build the available topics list, including "quests" if NPC has quests
      let allAvailableTopics = availableTopics.filter(t => t !== 'bye')
      const npcData = targetNpc as any
      if (npcData.quests && npcData.quests.length > 0 && !allAvailableTopics.includes('quests')) {
        allAvailableTopics.push('quests')
      }
      
      const topicsList = allAvailableTopics.join(', ')
      return {
        success: false,
        message: `${targetNpc.name} doesn't know about "${topic}". Try asking about: ${topicsList}`
      }
    }

    // Log the action
    await DatabaseService.logAction(playerId, 'ask_npc', `Asked ${targetNpc.name} about ${matchedTopic}`, { 
      npcId: targetNpc.id, 
      npcName: targetNpc.name,
      topic: matchedTopic
    })

    return {
      success: true,
      npc: {
        id: targetNpc.id,
        name: targetNpc.name
      },
      topic: matchedTopic,
      response: dialogue.responses[matchedTopic]
    }

  } catch (error) {
    console.error('Ask NPC error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    return {
      success: false,
      message: 'Failed to ask NPC. Please try again.'
    }
  }
})