import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'

import Player from './lib/Player.js'
import GameWorld from './lib/GameWorld.js'
import CommandManager from './lib/CommandManager.js'
import GameTickManager from './lib/GameTickManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server)

// Game state
const gameWorld = new GameWorld()
const activePlayers = new Map() // socketId -> player
const combatSessions = new Map() // playerId -> combat state
const commandManager = new CommandManager(gameWorld, activePlayers, combatSessions, io)
const gameTickManager = new GameTickManager()

// Connect GameWorld to GameTickManager for tick-based operations
gameWorld.setGameTickManager(gameTickManager)

// Add helper function to get player socket by name
global.getPlayerSocket = (playerName) => {
  for (const [socketId, player] of activePlayers) {
    if (player && player.name === playerName) {
      return io.sockets.sockets.get(socketId)
    }
  }
  return null
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')))

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`)
  
  let currentPlayer = null

  // Handle player login request (check if character exists and needs password)
  socket.on('loginRequest', (playerName) => {
    console.log(`Login request received for: ${playerName}`)
    try {
      // Sanitize player name
      const cleanName = playerName.trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20)
      if (!cleanName) {
        socket.emit('loginResponse', { success: false, error: 'Invalid player name' })
        return
      }

      const characterExists = Player.characterExists(cleanName)
      
      if (!characterExists) {
        socket.emit('loginResponse', { 
          success: false, 
          error: `Character "${cleanName}" does not exist. Use "Create Character" to make a new character.` 
        })
        return
      }
      
      const needsPassword = Player.needsPassword(cleanName)

      socket.emit('loginResponse', {
        success: true,
        characterExists: true,
        needsPassword,
        playerName: cleanName
      })

    } catch (error) {
      console.error('Login request error:', error)
      socket.emit('loginResponse', { success: false, error: 'Failed to check login' })
    }
  })

  // Handle player login with optional password
  socket.on('login', (loginData) => {
    try {
      const { playerName, password } = loginData
      
      // Sanitize player name
      const cleanName = playerName.trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20)
      if (!cleanName) {
        socket.emit('error', 'Invalid player name')
        return
      }

      // Check if character exists (login should only work for existing characters)
      if (!Player.characterExists(cleanName)) {
        socket.emit('error', `Character "${cleanName}" does not exist. Use "Create Character" to make a new character.`)
        return
      }
      
      if (Player.needsPassword(cleanName)) {
        if (!password) {
          socket.emit('error', 'Password required for this character')
          return
        }
        
        // Load player and verify password
        const tempPlayer = Player.load(cleanName)
        if (!tempPlayer.verifyPassword(password)) {
          socket.emit('error', 'Incorrect password')
          return
        }
        
        currentPlayer = tempPlayer
      } else {
        // Existing character without password
        currentPlayer = Player.load(cleanName)
      }

      // Check if player is already logged in from another session
      console.log(`Checking for existing login of: ${cleanName}`)
      console.log(`Currently active players:`, Array.from(activePlayers.values()).map(p => p.name))
      
      // Remove ALL existing sessions for this player name (handle multiple duplicates)
      const existingEntries = Array.from(activePlayers.entries()).filter(([socketId, player]) => 
        player.name === cleanName
      )
      
      if (existingEntries.length > 0) {
        console.log(`Found ${existingEntries.length} existing session(s) for ${cleanName}, disconnecting...`)
        
        for (const [existingSocketId, existingPlayer] of existingEntries) {
          const existingSocket = io.sockets.sockets.get(existingSocketId)
          
          if (existingSocket && existingSocketId !== socket.id) {
            // Save the existing player's data before disconnecting
            existingPlayer.save()
            
            // Notify the existing session
            existingSocket.emit('error', 'You have been logged out because this character logged in from another location.')
            existingSocket.emit('forceLogout')
            
            // Remove from active players immediately
            activePlayers.delete(existingSocketId)
            
            // Disconnect the existing socket
            existingSocket.disconnect(true)
            
            console.log(`${cleanName} was already logged in from ${existingSocketId} - disconnected previous session`)
          }
        }
      } else {
        console.log(`No existing session found for ${cleanName}`)
      }

      // Double-check that this socket isn't already in activePlayers
      if (activePlayers.has(socket.id)) {
        console.log(`Warning: Socket ${socket.id} already in activePlayers, removing first`)
        activePlayers.delete(socket.id)
      }
      
      activePlayers.set(socket.id, currentPlayer)
      console.log(`${cleanName} logged in (socket: ${socket.id})`)
      console.log(`Total active players: ${activePlayers.size}`)
      
      // Start health recovery for the player
      currentPlayer.startHealthRecovery((player, message) => {
        const playerSocket = [...activePlayers.entries()].find(([, p]) => p.name === player.name)?.[0]
        if (playerSocket) {
          const socket = io.sockets.sockets.get(playerSocket)
          if (socket) {
            if (message) {
              socket.emit('message', message)
            }
            // Always send updated game state to keep client UI in sync
            const room = gameWorld.getRoom(player.currentArea, player.currentRoom, player)
            socket.emit('gameState', {
              player: {
                name: player.name,
                level: player.level,
                health: player.health,
                maxHealth: player.maxHealth,
                experience: player.experience,
                gold: player.gold,
                location: room ? room.name : 'Unknown',
                currentArea: player.currentArea,
                currentRoom: player.currentRoom,
                inCombat: player.inCombat
              },
              room: room
            })
          }
        }
      })

      // Send initial game state
      const room = gameWorld.getRoom(currentPlayer.currentArea, currentPlayer.currentRoom)
      socket.emit('gameState', {
        player: {
          name: currentPlayer.name,
          level: currentPlayer.level,
          health: currentPlayer.health,
          maxHealth: currentPlayer.maxHealth,
          experience: currentPlayer.experience,
          gold: currentPlayer.gold,
          location: room ? room.name : 'Unknown',
          currentArea: currentPlayer.currentArea,
          currentRoom: currentPlayer.currentRoom
        },
        room: room
      })

            // Send welcome message
      socket.emit('output', `Welcome back, ${cleanName}!`)
      socket.emit('output', `Type 'help' for commands.`)
      socket.emit('output', commandManager.processCommand(currentPlayer, 'look'))

    } catch (error) {
      console.error('Login error:', error)
      socket.emit('error', 'Failed to log in')
    }
  })

  // Handle character creation
  socket.on('createCharacter', (creationData) => {
    try {
      const { playerName, password } = creationData
      
      // Validate character name format
      const trimmedName = playerName.trim()
      
      // Check for empty name
      if (!trimmedName) {
        socket.emit('error', 'Character name cannot be empty')
        return
      }
      
      // Check length (3-12 characters)
      if (trimmedName.length < 3 || trimmedName.length > 12) {
        socket.emit('error', 'Character name must be between 3 and 12 characters long')
        return
      }
      
      // Check for valid characters only (ASCII letters only, no numbers or special chars)
      if (!/^[a-zA-Z]+$/.test(trimmedName)) {
        socket.emit('error', 'Character name can only contain regular letters (no numbers, spaces, or special characters like ä ö ê)')
        return
      }
      
      // Convert to proper case (first letter uppercase, rest lowercase)
      const properCaseName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1).toLowerCase()
      
      // Check for case-insensitive duplicate names
      if (Player.characterExistsCaseInsensitive(properCaseName)) {
        socket.emit('error', `A character with that name already exists (case-insensitive). Please choose a different name.`)
        return
      }
      
      const cleanName = properCaseName

      // Validate password
      if (!password || password.trim().length < 3) {
        socket.emit('error', 'Password must be at least 3 characters long')
        return
      }

      // Create new character
      currentPlayer = new Player(cleanName)
      currentPlayer.setPassword(password)
      currentPlayer.save()
      
      console.log(`New character created: ${cleanName}`)

      // Set up player session (same as login)
      if (activePlayers.has(socket.id)) {
        console.log(`Warning: Socket ${socket.id} already in activePlayers, removing first`)
        activePlayers.delete(socket.id)
      }
      
      activePlayers.set(socket.id, currentPlayer)
      console.log(`${cleanName} logged in after creation (socket: ${socket.id})`)
      console.log(`Total active players: ${activePlayers.size}`)
      
      // Start health recovery for the new player
      currentPlayer.startHealthRecovery((player, message) => {
        const playerSocket = [...activePlayers.entries()].find(([, p]) => p.name === player.name)?.[0]
        if (playerSocket) {
          const socket = io.sockets.sockets.get(playerSocket)
          if (socket) {
            if (message) {
              socket.emit('message', message)
            }
            // Always send updated game state to keep client UI in sync
            const room = gameWorld.getRoom(player.currentArea, player.currentRoom, player)
            socket.emit('gameState', {
              player: {
                name: player.name,
                level: player.level,
                health: player.health,
                maxHealth: player.maxHealth,
                experience: player.experience,
                gold: player.gold,
                location: room ? room.name : 'Unknown',
                currentArea: player.currentArea,
                currentRoom: player.currentRoom,
                inCombat: player.inCombat
              },
              room: room
            })
          }
        }
      })

      // Send initial game state
      const room = gameWorld.getRoom(currentPlayer.currentArea, currentPlayer.currentRoom)
      socket.emit('gameState', {
        player: {
          name: currentPlayer.name,
          level: currentPlayer.level,
          health: currentPlayer.health,
          maxHealth: currentPlayer.maxHealth,
          experience: currentPlayer.experience,
          gold: currentPlayer.gold,
          location: room ? room.name : 'Unknown',
          currentArea: currentPlayer.currentArea,
          currentRoom: currentPlayer.currentRoom
        },
        room: room
      })

      // Send welcome message for new character
      socket.emit('output', `Welcome ${cleanName}! Your character has been created successfully.`)
      socket.emit('output', `You begin your adventure in the town square. Type 'help' for available commands.`)
      socket.emit('output', commandManager.processCommand(currentPlayer, 'look'))

    } catch (error) {
      console.error('Character creation error:', error)
      socket.emit('error', 'Failed to create character')
    }
  })

  // Handle commands
  socket.on('command', (commandString) => {
    if (!currentPlayer) {
      socket.emit('error', 'Not logged in')
      return
    }

    try {
      console.log(`${currentPlayer.name}: ${commandString}`)
      
      // Process command
      const result = commandManager.processCommand(currentPlayer, commandString)
      
      // Check for logout request
      if (result.startsWith('LOGOUT_REQUEST|')) {
        const message = result.substring('LOGOUT_REQUEST|'.length)
        socket.emit('output', message)
        socket.emit('logout')
        
        // Clean up server state
        const combat = combatSessions.get(currentPlayer.name)
        if (combat) {
          combatSessions.delete(currentPlayer.name)
          currentPlayer.inCombat = false
          currentPlayer.save()
        }
        activePlayers.delete(socket.id)
        currentPlayer = null
        
        return
      }
      
      // Send result to player
      socket.emit('output', result)
      
      // Send updated game state
      const room = gameWorld.getRoom(currentPlayer.currentArea, currentPlayer.currentRoom)
      socket.emit('gameState', {
        player: {
          name: currentPlayer.name,
          level: currentPlayer.level,
          health: currentPlayer.health,
          maxHealth: currentPlayer.maxHealth,
          experience: currentPlayer.experience,
          gold: currentPlayer.gold,
          location: room ? room.name : 'Unknown',
          currentArea: currentPlayer.currentArea,
          currentRoom: currentPlayer.currentRoom,
          inCombat: currentPlayer.inCombat || !!combatSessions.get(currentPlayer.name)
        },
        room: room
      })

    } catch (error) {
      console.error('Command error:', error)
      socket.emit('error', 'Failed to process command')
    }
  })

  // Handle area map request
  socket.on('requestAreaMap', (currentRoom) => {
    if (!currentPlayer) {
      socket.emit('error', 'Not logged in')
      return
    }

    try {
      const mapData = generateAreaMap(currentPlayer.currentArea, currentPlayer.currentRoom)
      socket.emit('areaMap', mapData)
    } catch (error) {
      console.error('Area map error:', error)
      socket.emit('error', 'Failed to generate area map')
    }
  })

  // Handle room exits request
  socket.on('requestRoomExits', (roomRequest) => {
    if (!currentPlayer) {
      socket.emit('error', 'Not logged in')
      return
    }

    try {
      const room = gameWorld.getRoom(roomRequest.area, roomRequest.room)
      if (!room || !room.exits) {
        socket.emit('roomExits', { exits: {} })
        return
      }

      // Convert exits to include room names
      const exitsWithNames = {}
      for (const [direction, exit] of Object.entries(room.exits)) {
        const [exitArea, exitRoom] = exit.split('.')
        const exitRoomData = gameWorld.getRoom(exitArea, exitRoom)
        exitsWithNames[direction] = {
          id: exit,
          name: exitRoomData ? exitRoomData.name : 'Unknown Room'
        }
      }

      socket.emit('roomExits', { exits: exitsWithNames })
    } catch (error) {
      console.error('Room exits error:', error)
      socket.emit('error', 'Failed to get room exits')
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    if (currentPlayer) {
      console.log(`${currentPlayer.name} disconnected`)
      
      const playerArea = currentPlayer.currentArea
      const playerRoom = currentPlayer.currentRoom
      
      // Stop health recovery
      currentPlayer.stopHealthRecovery()
      
      currentPlayer.save()
      
      // Clean up combat session if any
      const combat = combatSessions.get(currentPlayer.name)
      if (combat) {
        // Store enemy info for cleanup
        const enemyId = combat.defender.enemyId
        
        // Combat timers handled by global tick system
        combatSessions.delete(currentPlayer.name)
        currentPlayer.inCombat = false
        currentPlayer.save()
        
        // Clean up unused enemy instance after delay
        if (enemyId) {
          setTimeout(() => {
            const combatCommands = commandManager.getCommandInstance('CombatCommands')
            if (combatCommands) {
              combatCommands.cleanupUnusedEnemyInstance(
                currentPlayer.currentArea,
                currentPlayer.currentRoom,
                enemyId
              )
            }
          }, 2000) // 2 second delay to allow for quick reconnection
        }
      }
      
      // Check for unused enemy instances in the room the player left
      setTimeout(() => {
        const combatCommands = commandManager.getCommandInstance('CombatCommands')
        if (combatCommands) {
          // Get all enemies in the room and clean up unused instances
          const area = gameWorld.getArea(playerArea)
          if (area && area.rooms[playerRoom] && area.rooms[playerRoom].enemies) {
            area.rooms[playerRoom].enemies.forEach(enemyConfig => {
              if (typeof enemyConfig === 'object' && enemyConfig.id) {
                combatCommands.cleanupUnusedEnemyInstance(playerArea, playerRoom, enemyConfig.id)
              }
            })
          }
        }
      }, 1000) // 1 second delay to ensure player is fully disconnected
    }
    
    activePlayers.delete(socket.id)
    console.log(`Socket ${socket.id} disconnected`)
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })
})

// Generate area map for client display
function generateAreaMap(areaId, currentRoomId) {
  const area = gameWorld.areas.get(areaId)
  if (!area) {
    return { rooms: [], gridSize: { width: 1, height: 1 }, playerPosition: { x: 0, y: 0 } }
  }

  const rooms = Object.values(area.rooms)
  if (rooms.length === 0) {
    return { rooms: [], gridSize: { width: 1, height: 1 }, playerPosition: { x: 0, y: 0 } }
  }

  // Create a graph of room connections
  const roomGraph = new Map()
  const roomPositions = new Map()

  // Initialize graph
  rooms.forEach(room => {
    roomGraph.set(room.id, {
      name: room.name,
      exits: room.exits || {},
      visited: false,
      gridX: 0,
      gridY: 0
    })
  })

  // Start positioning from the current room or first room
  let startRoom = currentRoomId || rooms[0].id
  if (!roomGraph.has(startRoom)) {
    startRoom = rooms[0].id
  }

  // Position rooms using BFS from start room
  const queue = [{ roomId: startRoom, x: 0, y: 0 }]
  roomPositions.set(startRoom, { x: 0, y: 0 })
  roomGraph.get(startRoom).visited = true
  roomGraph.get(startRoom).gridX = 0
  roomGraph.get(startRoom).gridY = 0

  while (queue.length > 0) {
    const { roomId, x, y } = queue.shift()
    const room = roomGraph.get(roomId)
    
    if (!room || !room.exits) continue

    // Define direction offsets
    const directions = {
      north: { dx: 0, dy: -1 },
      south: { dx: 0, dy: 1 },
      east: { dx: 1, dy: 0 },
      west: { dx: -1, dy: 0 },
      northeast: { dx: 1, dy: -1 },
      northwest: { dx: -1, dy: -1 },
      southeast: { dx: 1, dy: 1 },
      southwest: { dx: -1, dy: 1 }
    }

    for (const [direction, exit] of Object.entries(room.exits)) {
      const exitRoomId = exit.split('.')[1] // Remove area prefix
      if (!roomGraph.has(exitRoomId) || roomGraph.get(exitRoomId).visited) continue

      const dir = directions[direction]
      if (!dir) continue

      const newX = x + dir.dx
      const newY = y + dir.dy

      // Check if position is already occupied
      const occupied = Array.from(roomPositions.values()).some(pos => pos.x === newX && pos.y === newY)
      if (occupied) continue

      roomPositions.set(exitRoomId, { x: newX, y: newY })
      roomGraph.get(exitRoomId).visited = true
      roomGraph.get(exitRoomId).gridX = newX
      roomGraph.get(exitRoomId).gridY = newY

      queue.push({ roomId: exitRoomId, x: newX, y: newY })
    }
  }

  // Calculate grid bounds
  let minX = 0, maxX = 0, minY = 0, maxY = 0
  for (const pos of roomPositions.values()) {
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
  }

  // Normalize positions to start from 0,0
  const normalizedRooms = []
  let playerPosition = { x: 0, y: 0 }

  for (const [roomId, room] of roomGraph) {
    if (!room.visited) continue

    const normalizedX = room.gridX - minX
    const normalizedY = room.gridY - minY

    normalizedRooms.push({
      id: roomId,
      name: room.name,
      gridX: normalizedX,
      gridY: normalizedY
    })

    if (roomId === currentRoomId) {
      playerPosition = { x: normalizedX, y: normalizedY }
    }
  }

  // Find cross-area exits and create exit cells
  const exitCells = []
  const directions = {
    north: { dx: 0, dy: -1 },
    south: { dx: 0, dy: 1 },
    east: { dx: 1, dy: 0 },
    west: { dx: -1, dy: 0 },
    northeast: { dx: 1, dy: -1 },
    northwest: { dx: -1, dy: -1 },
    southeast: { dx: 1, dy: 1 },
    southwest: { dx: -1, dy: 1 }
  }

  for (const [roomId, room] of roomGraph) {
    if (!room.visited) continue
    
    const roomData = rooms.find(r => r.id === roomId)
    if (!roomData || !roomData.exits) continue
    
    for (const [direction, exit] of Object.entries(roomData.exits)) {
      const [exitArea, exitRoom] = exit.split('.')
      if (exitArea !== areaId) {
        // This is a cross-area exit - create an exit cell
        const dir = directions[direction]
        if (dir) {
          const exitX = room.gridX + dir.dx
          const exitY = room.gridY + dir.dy
          exitCells.push({
            gridX: exitX,
            gridY: exitY,
            targetArea: exitArea,
            direction: direction,
            fromRoom: roomId
          })
          
          // Expand bounds to include exit cells
          minX = Math.min(minX, exitX)
          maxX = Math.max(maxX, exitX)
          minY = Math.min(minY, exitY)
          maxY = Math.max(maxY, exitY)
        }
      }
    }
  }

  // After adding exit cells, recalculate the final normalization
  // Re-normalize all positions with the expanded bounds
  const finalNormalizedRooms = []
  let finalPlayerPosition = { x: 0, y: 0 }

  for (const [roomId, room] of roomGraph) {
    if (!room.visited) continue

    const normalizedX = room.gridX - minX
    const normalizedY = room.gridY - minY

    finalNormalizedRooms.push({
      id: roomId,
      name: room.name,
      gridX: normalizedX,
      gridY: normalizedY
    })

    if (roomId === currentRoomId) {
      finalPlayerPosition = { x: normalizedX, y: normalizedY }
    }
  }

  // Normalize exit cell positions
  const normalizedExitCells = exitCells.map(cell => ({
    ...cell,
    gridX: cell.gridX - minX,
    gridY: cell.gridY - minY
  }))

  return {
    rooms: finalNormalizedRooms,
    exitCells: normalizedExitCells,
    gridSize: {
      width: maxX - minX + 1,
      height: maxY - minY + 1
    },
    playerPosition: finalPlayerPosition
  }
}

// Initialize game tick system
gameTickManager.setCombatHandler((tick) => {
  // Combat happens every 3 ticks
  const combatCommands = commandManager.getCommandInstance('CombatCommands')
  if (combatCommands) {
    combatCommands.processAllCombats(tick)
  }
})

gameTickManager.setHealthRegenHandler((tick) => {
  // Health regeneration happens every 5 ticks
  for (const [socketId, player] of activePlayers) {
    if (player) {
      player.processHealthRecoveryTick()
    }
  }
})

gameTickManager.setRespawnHandler((tick) => {
  // Check for respawns every tick
  gameWorld.processRespawnTick(tick)
})

gameTickManager.setCleanupHandler((tick) => {
  // Cleanup happens every 60 ticks (1 minute)
  const now = Date.now()
  for (const [playerId, combat] of combatSessions) {
    // Auto-abandon combat after 5 minutes of inactivity
    if (combat.lastAction && (now - combat.lastAction) > 300000) {
      // Store enemy info for cleanup
      const enemyId = combat.defender.enemyId
      const areaId = combat.attacker.data.currentArea
      const roomId = combat.attacker.data.currentRoom
      
      combatSessions.delete(playerId)
      console.log(`Auto-abandoned combat for ${playerId}`)
      
      // Clean up unused enemy instance
      if (enemyId) {
        const combatCommands = commandManager.getCommandInstance('CombatCommands')
        if (combatCommands) {
          combatCommands.cleanupUnusedEnemyInstance(areaId, roomId, enemyId)
        }
      }
    }
  }
})

// Start the global tick system (1 second per tick)
gameTickManager.start(1000)

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...')
  
  // Save all active players
  for (const [socketId, player] of activePlayers) {
    player.save()
  }
  
  server.close(() => {
    console.log('👋 Server shut down complete')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...')
  
  // Save all active players
  for (const [socketId, player] of activePlayers) {
    player.save()
  }
  
  server.close(() => {
    console.log('Server shut down complete')
    process.exit(0)
  })
})

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`
=======================================
   MUDDED SERVER STARTED
=======================================
Game world loaded with ${gameWorld.areas.size} areas
Server running on http://localhost:${PORT}
Players can connect and start adventuring!
=======================================
  `)
})

export { gameWorld, activePlayers, combatSessions }