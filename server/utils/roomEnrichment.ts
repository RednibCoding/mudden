import ContentService from '../database/content'
import DatabaseService from '../database/supabase'

export interface EnrichedRoom {
  id: string
  title: string
  description: string
  items: Array<{
    id: string
    name: string
    description: string
    canTake: boolean
  }>
  npcs: Array<{
    id: string
    name: string
    description: string
    hostile: boolean
  }>
  enemies: string[]
  exits: { [key: string]: string }
}

export interface PlayerLocationInfo {
  area: string
  position: { x: number, y: number }
}

export interface EnrichedRoomResponse {
  id: string
  title: string
  description: string
  items: Array<{
    id: string
    name: string
    description: string
    canTake: boolean
  }>
  npcs: Array<{
    id: string
    name: string
    description: string
    hostile: boolean
  }>
  enemies: string[]
  exits: { [key: string]: string }
  location?: PlayerLocationInfo
  areaData?: any
}

/**
 * Enriches room data with full item and NPC objects, calculates exits
 * @param roomId - The room ID to enrich
 * @param areaId - The area ID containing the room
 * @param playerPosition - Optional player position for exit calculation
 * @param playerId - Optional player ID for item filtering (taken items)
 */
export async function enrichRoom(
  roomId: string,
  areaId: string,
  playerPosition?: { x: number, y: number },
  playerId?: string
): Promise<EnrichedRoom> {
  // Get complete area data for room lookup and exit calculation
  const areaData = ContentService.getCompleteAreaData(areaId)
  if (!areaData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Area data not found'
    })
  }

  // Find the room in the area
  let currentRoom = null
  let roomCoord = null

  if (playerPosition) {
    // Use player position to find room
    roomCoord = `${playerPosition.x},${playerPosition.y}`
    currentRoom = areaData.rooms[roomCoord]
  } else {
    // Search for room by ID in the area
    for (const [coord, room] of Object.entries(areaData.rooms)) {
      if (room.id === roomId) {
        currentRoom = room
        roomCoord = coord
        break
      }
    }
  }

  if (!currentRoom) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Room not found'
    })
  }

  // Calculate available exits if we have position info
  const exits: { [key: string]: string } = {}
  if (roomCoord && playerPosition) {
    const gridSize = areaData.gridSize || { width: 10, height: 10 }
    const directions = [
      { dir: 'north', dx: 0, dy: -1 },
      { dir: 'south', dx: 0, dy: 1 },
      { dir: 'east', dx: 1, dy: 0 },
      { dir: 'west', dx: -1, dy: 0 }
    ]
    
    directions.forEach(({ dir, dx, dy }) => {
      const newX = playerPosition.x + dx
      const newY = playerPosition.y + dy
      
      if (newX >= 0 && newX < gridSize.width && newY >= 0 && newY < gridSize.height) {
        const coordKey = `${newX},${newY}`
        const adjacentRoom = areaData.rooms[coordKey]
        if (adjacentRoom) {
          exits[dir] = adjacentRoom.id
        }
      }
    })
  }

  // Filter out items that have already been taken by this player (if playerId provided)
  let availableItems: string[] = []
  if (currentRoom.items && currentRoom.items.length > 0) {
    if (playerId) {
      // Filter out taken items for specific player
      for (const itemId of currentRoom.items) {
        const alreadyTaken = await DatabaseService.isItemTakenFromRoom(
          playerId,
          roomId,
          itemId
        )
        if (!alreadyTaken) {
          availableItems.push(itemId)
        }
      }
    } else {
      // No player filtering - show all items
      availableItems = [...currentRoom.items]
    }
  }

  // Get enriched item data for available items
  const enrichedItems = availableItems.map(itemId => {
    const itemData = ContentService.getItem(itemId)
    return itemData ? {
      id: itemData.id,
      name: itemData.name,
      description: itemData.description,
      canTake: itemData.canTake !== false
    } : null
  }).filter(item => item !== null)

  // Get enriched NPC data for room NPCs
  const enrichedNpcs = []
  if (currentRoom.npcs && Array.isArray(currentRoom.npcs)) {
    for (const npcId of currentRoom.npcs) {
      const npcData = ContentService.getNPC(npcId)
      if (npcData) {
        enrichedNpcs.push({
          id: npcData.id,
          name: npcData.name,
          description: npcData.description,
          hostile: npcData.hostile || false
        })
      }
    }
  }

  return {
    id: currentRoom.id,
    title: currentRoom.title,
    description: currentRoom.description,
    items: enrichedItems,
    npcs: enrichedNpcs,
    enemies: currentRoom.enemies || [],
    exits
  }
}