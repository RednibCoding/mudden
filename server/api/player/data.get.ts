import SessionService from '../../utils/session'
import DatabaseService from '../../database/supabase'

export default defineEventHandler(async (event) => {
  try {
    // Verify session and get player ID
    const session = await SessionService.getUserSession(event)
    
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated'
      })
    }

    // Get player data with inventory
    const playerData = await DatabaseService.getPlayerWithInventory(session.playerId)
    if (!playerData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }

    // Get player location
    let location = null
    try {
      location = await DatabaseService.getPlayerLocation(session.playerId)
    } catch (error) {
      console.log('No player location found, will create default')
    }

    // If no location exists, create default location
    if (!location) {
      location = await DatabaseService.createPlayerLocation(session.playerId, 'town_square', 'town_area', 1, 0)
    }

    return {
      id: playerData.id,
      name: playerData.character_name,
      email: playerData.email,
      health: playerData.health,
      maxHealth: playerData.max_health,
      level: playerData.level,
      experience: playerData.experience,
      gold: playerData.gold,
      currentRoom: location.current_room,
      currentArea: location.current_area,
      position: { x: location.position_x, y: location.position_y },
      inventory: playerData.inventory || []
    }
    
  } catch (error: any) {
    console.error('Error loading player data:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load player data'
    })
  }
})