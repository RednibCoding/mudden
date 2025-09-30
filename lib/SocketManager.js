class SocketManager {
  constructor(io, authManager, sessionManager, gameWorld, commandManager, combatSessions) {
    this.io = io
    this.authManager = authManager
    this.sessionManager = sessionManager
    this.gameWorld = gameWorld
    this.commandManager = commandManager
    this.combatSessions = combatSessions
    
    this.setupSocketEvents()
  }

  /**
   * Set up all socket event handlers
   */
  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`)
      
      let currentPlayer = null

      // Handle login request
      socket.on('loginRequest', (playerName) => {
        this.authManager.handleLoginRequest(socket, playerName)
      })

      // Handle character creation
      socket.on('createCharacter', (creationData) => {
        const newPlayer = this.authManager.handleCharacterCreation(socket, creationData)
        if (newPlayer) {
          currentPlayer = newPlayer
          this.completeLogin(socket, currentPlayer)
        }
      })

      // Handle login with password
      socket.on('login', (loginData) => {
        const player = this.authManager.handleLogin(socket, loginData)
        if (player) {
          // Handle duplicate logins
          this.sessionManager.handleDuplicateLogins(player.name, socket.id)
          
          currentPlayer = player
          this.completeLogin(socket, currentPlayer)
        }
      })

      // Handle commands
      socket.on('command', (commandString) => {
        this.handleCommand(socket, currentPlayer, commandString)
      })

      // Handle area map requests
      socket.on('requestAreaMap', (currentRoom) => {
        this.handleAreaMapRequest(socket, currentPlayer, currentRoom)
      })

      // Handle room exits requests
      socket.on('requestRoomExits', (data) => {
        this.handleRoomExitsRequest(socket, currentPlayer, data)
      })

      // Handle disconnect
      socket.on('disconnect', () => {
        if (currentPlayer) {
          // Clean up combat state
          const combat = this.combatSessions.get(currentPlayer.name)
          if (combat) {
            this.combatSessions.delete(currentPlayer.name)
            currentPlayer.inCombat = false
            currentPlayer.save()
          }
        }
        
        this.sessionManager.handleDisconnect(socket.id)
        currentPlayer = null
      })
    })
  }

  /**
   * Complete the login process and send initial game state
   * @param {Socket} socket - Socket connection
   * @param {Player} player - Logged in player
   */
  completeLogin(socket, player) {
    // Add to session
    this.sessionManager.addPlayer(socket.id, player)
    
    // Start health recovery
    player.startHealthRecovery()

    // Send initial game state
    const room = this.gameWorld.getRoom(player.currentArea, player.currentRoom)
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
        inCombat: player.inCombat,
        activeQuests: player.activeQuests || []
      },
      room: room
    })

    // Send welcome messages (differentiate between new and returning players by checking if this came from character creation)
    const isNewCharacter = player._justCreated || false
    if (isNewCharacter) {
      socket.emit('output', `Welcome ${player.name}! Your character has been created successfully.`)
      socket.emit('output', `You begin your adventure in the town square. Type 'help' for available commands.`)
      delete player._justCreated // Clear flag after first login
    } else {
      socket.emit('output', `Welcome back, ${player.name}!`)
      socket.emit('output', `Type 'help' for commands.`)
    }
    
    socket.emit('output', this.commandManager.processCommand(player, 'look'))
  }

  /**
   * Handle command execution
   * @param {Socket} socket - Socket connection
   * @param {Player} player - Current player
   * @param {string} commandString - Command to execute
   */
  handleCommand(socket, player, commandString) {
    if (!player) {
      socket.emit('error', 'Not logged in')
      return
    }

    try {
      console.log(`${player.name}: ${commandString}`)
      
      // Process command
      const result = this.commandManager.processCommand(player, commandString)
      
      // Check for logout request
      if (result.startsWith('LOGOUT_REQUEST|')) {
        const message = result.substring('LOGOUT_REQUEST|'.length)
        socket.emit('output', message)
        socket.emit('logout')
        
        // Clean up server state
        const combat = this.combatSessions.get(player.name)
        if (combat) {
          this.combatSessions.delete(player.name)
          player.inCombat = false
          player.save()
        }
        this.sessionManager.removePlayer(socket.id)
        
        return
      }
      
      // Send command result
      if (result && result.trim()) {
        socket.emit('output', result)
      }

      // Check if this was a movement command and send gameState update
      const command = commandString.trim().toLowerCase().split(' ')[0]
      const movementCommands = ['north', 'n', 'south', 's', 'east', 'e', 'west', 'w', 
                               'northeast', 'ne', 'northwest', 'nw', 'southeast', 'se', 'southwest', 'sw']
      if (movementCommands.includes(command)) {
        // Send gameState update for movement
        this.sendGameStateUpdate(socket, player)
      }

    } catch (error) {
      console.error('Command processing error:', error)
      socket.emit('error', 'Failed to process command')
    }
  }

  /**
   * Handle area map requests
   * @param {Socket} socket - Socket connection
   * @param {Player} player - Current player
   * @param {string} currentRoom - Current room ID
   */
  handleAreaMapRequest(socket, player, currentRoom) {
    if (!player) return
    
    try {
      // Use the player's current area and room for the map
      const mapData = this.gameWorld.getAreaMap(player.currentArea, player.currentRoom)
      if (mapData) {
        socket.emit('areaMap', mapData)
      }
    } catch (error) {
      console.error('Area map request error:', error)
    }
  }

  /**
   * Handle room exits requests
   * @param {Socket} socket - Socket connection
   * @param {Player} player - Current player
   * @param {object} data - {area, room}
   */
  handleRoomExitsRequest(socket, player, data) {
    if (!player) return
    
    try {
      const { area, room } = data
      const roomData = this.gameWorld.getRoom(area, room)
      
      if (roomData && roomData.exits) {
        const exitsWithNames = {}
        for (const [direction, exitString] of Object.entries(roomData.exits)) {
          // Parse "area.room" format
          const [exitArea, exitRoom] = exitString.split('.')
          const targetRoom = this.gameWorld.getRoom(exitArea, exitRoom)
          exitsWithNames[direction] = {
            area: exitArea,
            room: exitRoom,
            name: targetRoom ? targetRoom.name : 'Unknown'
          }
        }
        
        socket.emit('roomExits', { exits: exitsWithNames })
      }
    } catch (error) {
      console.error('Room exits request error:', error)
    }
  }

  /**
   * Send game state update to client
   * @param {Socket} socket - Socket connection
   * @param {Player} player - Player object
   */
  sendGameStateUpdate(socket, player) {
    if (!socket || !player) return
    
    const room = this.gameWorld.getRoom(player.currentArea, player.currentRoom)
    const gameState = {
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
        inCombat: player.inCombat,
        activeQuests: player.activeQuests || []
      },
      room: room
    }
    
    socket.emit('gameState', gameState)
  }
}

export default SocketManager