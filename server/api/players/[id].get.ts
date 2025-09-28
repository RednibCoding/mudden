import DatabaseService from '../../database/supabase'

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  
  if (!playerId || isNaN(Number(playerId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid player ID is required'
    })
  }

  try {
    const player = await DatabaseService.getPlayerWithInventory(playerId)
    
    if (!player) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    return {
      success: true,
      data: player
    }
  } catch (error: any) {
    console.error('Error fetching player:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch player data'
    })
  }
})