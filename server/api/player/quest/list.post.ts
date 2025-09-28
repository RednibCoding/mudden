import { DatabaseService } from '../../../database/supabase'
import { ContentService } from '../../../database/content'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { playerId } = body

    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }

    // Get all active quests
    const activeQuests = await DatabaseService.getPlayerQuests(playerId, 'active')
    
    // Get completed quests count for display
    const completedQuests = await DatabaseService.getPlayerQuests(playerId, 'completed')

    return { 
      success: true,
      activeQuests: activeQuests.map((quest: any) => {
        const questData = ContentService.getQuest(quest.quest_id)
        return {
          id: quest.quest_id,
          title: questData?.title || quest.quest_id,
          status: quest.status,
          progress: quest.progress,
          objectives: questData?.objectives,
          startedAt: quest.started_at
        }
      }),
      completedCount: completedQuests.length
    }

  } catch (error: any) {
    console.error('Quest list error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get quest list'
    })
  }
})