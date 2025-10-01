import { Server } from 'socket.io'
import { createServer } from 'http'
import express from 'express'
import path from 'path'

/**
 * Socket Manager - handles WebSocket connections and communication
 */
export class SocketManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine
    this.httpServer = null
    this.io = null
    this.connectedPlayers = new Map() // socketId -> playerId
    this.playerSockets = new Map()    // playerId -> socketId
    
    console.log('SocketManager initialized')
  }
  
  /**
   * Start the socket server
   */
  start(port = 3000) {
    // Create Express app for static file serving
    const app = express()
    
    // Serve static files from public directory
    app.use(express.static('public'))
    
    // Create HTTP server with Express
    this.httpServer = createServer(app)
    
    // Create Socket.IO server
    this.io = new Server(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })
    
    // Set up event handlers
    this.setupEventHandlers()
    
    // Start listening
    this.httpServer.listen(port, () => {
      console.log(`Socket server listening on port ${port}`)
    })
  }
  
  /**
   * Stop the socket server
   */
  stop() {
    if (this.io) {
      this.io.close()
    }
    if (this.httpServer) {
      this.httpServer.close()
    }
    console.log('Socket server stopped')
  }
  
  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)
      
      // Handle authentication
      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data)
      })
      
      // Handle game commands from authenticated clients
      socket.on('gameCommand', (data) => {
        this.handleGameCommand(socket, data)
      })
      
      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  /**
   * Handle player authentication
   */
  handleAuthentication(socket, data) {
    const { username, password } = data
    
    if (!username || !password) {
      socket.emit('authResult', { success: false, error: 'Username and password required' })
      return
    }
    
    // Authenticate with PlayerManager
    const result = this.gameEngine.managers.player.authenticatePlayer(socket.id, username, password)
    
    if (result.success) {
      // Store player connection
      this.connectedPlayers.set(socket.id, socket.id)
      this.playerSockets.set(socket.id, socket.id)
      
      // Initialize inventory and equipment for the player
      this.gameEngine.managers.inventory.initializeInventory(socket.id, result.player.inventory)
      this.gameEngine.managers.equipment.initializeEquipment(socket.id, result.player.equipment)
      
      console.log(`Player ${username} authenticated successfully`)
      
      // Send initial state after authentication
      setTimeout(() => {
        const inventory = this.gameEngine.managers.inventory.getInventory(socket.id)
        const equipment = this.gameEngine.managers.equipment.getEquipment(socket.id)
        
        // Send initial inventory state
        if (inventory) {
          socket.emit('gameUpdate', [{
            type: 'INVENTORY_UPDATE',
            data: { inventory: inventory.items }
          }])
        }
        
        // Send initial equipment state
        if (equipment) {
          socket.emit('gameUpdate', [{
            type: 'EQUIPMENT_UPDATE', 
            data: { equipment: equipment }
          }])
        }
      }, 100)
    }
    
    socket.emit('authResult', result)
  }

  /**
   * Handle incoming game command from authenticated client
   */
  handleGameCommand(socket, data) {
    const playerId = socket.id
    
    // Check if player is authenticated
    if (!this.connectedPlayers.has(socket.id)) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }
    
    // Add playerId to command data
    const commandData = {
      ...data,
      playerId: playerId
    }
    
    // Queue the command for processing in next tick
    this.gameEngine.commandQueue.add(commandData)
    
    console.log(`Queued command from ${playerId}:`, data.type)
  }  /**
   * Handle client disconnection
   */
  handleDisconnect(socket) {
    const playerId = this.connectedPlayers.get(socket.id)
    if (playerId) {
      console.log(`Player ${playerId} disconnected`)
      this.connectedPlayers.delete(socket.id)
      this.playerSockets.delete(playerId)
    } else {
      console.log(`Unknown client disconnected: ${socket.id}`)
    }
  }
  
  /**
   * Get number of connected players
   */
  getConnectedPlayerCount() {
    return this.connectedPlayers.size
  }
  
  /**
   * Send update to specific player
   */
  sendToPlayer(playerId, update) {
    const socketId = this.playerSockets.get(playerId)
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId)
      if (socket) {
        socket.emit('update', update.toJSON())
      }
    }
  }
}