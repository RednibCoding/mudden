import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import TemplateManager from './TemplateManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WorldManager {
  constructor() {
    // Initialize template manager - handles all template loading
    this.templateManager = new TemplateManager()
    
    // Track respawning items: "areaId.roomId.itemId" -> { respawnTime, respawnTick }
    this.respawningItems = new Map()
    
    // Track respawning enemies: "areaId.roomId.enemyId" -> { respawnTime, respawnTick }
    this.respawningEnemies = new Map()
    
    // Track shared enemy instances: "areaId.roomId.enemyId" -> enemy instance
    this.activeEnemyInstances = new Map()
    
    // Track pending respawns for tick system: "key" -> { respawnTick, type: 'item'|'enemy' }
    this.pendingRespawns = new Map()
    
    console.log('World manager initialized with TemplateManager')
  }



  // Get room data
  getRoom(areaId, roomId, player = null) {
    const area = this.templateManager.getArea(areaId)
    if (!area) return null
    
    const room = area.rooms[roomId]
    if (!room) return null
    
    // Process items - enhanced object format only
    const processedItems = []
    for (const itemEntry of room.items || []) {
      if (typeof itemEntry === 'object' && itemEntry.id) {
        const itemData = this.templateManager.getItem(itemEntry.id)
        
        if (itemData) {
          const respawnConfig = {
            id: itemEntry.id,
            onetime: itemEntry.onetime || false,
            respawnTime: itemEntry.respawnTime || 0,
            quest: itemEntry.quest || null
          }
          
          // Skip items that require a quest the player doesn't have
          if (respawnConfig.quest && player) {
            const hasQuest = player.activeQuests && player.activeQuests.some(quest => 
              quest.id === respawnConfig.quest && quest.status === 'accepted'
            )
            if (!hasQuest) {
              continue
            }
          }
          
          // Skip onetime items that this player has already taken (but not for quest items)
          if (respawnConfig.onetime && !respawnConfig.quest && player && player.hasTakenOnetimeItem(areaId, roomId, respawnConfig.id)) {
            continue
          }
          
          // Check if this item is currently respawning
          const respawnKey = `${areaId}.${roomId}.${respawnConfig.id}`
          const isRespawning = this.respawningItems.has(respawnKey)
          
          // Only include item if it's not currently respawning
          if (!isRespawning) {
            processedItems.push({
              ...itemData,
              _respawnConfig: respawnConfig
            })
          }
        }
      }
    }
    
    // Process enemies - enhanced object format with respawn and quest support
    const processedEnemies = []
    for (const enemyEntry of room.enemies || []) {
      if (typeof enemyEntry === 'object' && enemyEntry.id) {
        const enemyData = this.templateManager.getEnemy(enemyEntry.id)
        if (enemyData) {
          const respawnConfig = {
            id: enemyEntry.id,
            onetime: enemyEntry.onetime || false,
            respawnTime: enemyEntry.respawnTime || 0,
            quest: enemyEntry.quest || null
          }
          
          // Skip enemies that require a quest the player doesn't have
          if (respawnConfig.quest && player) {
            const hasQuest = player.activeQuests && player.activeQuests.some(quest => 
              quest.id === respawnConfig.quest && quest.status === 'accepted'
            )
            if (!hasQuest) {
              continue
            }
          }
          
          // Skip onetime enemies that this player has already defeated
          if (respawnConfig.onetime && player && player.hasDefeatedOnetimeEnemy(areaId, roomId, respawnConfig.id)) {
            continue
          }
          
          const respawnKey = `${areaId}.${roomId}.${enemyEntry.id}`
          
          // Check if enemy is respawning
          if (!this.respawningEnemies.has(respawnKey)) {
            // Get or create shared enemy instance
            const sharedInstance = this.getSharedEnemyInstance(areaId, roomId, enemyEntry.id)
            if (sharedInstance) {
              processedEnemies.push({
                ...sharedInstance,
                _respawnConfig: respawnConfig
              })
            }
          }
        }
      }
    }
    
    // Enrich room with full item/enemy/npc data
    return {
      ...room,
      items: processedItems,
      enemies: processedEnemies,
      npcs: (room.npcs || []).map(npcId => this.templateManager.getNPC(npcId)).filter(Boolean)
    }
  }



  // Get or create shared enemy instance for a specific room location
  getSharedEnemyInstance(areaId, roomId, enemyId) {
    const instanceKey = `${areaId}.${roomId}.${enemyId}`
    
    // Return existing instance if available
    if (this.activeEnemyInstances.has(instanceKey)) {
      return this.activeEnemyInstances.get(instanceKey)
    }
    
    // Create new instance from template
    const enemyTemplate = this.templateManager.getEnemy(enemyId)
    if (!enemyTemplate) {
      return null
    }
    
    // Create instance with current health
    const enemyInstance = {
      ...enemyTemplate,
      currentHealth: enemyTemplate.stats?.health || enemyTemplate.maxHealth || 30,
      maxHealth: enemyTemplate.stats?.health || enemyTemplate.maxHealth || 30,
      instanceKey: instanceKey
    }
    
    // Store the instance
    this.activeEnemyInstances.set(instanceKey, enemyInstance)
    
    return enemyInstance
  }

  // Remove shared enemy instance (on death or respawn)
  removeSharedEnemyInstance(areaId, roomId, enemyId) {
    const instanceKey = `${areaId}.${roomId}.${enemyId}`
    return this.activeEnemyInstances.delete(instanceKey)
  }

  // Update shared enemy instance health
  updateSharedEnemyHealth(areaId, roomId, enemyId, newHealth) {
    const instanceKey = `${areaId}.${roomId}.${enemyId}`
    const instance = this.activeEnemyInstances.get(instanceKey)
    
    if (instance) {
      instance.currentHealth = Math.max(0, newHealth)
      return true
    }
    
    return false
  }

  // Get all quests
  getAllQuests() {
    return this.templateManager.getAllQuests()
  }

  // Get area info
  getArea(areaId) {
    return this.templateManager.getArea(areaId)
  }

  // Get all available exits from a room
  getRoomExits(areaId, roomId) {
    const room = this.getRoom(areaId, roomId)
    return room ? room.exits || {} : {}
  }

  // Handle item pickup with respawn logic
  takeItem(areaId, roomId, itemId) {
    const respawnKey = `${areaId}.${roomId}.${itemId}`
    
    // Get the original room data to find respawn config
    const area = this.templateManager.getArea(areaId)
    if (!area) return false
    
    const room = area.rooms[roomId]
    if (!room) return false
    
    // Find the item config in the room
    const itemConfig = room.items?.find(item => 
      typeof item === 'object' && item.id === itemId
    )
    
    if (!itemConfig) return false
    
    // If item is not onetime and has respawn time, schedule respawn
    if (!itemConfig.onetime && itemConfig.respawnTime > 0) {
      // Calculate respawn tick (respawnTime in ms / 1000ms per tick)
      const respawnTicks = Math.ceil(itemConfig.respawnTime / 1000)
      const respawnTick = this.getCurrentTick() + respawnTicks
      
      this.respawningItems.set(respawnKey, {
        respawnTime: itemConfig.respawnTime,
        respawnTick: respawnTick
      })
      
      this.pendingRespawns.set(respawnKey, {
        respawnTick: respawnTick,
        type: 'item'
      })
      
      console.log(`Item ${itemId} will respawn at tick ${respawnTick}`)
    }
    // If respawnTime is 0 or null, item is always available (no timer needed)
    
    return true
  }

  // Respawn an item (remove from respawning tracker)
  respawnItem(respawnKey) {
    const respawnData = this.respawningItems.get(respawnKey)
    if (respawnData) {
      this.respawningItems.delete(respawnKey)
      console.log(`Item respawned: ${respawnKey}`)
    }
  }

  // Handle enemy defeat with respawn logic
  defeatEnemy(areaId, roomId, enemyId) {
    const respawnKey = `${areaId}.${roomId}.${enemyId}`
    
    const area = this.templateManager.getArea(areaId)
    if (!area) return false
    
    const room = area.rooms[roomId]
    if (!room) return false
    
    // Find the enemy config in the room
    const enemyConfig = room.enemies?.find(enemy => 
      typeof enemy === 'object' && enemy.id === enemyId
    )
    
    if (!enemyConfig) return false
    
    // Remove the shared enemy instance immediately
    this.removeSharedEnemyInstance(areaId, roomId, enemyId)
    
    // If enemy is not onetime and has respawn time, schedule respawn
    if (!enemyConfig.onetime && enemyConfig.respawnTime > 0) {
      // Calculate respawn tick (respawnTime in ms / 1000ms per tick)
      const respawnTicks = Math.ceil(enemyConfig.respawnTime / 1000)
      const respawnTick = this.getCurrentTick() + respawnTicks
      
      this.respawningEnemies.set(respawnKey, {
        respawnTime: respawnConfig.respawnTime,
        respawnTick: respawnTick
      })
      
      this.pendingRespawns.set(respawnKey, {
        respawnTick: respawnTick,
        type: 'enemy'
      })
      
      console.log(`Enemy ${enemyId} will respawn at tick ${respawnTick}`)
    }
    // If respawnTime is 0 or null, enemy is always available (no timer needed)
    
    return true
  }

  // Respawn an enemy (remove from respawning tracker)
  respawnEnemy(respawnKey) {
    const respawnData = this.respawningEnemies.get(respawnKey)
    if (respawnData) {
      this.respawningEnemies.delete(respawnKey)
      console.log(`Enemy respawned: ${respawnKey}`)
    }
  }

  // Process respawns on each tick
  processRespawnTick(currentTick) {
    const respawnsToProcess = []
    
    // Find all respawns ready for this tick
    for (const [key, respawnData] of this.pendingRespawns) {
      if (currentTick >= respawnData.respawnTick) {
        respawnsToProcess.push({ key, ...respawnData })
      }
    }
    
    // Process ready respawns
    for (const respawn of respawnsToProcess) {
      if (respawn.type === 'item') {
        this.respawnItem(respawn.key)
      } else if (respawn.type === 'enemy') {
        this.respawnEnemy(respawn.key)
      }
      
      // Remove from pending respawns
      this.pendingRespawns.delete(respawn.key)
    }
  }
  
  // Get current tick from game tick manager (will be set by server)
  getCurrentTick() {
    return this.gameTickManager ? this.gameTickManager.getCurrentTick() : 0
  }
  
  // Set reference to game tick manager
  setGameTickManager(gameTickManager) {
    this.gameTickManager = gameTickManager
  }

  // Clean up respawn timers (call on server shutdown)
  cleanup() {
    // No more individual timers to clear!
    this.respawningItems.clear()
    this.respawningEnemies.clear()
    this.pendingRespawns.clear()
    
    // Clear shared enemy instances
    this.activeEnemyInstances.clear()
  }
}

export default WorldManager