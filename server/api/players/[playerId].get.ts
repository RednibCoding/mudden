import DatabaseService from '../../database/supabase'
import SessionService from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    const session = await SessionService.requireAuth(event)
    
    // Get the requested player ID from route params
    const playerId = getRouterParam(event, 'playerId')
    
    if (!playerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Player ID is required'
      })
    }
    
    // Authorization check - players can only access their own data
    if (session.playerId !== playerId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied - you can only access your own data'
      })
    }
    
    // Get player data with enriched inventory
    const player = await DatabaseService.getPlayerWithInventory(playerId)
    
    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    
    // Log the action for audit trail
    await DatabaseService.logAction(
      playerId,
      'player_data_accessed',
      `Player ${session.characterName} accessed their profile data`
    )
    
    return {
      success: true,
      data: player
    }
    
  } catch (error: any) {
    console.error('Error in GET /api/players/[playerId]:', error)
    
    // Re-throw known errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Internal server error'
    })
  }
})