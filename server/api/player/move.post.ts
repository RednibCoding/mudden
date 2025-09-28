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

    const body = await readBody(event)
    const { direction } = body

    if (!direction) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Direction is required'
      })
    }

    // Normalize direction abbreviations
    const directionMap: { [key: string]: string } = {
      'n': 'north',
      's': 'south', 
      'e': 'east',
      'w': 'west'
    }
    const fullDirection = directionMap[direction] || direction

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

    // Get current area and room data
    const areaData = ContentService.getCompleteAreaData(currentLocation.current_area)
    if (!areaData) {
      throw createError({
        statusCode: 404,
        statusMessage: `Area data not found for area: ${currentLocation.current_area}`
      })
    }

    const currentCoord = `${currentLocation.position_x},${currentLocation.position_y}`
    const currentRoom = areaData.rooms[currentCoord]
    if (!currentRoom) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Current room not found'
      })
    }

    // Calculate available exits
    const gridSize = areaData.gridSize || { width: 10, height: 10 }
    const exits: { [key: string]: string } = {}
    const directions = [
      { dir: 'north', dx: 0, dy: -1 },
      { dir: 'south', dx: 0, dy: 1 },
      { dir: 'east', dx: 1, dy: 0 },
      { dir: 'west', dx: -1, dy: 0 }
    ]
    
    directions.forEach(({ dir, dx, dy }) => {
      const newX = currentLocation.position_x + dx
      const newY = currentLocation.position_y + dy
      
      if (newX >= 0 && newX < gridSize.width && newY >= 0 && newY < gridSize.height) {
        const coordKey = `${newX},${newY}`
        const adjacentRoom = areaData.rooms[coordKey]
        if (adjacentRoom) {
          exits[dir] = adjacentRoom.id
        }
      }
    })

    // Check if the requested direction is valid
    if (!exits[fullDirection]) {
      return {
        success: false,
        message: "You can't go that way.",
        currentLocation: {
          area: currentLocation.current_area,
          room: currentRoom,
          position: { x: currentLocation.position_x, y: currentLocation.position_y },
          exits
        }
      }
    }

    // Calculate new position
    let newX = currentLocation.position_x
    let newY = currentLocation.position_y

    switch (fullDirection) {
      case 'north':
        newY = Math.max(0, newY - 1)
        break
      case 'south':
        newY = Math.min(gridSize.height - 1, newY + 1)
        break
      case 'east':
        newX = Math.min(gridSize.width - 1, newX + 1)
        break
      case 'west':
        newX = Math.max(0, newX - 1)
        break
    }

    // Get the new room data
    const newCoord = `${newX},${newY}`
    const newRoom = areaData.rooms[newCoord]
    if (!newRoom) {
      return {
        success: false,
        message: "There's nothing in that direction.",
        currentLocation: {
          area: currentLocation.current_area,
          room: currentRoom,
          position: { x: currentLocation.position_x, y: currentLocation.position_y },
          exits
        }
      }
    }

    // Update player location in database
    await DatabaseService.updatePlayerLocation(
      session.playerId,
      newRoom.id,
      currentLocation.current_area,
      newX,
      newY
    )

    // Get enriched room data using shared function
    const enrichedNewRoom = await enrichRoom(
      newRoom.id,
      currentLocation.current_area,
      { x: newX, y: newY },
      session.playerId
    )

    // Log the movement
    await DatabaseService.logAction(
      session.playerId,
      'player_moved',
      `Moved ${fullDirection} to ${newRoom.title}`,
      {
        from_room: currentRoom.id,
        to_room: newRoom.id,
        direction: fullDirection,
        from_position: { x: currentLocation.position_x, y: currentLocation.position_y },
        to_position: { x: newX, y: newY }
      }
    )

    return {
      success: true,
      message: `You head ${fullDirection}...`,
      newLocation: {
        ...enrichedNewRoom,
        location: {
          area: currentLocation.current_area,
          position: { x: newX, y: newY }
        },
        areaData: areaData
      }
    }

  } catch (error: any) {
    console.error('Movement error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Movement failed'
    })
  }
})