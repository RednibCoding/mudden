import fs from 'fs'
import path from 'path'
import { QUEST_STATUS } from './constants/QuestConstants.js'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLAYERS_DIR = path.join(__dirname, '../persist/players')

class Player {
  static inventoryManager = null // Will be set by WorldManager
  static equipmentManager = null // Will be set by WorldManager
  
  constructor(name, currentArea = 'town_area', currentRoom = 'town_square') {
    this.name = name
    this.level = 1
    this.experience = 0
    this.maxHealth = 100
    this.currentHealth = 100
    this.gold = 100
    this.currentArea = currentArea
    this.currentRoom = currentRoom
    this.equipment = {}
    this.inventory = []
    this.inCombat = false
    this.healthRecoveryTimer = null
    this.friends = []
    this.friendNotes = {}
    this.questProgress = new Map()
    this.onetimeItems = []
  }

  // Save player to JSON file
  save() {
    try {
      this.lastSaved = new Date().toISOString()
      
      // Sync quest progress with current inventory as safety measure
      this.syncQuestProgressWithInventory()
      
      const filePath = path.join(PLAYERS_DIR, `${this.name}.json`)
      
      // Create save data excluding non-serializable and session-only fields
      const saveData = {
        ...this,
        takenOnetimeItems: this.takenOnetimeItems,
        defeatedOnetimeEnemies: this.defeatedOnetimeEnemies,
        // Exclude callback objects that can't be serialized
        healthRecoveryCallback: null,
        // Exclude session-only preferences
        channel: undefined
      }
      
      fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2))
      return true
    } catch (error) {
      console.error('Failed to save player:', error)
      return false
    }
  }

  // Load player from JSON file
  static load(name) {
    try {
      const filePath = path.join(PLAYERS_DIR, `${name}.json`)
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const player = new Player(name)
        // Copy all properties from saved data
        Object.assign(player, data)

        // Load quest progression data
        player.activeQuests = data.activeQuests || []
        player.completedQuests = data.completedQuests || []
        
        // Initialize onetime tracking arrays
        if (Array.isArray(data.takenOnetimeItems)) {
          player.takenOnetimeItems = data.takenOnetimeItems
        } else {
          player.takenOnetimeItems = []
        }
        
        if (Array.isArray(data.defeatedOnetimeEnemies)) {
          player.defeatedOnetimeEnemies = data.defeatedOnetimeEnemies
        } else {
          player.defeatedOnetimeEnemies = []
        }
        
        // Ensure non-serializable fields are properly initialized
        player.healthRecoveryCallback = null

        player.inCombat = false

        player.channel = 'room' // Default channel: room, area, world
        
        // Sync quest progress with current inventory as safety measure
        player.syncQuestProgressWithInventory()
        return player
      }
    } catch (error) {
      console.error('Failed to load player:', error)
    }
    // Return new player if file doesn't exist or failed to load
    return new Player(name)
  }

  // Add item to inventory
  addItem(itemId, quantity = 1) {
    if (!Player.inventoryManager) {
      throw new Error('InventoryManager not initialized')
    }
    
    const success = Player.inventoryManager.addItem(this, itemId, quantity)
    if (success) {
      this.syncQuestProgressWithInventory()
    }
    return success
  }

  // Remove item from inventory
  removeItem(itemId, quantity = 1) {
    if (!Player.inventoryManager) {
      throw new Error('InventoryManager not initialized')
    }
    
    const success = Player.inventoryManager.removeItem(this, itemId, quantity)
    if (success) {
      this.syncQuestProgressWithInventory()
    }
    return success
  }

  // Check if player has item
  hasItem(itemId, quantity = 1) {
    if (!Player.inventoryManager) {
      throw new Error('InventoryManager not initialized')
    }
    
    return Player.inventoryManager.hasItem(this, itemId, quantity)
  }

  // Equip item
  equip(itemId, slot) {
    if (!Player.equipmentManager) {
      throw new Error('EquipmentManager not initialized')
    }
    
    return Player.equipmentManager.equipItem(this, itemId, slot)
  }

  // Unequip item
  unequip(slot) {
    if (!Player.equipmentManager) {
      throw new Error('EquipmentManager not initialized')
    }
    
    return Player.equipmentManager.unequipItem(this, slot)
  }

  // Calculate total stats (base + equipment bonuses)
  getTotalStats() {
    const baseStats = this.stats || { strength: 0, defense: 0, speed: 0 }
    const totalStats = { ...baseStats }
    
    // Add equipment bonuses if EquipmentManager is available
    if (Player.equipmentManager) {
      const equipmentStats = Player.equipmentManager.getEquipmentStats(this)
      totalStats.strength += equipmentStats.strength
      totalStats.defense += equipmentStats.defense
      totalStats.speed += equipmentStats.speed
    }
    
    return totalStats
  }

  // Heal player
  heal(amount) {
    this.health = Math.min(this.health + amount, this.maxHealth)
  }

  // Damage player
  damage(amount) {
    this.health = Math.max(0, this.health - amount)
    return this.health <= 0 // Return true if player died
  }

  // Add experience and handle level up
  addExperience(amount) {
    this.experience += amount
    
    // Calculate level based on exponential progression
    // Level 1: 0 exp, Level 2: 100 exp, Level 3: 250 exp, Level 4: 450 exp, etc.
    let newLevel = 1
    let expNeededForThisLevel = 0
    
    while (true) {
      const expNeededForNextLevel = expNeededForThisLevel + (100 + (newLevel - 1) * 50)
      if (this.experience >= expNeededForNextLevel) {
        newLevel++
        expNeededForThisLevel = expNeededForNextLevel
      } else {
        break
      }
    }
    
    if (newLevel > this.level) {
      const levelsGained = newLevel - this.level
      this.level = newLevel
      
      // Level up bonuses
      this.maxHealth += levelsGained * 10
      this.health = this.maxHealth // Full heal on level up
      this.stats.strength += levelsGained
      this.stats.defense += levelsGained
      this.stats.speed += levelsGained
      
      return levelsGained
    }
    return 0
  }

  // Calculate total experience needed to reach a specific level
  getExpForLevel(targetLevel) {
    if (targetLevel <= 1) return 0
    
    let totalExp = 0
    for (let level = 1; level < targetLevel; level++) {
      totalExp += 100 + (level - 1) * 50 // Same formula as addExperience
    }
    return totalExp
  }

  // Get current location info
  getLocation() {
    return {
      area: this.currentArea,
      room: this.currentRoom
    }
  }

  // Check if player has taken a specific onetime item
  hasTakenOnetimeItem(areaId, roomId, itemId) {
    const key = `${areaId}.${roomId}.${itemId}`
    return this.takenOnetimeItems.includes(key)
  }

  // Mark onetime item as taken
  takeOnetimeItem(areaId, roomId, itemId) {
    const key = `${areaId}.${roomId}.${itemId}`
    if (!this.takenOnetimeItems.includes(key)) {
      this.takenOnetimeItems.push(key)
    }
  }

  // Check if player has defeated a specific onetime enemy
  hasDefeatedOnetimeEnemy(areaId, roomId, enemyId) {
    const key = `${areaId}.${roomId}.${enemyId}`
    return this.defeatedOnetimeEnemies.includes(key)
  }

  // Mark onetime enemy as defeated
  defeatOnetimeEnemy(areaId, roomId, enemyId) {
    const key = `${areaId}.${roomId}.${enemyId}`
    if (!this.defeatedOnetimeEnemies.includes(key)) {
      this.defeatedOnetimeEnemies.push(key)
    }
  }

  // Move to new location
  moveTo(areaId, roomId) {
    this.currentArea = areaId
    this.currentRoom = roomId
  }

  // Password management
  setPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    this.passwordHash = { salt, hash }
  }

  verifyPassword(password) {
    if (!this.passwordHash) return false
    const { salt, hash } = this.passwordHash
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return hash === verifyHash
  }

  hasPassword() {
    return !!this.passwordHash
  }

  // Static method to check if character exists and needs password
  static characterExists(name) {
    const filePath = path.join(PLAYERS_DIR, `${name}.json`)
    return fs.existsSync(filePath)
  }

  // Static method to check if character exists (case-insensitive)
  static characterExistsCaseInsensitive(name) {
    const targetName = name.toLowerCase()
    
    try {
      // Read all files in the players directory
      const files = fs.readdirSync(PLAYERS_DIR)
      
      // Check if any existing player file matches (case-insensitive)
      return files.some(file => {
        if (file.endsWith('.json')) {
          const existingName = file.slice(0, -5).toLowerCase() // Remove .json extension
          return existingName === targetName
        }
        return false
      })
    } catch (error) {
      console.error('Error checking for case-insensitive character existence:', error)
      return false
    }
  }

  static needsPassword(name) {
    try {
      const filePath = path.join(PLAYERS_DIR, `${name}.json`)
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return !!data.passwordHash
      }
    } catch (error) {
      console.error('Failed to check password requirement:', error)
    }
    return false
  }

  // Sync quest progress with current inventory (safety measure)
  syncQuestProgressWithInventory() {
    if (!this.activeQuests) return

    this.activeQuests.forEach(playerQuest => {
      if (playerQuest.status !== QUEST_STATUS.ACCEPTED || !playerQuest.objectives) return
      
      // Sync each objective with current inventory
      for (let i = 0; i < playerQuest.objectives.length; i++) {
        const objective = playerQuest.objectives[i]
        
        if (objective.type === 'collect') {
          const playerItem = this.inventory.find(item => item.id === objective.target)
          const availableQuantity = playerItem ? Math.min(playerItem.quantity, objective.quantity) : 0
          const currentProgress = objective.current || 0
          
          if (availableQuantity !== currentProgress) {
            playerQuest.objectives[i].current = availableQuantity
          }
        }
      }
    })
  }

  // Start health recovery when out of combat (tick-based)
  startHealthRecovery() {
    // Health recovery is handled by the global tick system
    // Nothing to do here - just ensure inCombat is false
  }

  // Stop health recovery
  stopHealthRecovery() {
    // Health recovery stops automatically when inCombat is true
    // Nothing to do here
  }
  
  // Process health recovery tick (called by global system)
  processHealthRecoveryTick() {
    if (this.inCombat || this.health >= this.maxHealth) {
      return false // No recovery needed
    }

    const healAmount = Math.ceil(this.maxHealth * 0.02) // 2% of max health
    const oldHealth = this.health
    this.health = Math.min(this.maxHealth, this.health + healAmount)
    
    // Send message when reaching full health
    if (this.health >= this.maxHealth && oldHealth < this.maxHealth) {
      const socket = global.getPlayerSocket(this.name)
      if (socket) {
        socket.emit('output', "You feel completely refreshed and at full health.")
        socket.emit('gameState', {
          player: {
            name: this.name,
            level: this.level,
            health: this.health,
            maxHealth: this.maxHealth,
            gold: this.gold,
            location: this.location,
            inCombat: this.inCombat,
            currentArea: this.currentArea,
            currentRoom: this.currentRoom
          }
        })
      }
    } else {
      // Send silent health bar update
      const socket = global.getPlayerSocket(this.name)
      if (socket) {
        socket.emit('gameState', {
          player: {
            name: this.name,
            level: this.level,
            health: this.health,
            maxHealth: this.maxHealth,
            gold: this.gold,
            location: this.location,
            inCombat: this.inCombat,
            currentArea: this.currentArea,
            currentRoom: this.currentRoom
          }
        })
      }
    }
    
    // Always save health changes
    this.save()
    return true // Recovery processed
  }
}

export default Player