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
    const areasPath = path.join(__dirname, '../data/areas')
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
    const itemsPath = path.join(__dirname, '../data/items')
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
    const enemiesPath = path.join(__dirname, '../data/enemies')
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
    const npcsPath = path.join(__dirname, '../data/npcs')
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
    const questsPath = path.join(__dirname, '../data/quests')
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
  getRoom(areaId, roomId) {
    const area = this.areas.get(areaId)
    if (!area) return null
    
    const room = area.rooms[roomId]
    if (!room) return null
    
    // Enrich room with full item/enemy/npc data
    return {
      ...room,
      items: (room.items || []).map(itemId => this.getItem(itemId)).filter(Boolean),
      enemies: (room.enemies || []).map(enemyId => this.getEnemy(enemyId)).filter(Boolean),
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



  
}

export default GameWorld