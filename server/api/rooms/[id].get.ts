import ContentService from '../../database/content'
import { enrichRoom } from '../../utils/roomEnrichment'

export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, 'id')
  const areaId = getQuery(event).area as string
  
  if (!roomId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Room ID is required'
    })
  }

  if (!areaId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Area ID is required as query parameter'
    })
  }
  
  try {
    // Get enriched room data (no player filtering, no exit calculation without position)
    const enrichedRoomData = await enrichRoom(roomId, areaId)
    
    return {
      success: true,
      data: enrichedRoomData
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get room data'
    })
  }
})