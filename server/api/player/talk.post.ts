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
    const { npcId, npcName } = body

    // Accept either npcId (preferred) or npcName (fallback)
    if (!npcId && !npcName) {
      return {
        success: false,
        message: 'NPC ID or name is required'
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
    if (!dialogue) {
      return {
        success: false,
        message: `${targetNpc.name} doesn't seem interested in talking`
      }
    }

    // Get available topics (response keys)
    const topics = dialogue.responses ? Object.keys(dialogue.responses).filter(key => key !== 'bye') : []

    // Check for available quests from this NPC
    let availableQuests: any[] = []
    const npcData = targetNpc as any // Cast to any to access quests property
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
                  availableQuests.push({
                    id: quest.id,
                    title: quest.title,
                    levelRequired: quest.levelRequired || quest.requirements?.level || 1
                  })
                } else {
                  const completionCount = await DatabaseService.getQuestCompletionCount(playerId, questId)
                  if (completionCount === 0) {
                    availableQuests.push({
                      id: quest.id,
                      title: quest.title,
                      levelRequired: quest.levelRequired || quest.requirements?.level || 1
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    // Add "quests" to topics only if this NPC has available quests for the player
    if (availableQuests.length > 0 && !topics.includes('quests')) {
      topics.push('quests')
    }

    // Log the action
    await DatabaseService.logAction(playerId, 'talk_npc', `Talked to ${targetNpc.name}`, { 
      npcId: targetNpc.id, 
      npcName: targetNpc.name
    })

    return {
      success: true,
      npc: {
        id: targetNpc.id,
        name: targetNpc.name
      },
      dialogue: {
        greeting: dialogue.greeting || `${targetNpc.name} nods at you.`,
        topics: topics
      },
      availableQuests: availableQuests
    }

  } catch (error) {
    console.error('Talk NPC error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    return {
      success: false,
      message: 'Failed to talk to NPC. Please try again.'
    }
  }
})