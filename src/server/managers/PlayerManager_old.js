/**
 * Player Manager - handles player data, authentication, and state management
 */
export class PlayerManager {
  constructor(worldManager, inventoryManager, equipmentManager) {
    this.worldManager = worldManager
    this.inventoryManager = inventoryManager
    this.equipmentManager = equipmentManager
    this.players = new Map() // playerId -> player data
    
    console.log('PlayerManager initialized')
  }
  
  /**
   * Get player by ID
   */
  getPlayer(playerId) {
    return this.players.get(playerId)
  }
  
  /**
   * Add/update player
   */
  setPlayer(playerId, playerData) {
    this.players.set(playerId, playerData)
  }
}