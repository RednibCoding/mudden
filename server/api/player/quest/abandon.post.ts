import { DatabaseService } from '../../../database/supabase'
import { ContentService } from '../../../database/content'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { playerId, questId } = body

    if (!playerId || !questId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID and Quest ID are required'
      })
    }

    // Get the quest details
    const quest = ContentService.getQuest(questId)
    if (!quest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Quest not found'
      })
    }

    // Get the player data
    const player = await DatabaseService.getPlayerById(playerId)
    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Check if the quest is currently active
    const activeQuests = await DatabaseService.getPlayerQuests(playerId, 'active')
    const activeQuest = activeQuests.find((q: any) => q.quest_id === questId)
    
    if (!activeQuest) {
      return { 
        success: false, 
        message: 'You are not currently on this quest.' 
      }
    }

    // Abandon the quest (delete from player_quests table)
    await DatabaseService.abandonQuest(playerId, questId)

    // Log the action
    await DatabaseService.logAction(playerId, 'quest_abandoned', `Abandoned quest: ${quest.title}`, { questId })

    return { 
      success: true, 
      message: `You have abandoned the quest: ${quest.title}`,
      quest: {
        id: quest.id,
        title: quest.title
      }
    }

  } catch (error: any) {
    console.error('Quest abandon error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to abandon quest'
    })
  }
})