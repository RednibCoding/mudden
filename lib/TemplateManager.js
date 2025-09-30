import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class TemplateManager {
  constructor() {
    // Template storage - all use filename as ID
    this.areas = new Map()      // areaId -> area data with rooms
    this.items = new Map()      // itemId -> item template
    this.enemies = new Map()    // enemyId -> enemy template  
    this.npcs = new Map()       // npcId -> npc template
    this.quests = new Map()     // questId -> quest template
    
    // Template paths
    this.templatePaths = {
      areas: path.join(__dirname, '../templates/areas'),
      items: path.join(__dirname, '../templates/items'), 
      enemies: path.join(__dirname, '../templates/enemies'),
      npcs: path.join(__dirname, '../templates/npcs'),
      quests: path.join(__dirname, '../templates/quests')
    }
    
    this.loadAllTemplates()
  }

  // Load all templates at startup
  loadAllTemplates() {
    try {
      this.loadAreas()
      this.loadItems()
      this.loadEnemies()
      this.loadNPCs()
      this.loadQuests()
      console.log('All templates loaded successfully')
    } catch (error) {
      console.error('Failed to load templates:', error)
      throw error
    }
  }

  // Load area templates - each area folder contains room JSON files
  loadAreas() {
    const areasPath = this.templatePaths.areas
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
        const roomData = this.loadJsonFile(path.join(areaPath, roomFile))
        rooms[roomId] = { ...roomData, id: roomId, areaId: areaFolder }
      }
      
      this.areas.set(areaFolder, {
        id: areaFolder,
        name: this.formatAreaName(areaFolder),
        rooms
      })
    }
    
    console.log(`Loaded ${this.areas.size} areas`)
  }

  // Load item templates
  loadItems() {
    this.loadTemplateDirectory('items', this.items)
    console.log(`Loaded ${this.items.size} items`)
  }

  // Load enemy templates
  loadEnemies() {
    this.loadTemplateDirectory('enemies', this.enemies)
    console.log(`Loaded ${this.enemies.size} enemies`)
  }

  // Load NPC templates
  loadNPCs() {
    this.loadTemplateDirectory('npcs', this.npcs)
    console.log(`Loaded ${this.npcs.size} NPCs`)
  }

  // Load quest templates
  loadQuests() {
    this.loadTemplateDirectory('quests', this.quests)
    console.log(`Loaded ${this.quests.size} quests`)
  }

  // Generic template directory loader
  loadTemplateDirectory(templateType, targetMap) {
    const templatePath = this.templatePaths[templateType]
    if (!fs.existsSync(templatePath)) {
      console.warn(`${templateType} directory not found`)
      return
    }

    const templateFiles = fs.readdirSync(templatePath).filter(file => 
      file.endsWith('.json') && file !== 'README.md'
    )
    
    for (const templateFile of templateFiles) {
      const templateId = path.basename(templateFile, '.json')
      const templateData = this.loadJsonFile(path.join(templatePath, templateFile))
      targetMap.set(templateId, { ...templateData, id: templateId })
    }
  }

  // Safe JSON file loading with error handling
  loadJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.error(`Failed to load template file ${filePath}:`, error)
      throw error
    }
  }

  // Format area folder name to display name
  formatAreaName(areaFolder) {
    return areaFolder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // === GETTER METHODS ===

  // Get area by ID
  getArea(areaId) {
    return this.areas.get(areaId) || null
  }

  // Get all areas
  getAllAreas() {
    return Array.from(this.areas.values())
  }

  // Get room from area
  getRoom(areaId, roomId) {
    const area = this.getArea(areaId)
    return area?.rooms[roomId] || null
  }

  // Get item template by ID
  getItem(itemId) {
    return this.items.get(itemId) || null
  }

  // Get all items
  getAllItems() {
    return Array.from(this.items.values())
  }

  // Get enemy template by ID  
  getEnemy(enemyId) {
    return this.enemies.get(enemyId) || null
  }

  // Get all enemies
  getAllEnemies() {
    return Array.from(this.enemies.values())
  }

  // Get NPC template by ID
  getNPC(npcId) {
    return this.npcs.get(npcId) || null
  }

  // Get all NPCs
  getAllNPCs() {
    return Array.from(this.npcs.values())
  }

  // Get quest template by ID
  getQuest(questId) {
    return this.quests.get(questId) || null
  }

  // Get all quests
  getAllQuests() {
    return Array.from(this.quests.values())
  }

  // === ENRICHED DATA METHODS ===

  // Get enriched item with computed properties
  getEnrichedItem(itemId) {
    const item = this.getItem(itemId)
    if (!item) return null

    return {
      ...item,
      // Add computed properties
      displayName: item.name || this.formatItemName(itemId),
      isEquippable: !!(item.equipment && item.equipment.slot),
      isConsumable: item.type === 'consumable',
      isReadable: item.type === 'readable',
      hasStats: !!(item.stats && Object.keys(item.stats).length > 0)
    }
  }

  // Get enriched enemy with combat properties initialized
  getEnrichedEnemy(enemyId) {
    const enemy = this.getEnemy(enemyId)
    if (!enemy) return null

    return {
      ...enemy,
      // Add computed properties
      displayName: enemy.name || this.formatEnemyName(enemyId),
      combatName: enemy.name || this.formatEnemyName(enemyId),
      currentHealth: enemy.health || enemy.stats?.health || 30,
      maxHealth: enemy.health || enemy.stats?.health || 30,
      threatTable: {}, // Initialize empty threat table
      // Combat stats
      damage: enemy.stats?.damage || [1, 3],
      defense: enemy.stats?.defense || 0,
      accuracy: enemy.stats?.accuracy || 80
    }
  }

  // Get enriched NPC with dialogue state
  getEnrichedNPC(npcId) {
    const npc = this.getNPC(npcId)
    if (!npc) return null

    return {
      ...npc,
      // Add computed properties
      displayName: npc.name || this.formatNPCName(npcId),
      hasDialogue: !!(npc.dialogue && npc.dialogue.length > 0),
      hasQuests: !!(npc.quests && npc.quests.length > 0),
      canTrade: !!(npc.shop && npc.shop.items)
    }
  }

  // Get enriched quest with progress tracking setup
  getEnrichedQuest(questId) {
    const quest = this.getQuest(questId)
    if (!quest) return null

    return {
      ...quest,
      // Add computed properties
      displayName: quest.name || this.formatQuestName(questId),
      hasRewards: !!(quest.rewards && (quest.rewards.gold || quest.rewards.items)),
      hasRequirements: !!(quest.requirements && Object.keys(quest.requirements).length > 0),
      stepCount: quest.objectives ? quest.objectives.length : 0
    }
  }

  // === UTILITY METHODS ===

  // Format item ID to display name
  formatItemName(itemId) {
    return itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format enemy ID to display name
  formatEnemyName(enemyId) {
    return enemyId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format NPC ID to display name
  formatNPCName(npcId) {
    return npcId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format quest ID to display name
  formatQuestName(questId) {
    return questId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Check if template exists
  hasItem(itemId) {
    return this.items.has(itemId)
  }

  hasEnemy(enemyId) {
    return this.enemies.has(enemyId)
  }

  hasNPC(npcId) {
    return this.npcs.has(npcId)
  }

  hasQuest(questId) {
    return this.quests.has(questId)
  }

  hasArea(areaId) {
    return this.areas.has(areaId)
  }

  // Get template counts for debugging
  getTemplateCounts() {
    return {
      areas: this.areas.size,
      items: this.items.size,  
      enemies: this.enemies.size,
      npcs: this.npcs.size,
      quests: this.quests.size
    }
  }

  // Reload specific template type (for development/testing)
  reloadTemplateType(templateType) {
    switch (templateType) {
      case 'areas':
        this.areas.clear()
        this.loadAreas()
        break
      case 'items':
        this.items.clear()
        this.loadItems()
        break
      case 'enemies':
        this.enemies.clear()
        this.loadEnemies()
        break
      case 'npcs':
        this.npcs.clear()
        this.loadNPCs()
        break
      case 'quests':
        this.quests.clear()
        this.loadQuests()
        break
      default:
        console.warn(`Unknown template type: ${templateType}`)
    }
  }

  // Reload all templates
  reloadAllTemplates() {
    this.areas.clear()
    this.items.clear()
    this.enemies.clear()
    this.npcs.clear()
    this.quests.clear()
    this.loadAllTemplates()
  }
}

export default TemplateManager