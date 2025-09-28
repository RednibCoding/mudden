import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Content data interfaces
interface Item {
  id: string
  name: string
  description: string
  type: string
  slot?: string  // Equipment slot (weapon, shield, chest, helmet, etc.)
  value?: number
  damage?: number
  armor?: number
  consumable?: boolean
  [key: string]: any
}

interface Room {
  id: string
  title: string
  description: string
  items?: string[]
  npcs?: string[]
  enemies?: string[]
  [key: string]: any
}

interface NPC {
  id: string
  name: string
  description: string
  dialogue?: {
    greeting?: string
    responses?: Record<string, string>
  }
  shop?: {
    items?: string[]
    services?: string[]
  }
  hostile?: boolean
  stats?: {
    health: number
    strength: number
    defense: number
  }
  [key: string]: any
}

interface Quest {
  id: string
  title: string
  description: string
  questGiver: string
  type: 'fetch' | 'gather' | 'kill'
  levelRequired?: number
  level?: number
  objectives: {
    fetch?: Array<{ npc: string; item: string; description: string }>
    gather?: Array<{ item: string; quantity: number; description: string }>
    kill?: Array<{ enemy: string; quantity: number; description: string }>
  }
  rewards: {
    gold?: number
    xp?: number
    items?: string[]
  }
  questText: string
  completionText: string
  repeatable: boolean
  requirements?: {
    level?: number
    completedQuests?: string[]
  }
  [key: string]: any
}

interface Enemy {
  id: string
  name: string
  description: string
  health: number
  damage: number
  experience: number
  loot?: string[]
  [key: string]: any
}

interface AreaMap {
  areaId: string
  name: string
  description: string
  gridSize: {
    width: number
    height: number
  }
  rooms: Record<string, Room>
  connections?: Record<string, any>
}

// Global caches for loaded content
let itemsCache: Record<string, Item> | null = null
let roomsCache: Record<string, Room> | null = null
let npcsCache: Record<string, NPC> | null = null
let enemiesCache: Record<string, Enemy> | null = null
let mapsCache: Record<string, AreaMap> | null = null
let questsCache: Record<string, Quest> | null = null

/**
 * ContentService - Manages all static game content from JSON files
 * This service loads and caches all game data on first access
 */
export class ContentService {
  
  // === UTILITY METHODS ===
  
  /**
   * Sanitize filename to create valid ID
   * - Remove file extension
   * - Replace whitespace with underscores
   * - Remove invalid characters (keep only alphanumeric, underscore, hyphen)
   * - Convert to lowercase for consistency
   */
  private static sanitizeFilenameToId(filename: string): string {
    return filename
      .replace('.json', '')           // Remove extension
      .toLowerCase()                  // Convert to lowercase
      .replace(/\s+/g, '_')          // Replace whitespace with underscores
      .replace(/[^a-z0-9_-]/g, '')   // Remove invalid characters
  }
  
  // === ITEMS ===
  
  static getItems(): Record<string, Item> {
    if (!itemsCache) {
      try {
        const itemsDir = join(process.cwd(), 'data', 'items')
        const itemFiles = readdirSync(itemsDir).filter(file => file.endsWith('.json'))
        
        itemsCache = {}
        
        for (const file of itemFiles) {
          try {
            const itemPath = join(itemsDir, file)
            const itemData = JSON.parse(readFileSync(itemPath, 'utf-8'))
            const itemId = this.sanitizeFilenameToId(file)
            
            // Add sanitized ID from filename to the item object
            itemData.id = itemId
            itemsCache[itemId] = itemData
          } catch (fileError) {
            console.error(`Error loading item file ${file}:`, fileError)
          }
        }
        
        console.log(`Loaded ${Object.keys(itemsCache).length} items from individual files`)
      } catch (error) {
        console.error('Error loading items directory:', error)
        itemsCache = {}
      }
    }
    return itemsCache!
  }
  
  static getItem(itemId: string): Item | null {
    const items = this.getItems()
    return items[itemId] || null
  }
  
  static validateItemId(itemId: string): boolean {
    return this.getItem(itemId) !== null
  }
  
  static getAllItemIds(): string[] {
    return Object.keys(this.getItems())
  }
  
  // === ROOMS ===
  
  static getRooms(): Record<string, Room> {
    if (!roomsCache) {
      try {
        const roomsDir = join(process.cwd(), 'data', 'rooms')
        const roomFiles = readdirSync(roomsDir).filter(file => file.endsWith('.json'))
        
        roomsCache = {}
        
        for (const file of roomFiles) {
          try {
            const roomPath = join(roomsDir, file)
            const roomData = JSON.parse(readFileSync(roomPath, 'utf-8'))
            const roomId = this.sanitizeFilenameToId(file)
            
            // Add sanitized ID from filename to the room object
            roomData.id = roomId
            roomsCache[roomId] = roomData
          } catch (fileError) {
            console.error(`Error loading room file ${file}:`, fileError)
          }
        }
        
        console.log(`Loaded ${Object.keys(roomsCache).length} rooms from individual files`)
      } catch (error) {
        console.error('Error loading rooms directory:', error)
        roomsCache = {}
      }
    }
    return roomsCache!
  }
  
  static getRoom(roomId: string): Room | null {
    const rooms = this.getRooms()
    return rooms[roomId] || null
  }
  
  // === NPCS ===
  
  static getNPCs(): Record<string, NPC> {
    if (!npcsCache) {
      try {
        const npcsDir = join(process.cwd(), 'data', 'npcs')
        const npcFiles = readdirSync(npcsDir).filter(file => file.endsWith('.json'))
        
        npcsCache = {}
        
        for (const file of npcFiles) {
          try {
            const npcPath = join(npcsDir, file)
            const npcData = JSON.parse(readFileSync(npcPath, 'utf-8'))
            const npcId = this.sanitizeFilenameToId(file)
            
            // Add sanitized ID from filename to the NPC object
            npcData.id = npcId
            npcsCache[npcId] = npcData
          } catch (fileError) {
            console.error(`Error loading NPC file ${file}:`, fileError)
          }
        }
        
        console.log(`Loaded ${Object.keys(npcsCache).length} NPCs from individual files`)
      } catch (error) {
        console.error('Error loading NPCs directory:', error)
        npcsCache = {}
      }
    }
    return npcsCache!
  }
  
  static getNPC(npcId: string): NPC | null {
    const npcs = this.getNPCs()
    return npcs[npcId] || null
  }
  
  // === ENEMIES ===
  
  static getEnemies(): Record<string, Enemy> {
    if (!enemiesCache) {
      try {
        const enemiesPath = join(process.cwd(), 'data', 'enemies.json')
        const enemiesData = JSON.parse(readFileSync(enemiesPath, 'utf-8'))
        enemiesCache = enemiesData.enemies || {}
      } catch (error) {
        console.error('Error loading enemies.json:', error)
        enemiesCache = {}
      }
    }
    return enemiesCache!
  }
  
  static getEnemy(enemyId: string): Enemy | null {
    const enemies = this.getEnemies()
    return enemies[enemyId] || null
  }
  
  // === AREA MAPS ===
  
  static getAreaMaps(): Record<string, AreaMap> {
    if (!mapsCache) {
      mapsCache = {}
      try {
        // Load all map files from data/maps/ directory
        const mapsDir = join(process.cwd(), 'data', 'maps')
        const mapFiles = readdirSync(mapsDir).filter((file: string) => file.endsWith('.json'))
        
        for (const mapFile of mapFiles) {
          const mapPath = join(mapsDir, mapFile)
          const mapData = JSON.parse(readFileSync(mapPath, 'utf-8'))
          // Use areaId from file if present, otherwise sanitize filename
          const areaId = mapData.areaId || this.sanitizeFilenameToId(mapFile)
          mapData.areaId = areaId
          mapsCache[areaId] = mapData
        }
      } catch (error) {
        console.error('Error loading area maps:', error)
      }
    }
    return mapsCache
  }
  
  static getAreaMap(areaId: string): AreaMap | null {
    const maps = this.getAreaMaps()
    return maps[areaId] || null
  }
  
  // === UTILITY METHODS ===
  
  // Enrich inventory items with full item data
  static enrichInventoryItems(inventoryItems: any[]): any[] {
    return inventoryItems.map(invItem => {
      const itemData = this.getItem(invItem.item_id)
      return {
        ...invItem,
        item: itemData
      }
    })
  }
  
  // Validate multiple item IDs
  static validateItemIds(itemIds: string[]): { valid: string[], invalid: string[] } {
    const valid: string[] = []
    const invalid: string[] = []
    
    for (const itemId of itemIds) {
      if (this.validateItemId(itemId)) {
        valid.push(itemId)
      } else {
        invalid.push(itemId)
      }
    }
    
    return { valid, invalid }
  }
  
    // Clear all caches (useful for development)
  static clearCaches() {
    itemsCache = null
    roomsCache = null
    npcsCache = null
    enemiesCache = null
    mapsCache = null
    questsCache = null
  }
  
  // === QUESTS ===
  
  static getQuests(): Record<string, Quest> {
    if (!questsCache) {
      try {
        const questsDir = join(process.cwd(), 'data', 'quests')
        const questFiles = readdirSync(questsDir).filter(file => file.endsWith('.json'))
        
        questsCache = {}
        
        for (const file of questFiles) {
          try {
            const questPath = join(questsDir, file)
            const questData = JSON.parse(readFileSync(questPath, 'utf-8'))
            const questId = this.sanitizeFilenameToId(file)
            
            // Add sanitized ID from filename to the quest object
            questData.id = questId
            questsCache[questId] = questData
          } catch (fileError) {
            console.error(`Error loading quest file ${file}:`, fileError)
          }
        }
        
        console.log(`Loaded ${Object.keys(questsCache).length} quests from individual files`)
      } catch (error) {
        console.error('Error loading quests directory:', error)
        questsCache = {}
      }
    }
    return questsCache!
  }

  static getQuest(questId: string): Quest | null {
    const quests = this.getQuests()
    return quests[questId] || null
  }

  static getQuestsByGiver(npcId: string): Quest[] {
    const quests = this.getQuests()
    return Object.values(quests).filter(quest => quest.questGiver === npcId)
  }

  static getAllQuestIds(): string[] {
    return Object.keys(this.getQuests())
  }
  
  // Get content stats
  static getStats() {
    return {
      items: Object.keys(this.getItems()).length,
      rooms: Object.keys(this.getRooms()).length,
      npcs: Object.keys(this.getNPCs()).length,
      enemies: Object.keys(this.getEnemies()).length,
      areas: Object.keys(this.getAreaMaps()).length,
      quests: Object.keys(this.getQuests()).length
    }
  }
}

export default ContentService