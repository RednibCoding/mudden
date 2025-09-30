class SessionManager {
  constructor(io) {
    this.io = io
    this.activePlayers = new Map() // socketId -> player
  }

  /**
   * Get all active players
   * @returns {Map} - Active players map
   */
  getActivePlayers() {
    return this.activePlayers
  }

  /**
   * Get player by socket ID
   * @param {string} socketId - Socket ID
   * @returns {Player|null} - Player or null if not found
   */
  getPlayerBySocketId(socketId) {
    return this.activePlayers.get(socketId) || null
  }

  /**
   * Get player socket by name
   * @param {string} playerName - Player name to find
   * @returns {Socket|null} - Socket or null if not found
   */
  getPlayerSocket(playerName) {
    for (const [socketId, player] of this.activePlayers) {
      if (player && player.name === playerName) {
        return this.io.sockets.sockets.get(socketId)
      }
    }
    return null
  }

  /**
   * Check if player is already logged in and handle duplicates
   * @param {string} playerName - Player name to check
   * @param {string} currentSocketId - Current socket ID (to exclude from check)
   * @returns {boolean} - True if duplicates were found and handled
   */
  handleDuplicateLogins(playerName, currentSocketId) {
    console.log(`Checking for existing login of: ${playerName}`)
    console.log(`Currently active players:`, Array.from(this.activePlayers.values()).map(p => p.name))
    
    // Find ALL existing sessions for this player name
    const existingEntries = Array.from(this.activePlayers.entries()).filter(([socketId, player]) => 
      player.name === playerName && socketId !== currentSocketId
    )
    
    if (existingEntries.length > 0) {
      console.log(`Found ${existingEntries.length} existing session(s) for ${playerName}, disconnecting...`)
      
      for (const [existingSocketId, existingPlayer] of existingEntries) {
        const existingSocket = this.io.sockets.sockets.get(existingSocketId)
        
        if (existingSocket) {
          // Save the existing player's data before disconnecting
          existingPlayer.save()
          
          // Notify the existing session
          existingSocket.emit('error', 'You have been logged out because this character logged in from another location.')
          existingSocket.emit('forceLogout')
          
          // Remove from active players immediately
          this.activePlayers.delete(existingSocketId)
          
          // Disconnect the existing socket
          existingSocket.disconnect(true)
          
          console.log(`${playerName} was already logged in from ${existingSocketId} - disconnected previous session`)
        }
      }
      
      return true
    } else {
      console.log(`No existing session found for ${playerName}`)
      return false
    }
  }

  /**
   * Add player to active session
   * @param {string} socketId - Socket ID
   * @param {Player} player - Player object
   */
  addPlayer(socketId, player) {
    // Double-check that this socket isn't already in activePlayers
    if (this.activePlayers.has(socketId)) {
      console.log(`Warning: Socket ${socketId} already in activePlayers, removing first`)
      this.activePlayers.delete(socketId)
    }
    
    this.activePlayers.set(socketId, player)
    console.log(`${player.name} logged in (socket: ${socketId})`)
    console.log(`Total active players: ${this.activePlayers.size}`)
  }

  /**
   * Remove player from active session
   * @param {string} socketId - Socket ID to remove
   * @returns {Player|null} - Removed player or null if not found
   */
  removePlayer(socketId) {
    const player = this.activePlayers.get(socketId)
    if (player) {
      this.activePlayers.delete(socketId)
      console.log(`${player.name} disconnected`)
      console.log(`Total active players: ${this.activePlayers.size}`)
      return player
    }
    return null
  }

  /**
   * Handle player disconnect cleanup
   * @param {string} socketId - Socket ID that disconnected
   */
  handleDisconnect(socketId) {
    console.log(`Socket ${socketId} disconnected`)
    
    const player = this.removePlayer(socketId)
    if (player) {
      // Save player data
      player.save()
      
      // Stop health recovery
      player.stopHealthRecovery()
      
      // Additional cleanup can be added here (combat, etc.)
    }
  }

  /**
   * Get count of active players
   * @returns {number} - Number of active players
   */
  getPlayerCount() {
    return this.activePlayers.size
  }
}

export default SessionManager