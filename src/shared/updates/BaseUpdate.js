/**
 * Base class for all game updates sent from server to clients
 * Provides common functionality for serialization and player targeting
 */
export class BaseUpdate {
  constructor(playerId, type, data = {}) {
    this.type = this.getTypeNumber(type)
    this.affectedPlayers = Array.isArray(playerId) ? playerId : [playerId]
    this.data = data
    this.timestamp = Date.now()
  }
  
  /**
   * Convert type string/number to number
   */
  getTypeNumber(type) {
    if (typeof type === 'number') return type
    
    const typeMap = {
      'ROOM_UPDATE': 1,
      'INVENTORY_UPDATE': 2,
      'EQUIPMENT_UPDATE': 3,
      'CHAT_UPDATE': 4,
      'ERROR': 5
    }
    
    return typeMap[type] || 0
  }
  
  /**
   * Validate update data - can be overridden by subclasses
   */
  validate() {
    if (!this.type || typeof this.type !== 'number') {
      throw new Error('Update type is required and must be a number')
    }
    
    if (!Array.isArray(this.affectedPlayers)) {
      throw new Error('affectedPlayers must be an array')
    }
    
    return true
  }
  
  /**
   * Serialize update to JSON for network transmission
   */
  toJSON() {
    return {
      type: this.type,
      affectedPlayers: this.affectedPlayers,
      timestamp: this.timestamp,
      data: this.getData()
    }
  }
  
  /**
   * Get update-specific data - must be implemented by subclasses
   */
  getData() {
    return {}
  }
  
  /**
   * Check if this update affects a specific player
   */
  affectsPlayer(playerId) {
    return this.affectedPlayers.includes(playerId)
  }
  
  /**
   * Add a player to the affected players list
   */
  addAffectedPlayer(playerId) {
    if (!this.affectedPlayers.includes(playerId)) {
      this.affectedPlayers.push(playerId)
    }
  }
}

/**
 * Utility function to generate update IDs
 */
export function generateUpdateId() {
  return `upd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}