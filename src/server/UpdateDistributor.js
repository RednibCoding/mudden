/**
 * Update Distributor - sends updates to relevant clients
 * Handles update routing and client management
 */
export class UpdateDistributor {
  constructor() {
    this.socketManager = null // Will be set by GameEngine
    console.log('UpdateDistributor initialized')
  }
  
  /**
   * Set the socket manager reference
   */
  setSocketManager(socketManager) {
    this.socketManager = socketManager
  }
  
  /**
   * Distribute updates to affected players
   */
  distribute(updates) {
    if (updates.length === 0) return
    
    console.log(`Distributing ${updates.length} updates`)
    
    // Group updates by player
    const updatesByPlayer = new Map()
    
    for (const update of updates) {
      for (const playerId of update.affectedPlayers) {
        if (!updatesByPlayer.has(playerId)) {
          updatesByPlayer.set(playerId, [])
        }
        updatesByPlayer.get(playerId).push(update)
      }
    }
    
    // Send updates to each player
    for (const [playerId, playerUpdates] of updatesByPlayer) {
      this.sendToPlayer(playerId, playerUpdates)
    }
  }

  /**
   * Send updates to specific player
   */
  sendToPlayer(playerId, updates) {
    if (!this.socketManager) {
      console.warn('SocketManager not set on UpdateDistributor')
      return
    }
    
    const socketId = this.socketManager.playerSockets.get(playerId)
    if (!socketId) {
      console.warn(`No socket found for player ${playerId}`)
      return
    }
    
    const socket = this.socketManager.io.sockets.sockets.get(socketId)
    if (!socket) {
      console.warn(`Socket not found for player ${playerId}`)
      return
    }
    
    // Convert updates to sendable format
    const updateData = Array.isArray(updates) ? updates : [updates]
    const serializedUpdates = updateData.map(update => ({
      type: update.type, // Send numeric type directly
      data: update.data || {}
    }))
    
    socket.emit('gameUpdate', serializedUpdates)
    console.log(`Sent ${serializedUpdates.length} updates to player ${playerId}`)
  }
}