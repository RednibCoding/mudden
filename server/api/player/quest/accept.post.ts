import { DatabaseService } from '../../../database/supabase'
import { ContentService } from '../../../database/content'

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

    // Check if player meets requirements
    const meetsRequirements = await checkQuestRequirements(player, quest, playerId)
    if (!meetsRequirements) {
      let errorMsg = 'You do not meet the requirements for this quest'
      
      // Provide specific error messages
      if (quest.levelRequired && player.level < quest.levelRequired) {
        errorMsg = `You need to be at least level ${quest.levelRequired} to accept this quest`
      } else if (quest.requirements?.level && player.level < quest.requirements.level) {
        errorMsg = `You need to be at least level ${quest.requirements.level} to accept this quest`
      } else if (quest.requirements?.completedQuests) {
        errorMsg = 'You need to complete other quests first'
      }
      
      return { 
        success: false, 
        message: errorMsg
      }
    }

    // Check if already active
    const activeQuests = await DatabaseService.getPlayerQuests(playerId, 'active')
    if (activeQuests.some((q: any) => q.quest_id === questId)) {
      return { 
        success: false, 
        message: 'You have already accepted this quest.' 
      }
    }

    // Check if already completed and not repeatable
    if (!quest.repeatable) {
      const completionCount = await DatabaseService.getQuestCompletionCount(playerId, questId)
      if (completionCount > 0) {
        return { 
          success: false, 
          message: 'You have already completed this quest.' 
        }
      }
    }

    // Accept the quest
    await DatabaseService.startQuest(playerId, questId)

    // Log the action
    await DatabaseService.logAction(playerId, 'quest_accepted', `Accepted quest: ${quest.title}`, { questId })

    return { 
      success: true, 
      message: `Quest accepted: ${quest.title}`,
      quest: {
        id: quest.id,
        title: quest.title,
        description: quest.questText,
        objectives: quest.objectives
      }
    }

  } catch (error: any) {
    console.error('Quest accept error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to accept quest'
    })
  }
})