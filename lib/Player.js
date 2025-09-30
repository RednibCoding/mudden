import fs from 'fs'
import path from 'path'
import { QUEST_STATUS } from './constants/QuestConstants.js'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLAYERS_DIR = path.join(__dirname, '../persist/players')

class Player {
  constructor(name) {
    this.name = name
    this.passwordHash = null // Will be set when password is created
    this.health = 100
    this.maxHealth = 100
    this.level = 1
    this.experience = 0
    this.gold = 50
    this.currentArea = 'town_area'
    this.currentRoom = 'town_square'
    this.inventory = [
    ]
    this.equipment = {
      main_hand: null,
      off_hand: null,
      chest: null,
      legs: null,
      head: null,
      feet: null,
      hands: null
    }
    this.stats = {
      strength: 10,
      defense: 5,
      speed: 8
    }
    this.activeQuests = []     // Enriched quest data for accepted quests
    this.completedQuests = []  // Array of quest IDs for completed quests
    this.inCombat = false
    this.homestone = null // { area: 'area_id', room: 'room_id' }
    this.channel = 'room' // Default channel: room, area, world
    
    // Track onetime items this player has taken (area.room.item format)
    this.takenOnetimeItems = []
    
    // Track onetime enemies this player has defeated (area.room.enemy format)
    this.defeatedOnetimeEnemies = []
    
    // Health recovery system
    this.recoveryTimer = null
    
    this.lastSaved = new Date().toISOString()
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
        // Exclude timer objects that can't be serialized
        recoveryTimer: null,
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
        player.recoveryTimer = null

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
    const existingItem = this.inventory.find(item => item.id === itemId)
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      this.inventory.push({ id: itemId, quantity })
    }
    
    // Sync quest progress with complete inventory state
    this.syncQuestProgressWithInventory()
  }

  // Remove item from inventory
  removeItem(itemId, quantity = 1) {
    const itemIndex = this.inventory.findIndex(item => item.id === itemId)
    if (itemIndex !== -1) {
      const item = this.inventory[itemIndex]
      item.quantity -= quantity
      if (item.quantity <= 0) {
        this.inventory.splice(itemIndex, 1)
      }
      
      // Sync quest progress with complete inventory state
      this.syncQuestProgressWithInventory()
      
      return true
    }
    return false
  }

  // Check if player has item
  hasItem(itemId, quantity = 1) {
    const item = this.inventory.find(item => item.id === itemId)
    return item && item.quantity >= quantity
  }

  // Equip item
  equip(itemId, slot) {
    if (this.hasItem(itemId)) {
      // Unequip current item in slot if any
      if (this.equipment[slot]) {
        this.addItem(this.equipment[slot])
      }
      // Equip new item
      this.equipment[slot] = itemId
      this.removeItem(itemId, 1)
      return true
    }
    return false
  }

  // Unequip item
  unequip(slot) {
    if (this.equipment[slot]) {
      this.addItem(this.equipment[slot])
      this.equipment[slot] = null
      return true
    }
    return false
  }

  // Calculate total stats (base + equipment bonuses)
  getTotalStats(gameWorld = null) {
    const totalStats = { ...this.stats }
    
    // Add equipment bonuses if GameWorld reference is provided
    if (this.equipment && gameWorld) {
      for (const [slot, itemId] of Object.entries(this.equipment)) {
        if (itemId) {
          const itemTemplate = gameWorld.getItem(itemId)
          if (itemTemplate && itemTemplate.effects) {
            // Add stat bonuses from equipment
            if (itemTemplate.effects.strength) {
              totalStats.strength = (totalStats.strength || 0) + itemTemplate.effects.strength
            }
            if (itemTemplate.effects.defense) {
              totalStats.defense = (totalStats.defense || 0) + itemTemplate.effects.defense
            }
            if (itemTemplate.effects.speed) {
              totalStats.speed = (totalStats.speed || 0) + itemTemplate.effects.speed
            }
          }
        }
      }
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

  // Start health recovery when out of combat
  startHealthRecovery(updateCallback) {
    if (this.recoveryTimer || this.inCombat || this.health >= this.maxHealth) {
      return
    }

    this.recoveryTimer = setInterval(() => {
      if (this.inCombat || this.health >= this.maxHealth) {
        this.stopHealthRecovery()
        return
      }

      const healAmount = Math.ceil(this.maxHealth * 0.02) // 2% of max health
      const oldHealth = this.health
      this.health = Math.min(this.maxHealth, this.health + healAmount)
      
      // Only send message when reaching full health
      if (this.health >= this.maxHealth && oldHealth < this.maxHealth) {
        if (updateCallback) {
          updateCallback(this, "You feel completely refreshed and at full health.")
        }
        this.stopHealthRecovery()
      } else {
        // Send silent update for health bar
        if (updateCallback) {
          updateCallback(this, null)
        }
      }
      
      // Always save health changes
      this.save()
    }, 5000) // Every 5 seconds
  }

  // Stop health recovery
  stopHealthRecovery() {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer)
      this.recoveryTimer = null
    }
  }
}

export default Player