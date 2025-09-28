import { ref, readonly } from 'vue'

// Types
export interface Player {
  name: string
  health: number
  maxHealth: number
  level: number
  experience: number
  gold: number
  currentRoom: string
  inventory: any[]
}

export interface Position {
  x: number
  y: number
}

export const usePlayer = () => {
  // Player state
  const player = ref<Player>({
    name: 'Adventurer',
    health: 100,
    maxHealth: 100,
    level: 1,
    experience: 0,
    gold: 50,
    currentRoom: 'town_square',
    inventory: []
  })

  const playerPosition = ref<Position>({ x: 1, y: 0 })

  // Load player data from server
  const loadPlayerData = async (): Promise<any> => {
    try {
      const playerData = await $fetch('/api/player/data') as any
      
      // Update player reactive ref with server data
      player.value = {
        ...player.value,
        ...playerData
      }
      
      // Update position if provided
      if (playerData.position) {
        playerPosition.value = playerData.position as Position
      }
      
      return playerData
    } catch (error) {
      console.error('Error loading player data:', error)
      throw error
    }
  }

  // Update player position
  const updatePosition = (newPosition: Position): void => {
    playerPosition.value = newPosition
  }

  // Update current room
  const updateCurrentRoom = (roomId: string): void => {
    player.value.currentRoom = roomId
  }

  return {
    // State
    player: readonly(player),
    playerPosition: readonly(playerPosition),
    
    // Actions
    loadPlayerData,
    updatePosition,
    updateCurrentRoom
  }
}