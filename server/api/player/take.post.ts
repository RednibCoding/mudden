import SessionService from '../../utils/session'
import DatabaseService from '../../database/supabase'
import ContentService from '../../database/content'

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
    const { itemId, itemName } = body

    // Accept either itemId (preferred) or itemName (fallback)
    if (!itemId && !itemName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item ID or name is required'
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

    // Get current area and room data
    const areaData = ContentService.getCompleteAreaData(currentLocation.current_area)
    if (!areaData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Area data not found'
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

    // Check if room has items
    if (!currentRoom.items || currentRoom.items.length === 0) {
      return {
        success: false,
        message: "There are no items here to take."
      }
    }

    let foundItem: string | undefined

    if (itemId) {
      // Direct lookup by ID (more efficient when client sends exact ID)
      foundItem = currentRoom.items.find((id: string) => id === itemId)
      if (!foundItem) {
        return {
          success: false,
          message: `That item is not available here.`
        }
      }
    } else {
      // Fallback: Find the item by name (case-insensitive, partial match)
      const normalizedItemName = itemName!.toLowerCase().trim()
      foundItem = currentRoom.items.find((id: string) => {
        const itemData = ContentService.getItem(id)
        if (!itemData) return false
        
        return itemData.id.toLowerCase().includes(normalizedItemName) ||
               itemData.name.toLowerCase().includes(normalizedItemName)
      })

      if (!foundItem) {
        return {
          success: false,
          message: `You don't see a '${itemName}' here.`
        }
      }
    }

    // Get item data to check if it can be taken
    const itemData = ContentService.getItem(foundItem)
    if (!itemData) {
      return {
        success: false,
        message: `The '${itemName}' seems to have vanished.`
      }
    }

    if (itemData.canTake === false) {
      return {
        success: false,
        message: `You can't take the ${itemData.name}.`
      }
    }

    // Check if item has already been taken from this room
    const alreadyTaken = await DatabaseService.isItemTakenFromRoom(
      session.playerId,
      currentLocation.current_room,
      foundItem
    )

    if (alreadyTaken) {
      return {
        success: false,
        message: `The ${itemData.name} is no longer here.`
      }
    }

    // Add item to player's inventory
    await DatabaseService.addToInventory(session.playerId, foundItem, 1)

    // Mark item as taken from this room
    await DatabaseService.markItemTakenFromRoom(
      session.playerId,
      currentLocation.current_room,
      foundItem
    )

    // Log the action
    await DatabaseService.logAction(
      session.playerId,
      'item_taken',
      `Took ${itemData.name} from ${currentRoom.title}`,
      {
        item_id: foundItem,
        item_name: itemData.name,
        room_id: currentLocation.current_room,
        room_title: currentRoom.title
      }
    )

    return {
      success: true,
      message: `You take the ${itemData.name}.`,
      item: {
        id: itemData.id,
        name: itemData.name,
        description: itemData.description
      }
    }

  } catch (error: any) {
    console.error('Take item error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to take item'
    })
  }
})