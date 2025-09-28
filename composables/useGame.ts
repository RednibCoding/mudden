import { useGameState } from './useGameState'
import { usePlayer } from './usePlayer'
import { useRoom } from './useRoom'
import { useCommands } from './useCommands'

export const useGame = () => {
  // Initialize composables
  const gameState = useGameState()
  const playerState = usePlayer()
  const roomState = useRoom()
  
  // Initialize commands with dependencies
  const commands = useCommands(
    gameState.addGameOutput,
    roomState.currentRoom,
    playerState.player
  )

  // Game initialization
  const initializeGame = async (): Promise<void> => {
    try {
      // Load player data
      const playerData = await playerState.loadPlayerData()
      
      // Load area map
      await roomState.loadAreaMap(roomState.currentAreaId.value)
      
      // Load current room
      const roomData = await roomState.loadCurrentRoom()
      
      // Update player position if provided
      if (roomData?.location?.position) {
        playerState.updatePosition(roomData.location.position)
      }
      
      // Update area if provided
      if (roomData?.areaId) {
        roomState.currentAreaId.value = roomData.areaId
      }
      
      // Update current room in player state
      if (roomState.currentRoom.value) {
        playerState.updateCurrentRoom(roomState.currentRoom.value.id)
      }
      
      // Generate area grid
      roomState.generateAreaGrid({
        x: playerState.playerPosition.value.x,
        y: playerState.playerPosition.value.y
      })
      
      // Focus command input
      gameState.focusCommandInput()
      
      // Welcome messages
      gameState.addGameOutput('=== Welcome to MUDDEN ===', 'success')
      if (playerData) {
        gameState.addGameOutput(`Welcome back, ${playerData.name}!`, 'success')
      }
      gameState.addGameOutput('A text-based multi-user dungeon adventure awaits!', 'success')
      gameState.addGameOutput('Type "help" for available commands, or "look" to examine your surroundings.', 'success')
      gameState.addGameOutput('')
      
      // Initial look
      await commands.handleLook()
      
    } catch (error) {
      console.error('Game initialization error:', error)
      gameState.addGameOutput('Error initializing game. Please refresh and try again.', 'error')
    }
  }

  // Clean command execution that dispatches to useCommands and handles state updates
  const executeCommand = async (command?: string): Promise<void> => {
    const cmd = command || gameState.currentCommand.value
    
    // Execute the command and get result with state update requirements
    const result = await commands.executeCommand(cmd, gameState.currentCommand)
    
    // Handle state updates based on command result
    if (result.needsStateUpdate) {
      const updates = result.needsStateUpdate
      
      // Handle movement updates
      if (updates.position || updates.room || updates.areaData) {
        if (updates.areaData) {
          roomState.updateAreaData(updates.areaData)
        }
        
        if (updates.position) {
          playerState.updatePosition(updates.position)
        }
        
        if (updates.room) {
          const enrichedRoom = {
            ...updates.room,
            exits: updates.exits || {}
          }
          roomState.updateCurrentRoom(enrichedRoom)
          playerState.updateCurrentRoom(updates.room.id)
        }
        
        // Regenerate grid for movement
        roomState.generateAreaGrid({
          x: playerState.playerPosition.value.x,
          y: playerState.playerPosition.value.y
        })
        
        // Show new room if requested
        if (updates.shouldLook) {
          await commands.handleLook()
        }
      }
      
      // Handle player data updates (inventory, equipment, etc.)
      if (updates.playerData) {
        await playerState.loadPlayerData()
      }
      
      // Handle room data updates (items, NPCs, etc.)
      if (updates.roomData) {
        await roomState.loadCurrentRoom()
        // Regenerate grid to reflect room changes
        roomState.generateAreaGrid({
          x: playerState.playerPosition.value.x,
          y: playerState.playerPosition.value.y
        })
      }
    }
  }

  // Quick command execution
  const quickCommand = (cmd: string): void => {
    executeCommand(cmd)
  }

  return {
    // State from composables
    ...gameState,
    ...playerState,
    ...roomState,
    
    // Actions
    initializeGame,
    executeCommand,
    quickCommand
  }
}