import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class GameWorld {
  constructor() {
    this.areas = new Map()
    this.items = new Map()
    this.enemies = new Map()
    this.npcs = new Map()
    this.quests = new Map()
    
    // Track respawning items: "areaId.roomId.itemId" -> { respawnTime, timerId }
    this.respawningItems = new Map()
    
    // Track respawning enemies: "areaId.roomId.enemyId" -> { respawnTime, timerId }
    this.respawningEnemies = new Map()
    
    this.loadContent()
  }

  // Load all game content from JSON files
  loadContent() {
    try {
      this.loadAreas()
      this.loadItems()
      this.loadEnemies()
      this.loadNPCs()
      this.loadQuests()
      console.log('Game content loaded successfully')
    } catch (error) {
      console.error('Failed to load game content:', error)
    }
  }

    // Load area data - simple room-based system
  loadAreas() {
    const areasPath = path.join(__dirname, '../templates/areas')
    if (!fs.existsSync(areasPath)) {
      console.warn('Areas directory not found')
      return
    }

    const areaFolders = fs.readdirSync(areasPath).filter(item => 
      fs.statSync(path.join(areasPath, item)).isDirectory()
    )

    for (const areaFolder of areaFolders) {
      const areaPath = path.join(areasPath, areaFolder)
      
      // Load individual room files
      const rooms = {}
      const roomFiles = fs.readdirSync(areaPath).filter(file => 
        file.endsWith('.json')
      )
      
      for (const roomFile of roomFiles) {
        const roomId = path.basename(roomFile, '.json')
        const roomData = JSON.parse(fs.readFileSync(path.join(areaPath, roomFile), 'utf8'))
        rooms[roomId] = { ...roomData, id: roomId, areaId: areaFolder }
      }
      
      this.areas.set(areaFolder, {
        id: areaFolder,
        name: areaFolder.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        rooms
      })
    }
    
    console.log(`Loaded ${this.areas.size} areas`)
  }

  // Load item templates
  loadItems() {
    const itemsPath = path.join(__dirname, '../templates/items')
    if (!fs.existsSync(itemsPath)) {
      console.warn('Items directory not found')
      return
    }

    const itemFiles = fs.readdirSync(itemsPath).filter(file => file.endsWith('.json'))
    
    for (const itemFile of itemFiles) {
      const itemId = path.basename(itemFile, '.json')
      const itemData = JSON.parse(fs.readFileSync(path.join(itemsPath, itemFile), 'utf8'))
      this.items.set(itemId, { ...itemData, id: itemId })
    }
    
    console.log(`Loaded ${this.items.size} items`)
  }

  // Load enemy templates
  loadEnemies() {
    const enemiesPath = path.join(__dirname, '../templates/enemies')
    if (!fs.existsSync(enemiesPath)) {
      console.warn('Enemies directory not found')
      return
    }

    const enemyFiles = fs.readdirSync(enemiesPath).filter(file => 
      file.endsWith('.json') && file !== 'README.md'
    )
    
    for (const enemyFile of enemyFiles) {
      const enemyId = path.basename(enemyFile, '.json')
      const enemyData = JSON.parse(fs.readFileSync(path.join(enemiesPath, enemyFile), 'utf8'))
      this.enemies.set(enemyId, { ...enemyData, id: enemyId })
    }
    
    console.log(`Loaded ${this.enemies.size} enemies`)
  }

  // Load NPC templates
  loadNPCs() {
    const npcsPath = path.join(__dirname, '../templates/npcs')
    if (!fs.existsSync(npcsPath)) {
      console.warn('NPCs directory not found')
      return
    }

    const npcFiles = fs.readdirSync(npcsPath).filter(file => file.endsWith('.json'))
    
    for (const npcFile of npcFiles) {
      const npcId = path.basename(npcFile, '.json')
      const npcData = JSON.parse(fs.readFileSync(path.join(npcsPath, npcFile), 'utf8'))
      this.npcs.set(npcId, { ...npcData, id: npcId })
    }
    
    console.log(`Loaded ${this.npcs.size} NPCs`)
  }

  // Load quest templates
  loadQuests() {
    const questsPath = path.join(__dirname, '../templates/quests')
    if (!fs.existsSync(questsPath)) {
      console.warn('Quests directory not found')
      return
    }

    const questFiles = fs.readdirSync(questsPath).filter(file => 
      file.endsWith('.json') && file !== 'README.md'
    )
    
    for (const questFile of questFiles) {
      const questId = path.basename(questFile, '.json')
      const questData = JSON.parse(fs.readFileSync(path.join(questsPath, questFile), 'utf8'))
      this.quests.set(questId, { ...questData, id: questId })
    }
    
    console.log(`Loaded ${this.quests.size} quests`)
  }

  // Get room data
  getRoom(areaId, roomId, player = null) {
    const area = this.areas.get(areaId)
    if (!area) return null
    
    const room = area.rooms[roomId]
    if (!room) return null
    
    // Process items - enhanced object format only
    const processedItems = []
    for (const itemEntry of room.items || []) {
      if (typeof itemEntry === 'object' && itemEntry.id) {
        const itemData = this.getItem(itemEntry.id)
        
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
        const enemyData = this.getEnemy(enemyEntry.id)
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
            processedEnemies.push({
              ...enemyData,
              _respawnConfig: respawnConfig
            })
          }
        }
      }
    }
    
    // Enrich room with full item/enemy/npc data
    return {
      ...room,
      items: processedItems,
      enemies: processedEnemies,
      npcs: (room.npcs || []).map(npcId => this.getNPC(npcId)).filter(Boolean)
    }
  }

  // Get item template
  getItem(itemId) {
    return this.items.get(itemId) || null
  }

  // Get enemy template
  getEnemy(enemyId) {
    return this.enemies.get(enemyId) || null
  }

  // Get NPC template
  getNPC(npcId) {
    return this.npcs.get(npcId) || null
  }

  // Get quest template
  getQuest(questId) {
    return this.quests.get(questId) || null
  }

  // Get all quests
  getAllQuests() {
    return Array.from(this.quests.values())
  }

  // Get area info
  getArea(areaId) {
    return this.areas.get(areaId) || null
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
    const area = this.areas.get(areaId)
    if (!area) return false
    
    const room = area.rooms[roomId]
    if (!room) return false
    
    // Find the item config in the room
    const itemConfig = room.items?.find(item => 
      typeof item === 'object' && item.id === itemId
    )
    
    if (!itemConfig) return false
    
    // If item is not onetime and has respawn time, start respawn timer
    if (!itemConfig.onetime && itemConfig.respawnTime > 0) {
      const timerId = setTimeout(() => {
        this.respawnItem(respawnKey)
      }, itemConfig.respawnTime)
      
      this.respawningItems.set(respawnKey, {
        respawnTime: itemConfig.respawnTime,
        timerId: timerId
      })
    }
    // If respawnTime is 0 or null, item is always available (no timer needed)
    
    return true
  }

  // Respawn an item (remove from respawning tracker)
  respawnItem(respawnKey) {
    const respawnData = this.respawningItems.get(respawnKey)
    if (respawnData) {
      clearTimeout(respawnData.timerId)
      this.respawningItems.delete(respawnKey)
      console.log(`Item respawned: ${respawnKey}`)
    }
  }

  // Handle enemy defeat with respawn logic
  defeatEnemy(areaId, roomId, enemyId) {
    const respawnKey = `${areaId}.${roomId}.${enemyId}`
    
    const area = this.areas.get(areaId)
    if (!area) return false
    
    const room = area.rooms[roomId]
    if (!room) return false
    
    // Find the enemy config in the room
    const enemyConfig = room.enemies?.find(enemy => 
      typeof enemy === 'object' && enemy.id === enemyId
    )
    
    if (!enemyConfig) return false
    
    // If enemy is not onetime and has respawn time, start respawn timer
    if (!enemyConfig.onetime && enemyConfig.respawnTime > 0) {
      const timerId = setTimeout(() => {
        this.respawnEnemy(respawnKey)
      }, enemyConfig.respawnTime)
      
      this.respawningEnemies.set(respawnKey, {
        respawnTime: enemyConfig.respawnTime,
        timerId: timerId
      })
      
      console.log(`Enemy ${enemyId} will respawn in ${enemyConfig.respawnTime}ms`)
    }
    // If respawnTime is 0 or null, enemy is always available (no timer needed)
    
    return true
  }

  // Respawn an enemy (remove from respawning tracker)
  respawnEnemy(respawnKey) {
    const respawnData = this.respawningEnemies.get(respawnKey)
    if (respawnData) {
      clearTimeout(respawnData.timerId)
      this.respawningEnemies.delete(respawnKey)
      console.log(`Enemy respawned: ${respawnKey}`)
    }
  }

  // Clean up respawn timers (call on server shutdown)
  cleanup() {
    for (const [key, data] of this.respawningItems) {
      clearTimeout(data.timerId)
    }
    this.respawningItems.clear()
    
    for (const [key, data] of this.respawningEnemies) {
      clearTimeout(data.timerId)
    }
    this.respawningEnemies.clear()
  }
}

export default GameWorld