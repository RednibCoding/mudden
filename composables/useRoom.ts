import { ref, readonly } from 'vue'

// Types
export interface Room {
  id: string
  title: string
  description: string
  exits: Record<string, string>
  items?: any[]
  npcs?: any[]
  enemies?: string[]
}

export interface AreaData {
  name: string
  gridSize: { width: number; height: number }
  rooms: Record<string, Room>
}

export interface GridCell {
  x: number
  y: number
  isPlayer: boolean
  hasRoom: boolean
  isAccessible: boolean
  roomData: Room | null
}

export const useRoom = () => {
  // Room and area state
  const currentRoom = ref<Room | null>(null)
  const currentAreaId = ref<string>('town_area')
  const currentAreaData = ref<AreaData | null>(null)
  const areaGrid = ref<GridCell[]>([])

  // Generate area grid based on server map data with dynamic size
  const generateAreaGrid = (playerPosition: { x: number; y: number }): void => {
    const grid: GridCell[] = []
    const gridSize = currentAreaData.value?.gridSize || { width: 10, height: 10 }
    
    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        const coordKey = `${x},${y}`
        const hasRoom = currentAreaData.value?.rooms?.[coordKey] ? true : false
        const isAccessible = hasRoom // For now, only rooms are accessible
        
        grid.push({
          x,
          y,
          isPlayer: x === playerPosition.x && y === playerPosition.y,
          hasRoom,
          isAccessible,
          roomData: currentAreaData.value?.rooms?.[coordKey] || null
        })
      }
    }
    areaGrid.value = grid
  }

  // Get room title by room ID
  const getRoomTitle = (roomId: string): string => {
    if (!currentAreaData.value?.rooms) return roomId
    
    // Find room by ID in current area
    for (const [coord, room] of Object.entries(currentAreaData.value.rooms)) {
      if (room.id === roomId) {
        return room.title
      }
    }
    
    return roomId // fallback to ID if title not found
  }

  // Load area map data from server
  const loadAreaMap = async (areaId: string): Promise<void> => {
    try {
      const response = await $fetch(`/api/maps/${areaId}`) as { data: AreaData }
      currentAreaData.value = response.data
    } catch (error) {
      console.error('Error loading area map:', error)
      throw error
    }
  }

  // Load current room data from server
  const loadCurrentRoom = async (): Promise<any> => {
    try {
      const roomData = await $fetch('/api/player/room') as any
      
      if (roomData && roomData.id) {
        // Update area data if provided
        if (roomData.areaData) {
          currentAreaData.value = roomData.areaData as AreaData
        }
        
        // Set current room with server data (room data is at top level now)
        currentRoom.value = {
          id: roomData.id,
          title: roomData.title,
          description: roomData.description,
          items: roomData.items || [],
          npcs: roomData.npcs || [],
          enemies: roomData.enemies || [],
          exits: roomData.exits || {}
        } as Room
        
        return {
          location: roomData.location,
          areaId: roomData.location?.area
        }
      } else {
        currentRoom.value = null
        throw new Error("No room data found")
      }
    } catch (error) {
      console.error('Error loading room data:', error)
      throw error
    }
  }

  // Update current room
  const updateCurrentRoom = (room: Room): void => {
    currentRoom.value = room
  }

  // Update area data
  const updateAreaData = (areaData: AreaData): void => {
    currentAreaData.value = areaData
  }

  return {
    // State
    currentRoom: readonly(currentRoom),
    currentAreaId,
    currentAreaData: readonly(currentAreaData),
    areaGrid: readonly(areaGrid),
    
    // Actions
    generateAreaGrid,
    getRoomTitle,
    loadAreaMap,
    loadCurrentRoom,
    updateCurrentRoom,
    updateAreaData
  }
}