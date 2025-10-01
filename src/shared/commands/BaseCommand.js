/**
 * Base class for all game commands
 * Provides common functionality like validation, serialization, and ID generation
 */
export class BaseCommand {
  constructor(type, playerId, commandId = null) {
    this.type = type
    this.playerId = playerId
    this.commandId = commandId || this.generateId()
    this.timestamp = Date.now()
  }
  
  /**
   * Generate unique command ID for tracking
   */
  generateId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Validate command data - must be implemented by subclasses
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.type || typeof this.type !== 'number') {
      throw new Error('Command type is required and must be a number')
    }
    
    if (!this.playerId || typeof this.playerId !== 'string') {
      throw new Error('Player ID is required and must be a string')
    }
    
    return true
  }
  
  /**
   * Serialize command to JSON for network transmission
   */
  toJSON() {
    return {
      type: this.type,
      playerId: this.playerId,
      commandId: this.commandId,
      timestamp: this.timestamp,
      ...this.getPayload()
    }
  }
  
  /**
   * Get command-specific payload data - must be implemented by subclasses
   */
  getPayload() {
    return {}
  }
  
  /**
   * Execute the command - must be implemented by subclasses
   * @param {Object} managers - Object containing all game managers
   * @returns {Array} Array of BaseUpdate objects
   */
  execute(managers) {
    throw new Error('execute() must be implemented by subclass')
  }
  
  /**
   * Create command instance from JSON data
   */
  static fromJSON(data) {
    throw new Error('fromJSON() must be implemented by subclass')
  }
}

/**
 * Utility function to generate command IDs
 */
export function generateCommandId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}