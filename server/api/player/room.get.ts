import SessionService from '../../utils/session'
import DatabaseService from '../../database/supabase'
import ContentService from '../../database/content'
import { enrichRoom } from '../../utils/roomEnrichment'

export default defineEventHandler(async (event) => {
  try {
    // Verify session
    const session = await SessionService.getUserSession(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated'
      })
    }

    // Get current player location
    let currentLocation = null
    try {
      currentLocation = await DatabaseService.getPlayerLocation(session.playerId)
    } catch (error) {
      console.log('No player location found, will create default')
    }

    // If no location exists, create default location
    if (!currentLocation) {
      currentLocation = await DatabaseService.createPlayerLocation(session.playerId, 'town_square', 'town_area', 1, 0)
    }

    // Get enriched room data using shared function
    const enrichedRoomData = await enrichRoom(
      currentLocation.current_room,
      currentLocation.current_area,
      { x: currentLocation.position_x, y: currentLocation.position_y },
      session.playerId
    )

    // Get area data for client
    const areaData = ContentService.getCompleteAreaData(currentLocation.current_area)

    return {
      ...enrichedRoomData,
      
      // Player location info
      location: {
        area: currentLocation.current_area,
        position: { x: currentLocation.position_x, y: currentLocation.position_y }
      },
      
      // Full area data for map/navigation
      areaData
    }

  } catch (error: any) {
    console.error('Room data error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get room data'
    })
  }
})