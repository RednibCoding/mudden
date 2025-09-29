import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'

import Player from './lib/Player.js'
import GameWorld from './lib/GameWorld.js'
import CommandManager from './lib/CommandManager.js'

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
      
      // Sanitize player name
      const cleanName = playerName.trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20)
      if (!cleanName) {
        socket.emit('error', 'Invalid character name')
        return
      }

      // Check if character already exists
      if (Player.characterExists(cleanName)) {
        socket.emit('error', `Character "${cleanName}" already exists. Use "Login" to access existing characters.`)
        return
      }

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
        if (currentPlayer.combat) {
          combatSessions.delete(currentPlayer.name)
          currentPlayer.combat = null
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
          inCombat: !!currentPlayer.combat
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
      console.log(`Generating area map for ${currentPlayer.name} in ${currentPlayer.currentArea}.${currentPlayer.currentRoom}`)
      const mapData = generateAreaMap(currentPlayer.currentArea, currentPlayer.currentRoom)
      console.log(`Map data generated:`, mapData)
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
      currentPlayer.save()
      
      // Clean up combat session if any
      if (currentPlayer.combat) {
        combatSessions.delete(currentPlayer.name)
        currentPlayer.combat = null
        currentPlayer.save()
      }
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

  return {
    rooms: normalizedRooms,
    gridSize: {
      width: maxX - minX + 1,
      height: maxY - minY + 1
    },
    playerPosition
  }
}

// Game loop for periodic tasks (optional)
setInterval(() => {
  // Here you could add periodic game events, combat timers, etc.
  // For now, just clean up old combat sessions
  const now = Date.now()
  for (const [playerId, combat] of combatSessions) {
    // Auto-abandon combat after 5 minutes of inactivity
    if (combat.lastAction && (now - combat.lastAction) > 300000) {
      combatSessions.delete(playerId)
      console.log(`Auto-abandoned combat for ${playerId}`)
    }
  }
}, 60000) // Check every minute

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