import { CommandQueue } from './CommandQueue.js'
import { TickProcessor } from './TickProcessor.js'
import { UpdateDistributor } from './UpdateDistributor.js'
import { SocketManager } from './SocketManager.js'
import { CommandErrorUpdate } from '../shared/updates/SystemUpdates.js'
import { ErrorCodes } from '../shared/ErrorCodes.js'

// Import managers
import { TemplateManager } from './managers/TemplateManager.js'
import { PlayerManager } from './managers/PlayerManager.js'
import { WorldManager } from './managers/WorldManager.js'
import { InventoryManager } from './managers/InventoryManager.js'
import { EquipmentManager } from './managers/EquipmentManager.js'
import { SocialManager } from './managers/SocialManager.js'
import { MovementManager } from './managers/MovementManager.js'

/**
 * Main Game Engine - orchestrates the tick-based game loop
 * Handles command collection, processing, and update distribution
 */
export class GameEngine {
  constructor() {
    // Initialize managers first
    this.managers = this.initializeManagers()
    
    // Core systems (some depend on managers)
    this.commandQueue = new CommandQueue()
    this.tickProcessor = new TickProcessor(this.managers)
    this.updateDistributor = new UpdateDistributor()
    this.socketManager = new SocketManager(this)
    
    // Tick configuration
    this.tickInterval = 1000 // 1 second
    this.currentTick = 0
    this.isRunning = false
    this.tickTimeout = null
    
    console.log('GameEngine initialized')
  }
  
  /**
   * Initialize all game managers with proper dependencies
   */
  initializeManagers() {
    // Initialize template manager first
    const templateManager = new TemplateManager()
    
    // Initialize dependent managers
    const worldManager = new WorldManager(templateManager)
    const inventoryManager = new InventoryManager(templateManager)
    const equipmentManager = new EquipmentManager(templateManager)
    const playerManager = new PlayerManager()
    const socialManager = new SocialManager()
    const movementManager = new MovementManager()
    
    console.log('MovementManager initialized')
    
    return {
      templateManager: templateManager,
      worldManager: worldManager,
      inventoryManager: inventoryManager,
      equipmentManager: equipmentManager,
      playerManager: playerManager,
      socialManager: socialManager,
      movementManager: movementManager
    }
  }
  
  /**
   * Start the game engine and begin tick processing
   */
  start() {
    if (this.isRunning) {
      console.warn('GameEngine is already running')
      return
    }
    
    console.log('Starting GameEngine...')
    this.isRunning = true
    
    // Connect UpdateDistributor with SocketManager
    this.updateDistributor.setSocketManager(this.socketManager)
    
    // Start the socket server
    this.socketManager.start()
    
    // Start the tick loop
    this.scheduleNextTick()
    
    console.log(`GameEngine started with ${this.tickInterval}ms tick interval`)
  }
  
  /**
   * Stop the game engine
   */
  stop() {
    console.log('Stopping GameEngine...')
    this.isRunning = false
    
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout)
      this.tickTimeout = null
    }
    
    this.socketManager.stop()
    console.log('GameEngine stopped')
  }
  
  /**
   * Schedule the next tick
   */
  scheduleNextTick() {
    if (!this.isRunning) return
    
    this.tickTimeout = setTimeout(() => {
      this.processTick()
      this.scheduleNextTick()
    }, this.tickInterval)
  }
  
  /**
   * Process a single game tick
   */
  processTick() {
    const tickStart = Date.now()
    this.currentTick++
    
    try {
      // Get all commands from this tick cycle
      const commands = this.commandQueue.getAndClear()
      
      if (commands.length > 0) {
        console.log(`Tick ${this.currentTick}: Processing ${commands.length} commands`)
        
        // Process all commands atomically
        const updates = this.tickProcessor.processCommands(commands.map(c => c.command))
        
        // Distribute updates to clients
        if (updates.length > 0) {
          this.updateDistributor.distribute(updates)
          console.log(`Tick ${this.currentTick}: Sent ${updates.length} updates`)
        }
      }
      
      // Performance monitoring
      const tickDuration = Date.now() - tickStart
      if (tickDuration > this.tickInterval * 0.8) {
        console.warn(`Tick ${this.currentTick} took ${tickDuration}ms (${Math.round(tickDuration / this.tickInterval * 100)}% of budget)`)
      }
      
    } catch (error) {
      console.error(`Tick ${this.currentTick} error:`, error)
    }
  }
  
  /**
   * Add a command to the queue for processing
   */
  addCommand(command) {
    try {
      // Validate command before queuing
      command.validate()
      this.commandQueue.add(command)
      
    } catch (error) {
      console.error('Command validation failed:', error)
      
      // Send immediate error response for invalid commands
      const errorUpdate = new CommandErrorUpdate(
        command.playerId,
        command.commandId,
        ErrorCodes.COMMAND_VALIDATION_FAILED,
        { error: error.message }
      )
      
      this.updateDistributor.sendToPlayer(command.playerId, errorUpdate)
    }
  }
  
  /**
   * Get current game statistics
   */
  getStats() {
    return {
      currentTick: this.currentTick,
      isRunning: this.isRunning,
      tickInterval: this.tickInterval,
      queuedCommands: this.commandQueue.size(),
      connectedPlayers: this.socketManager.getConnectedPlayerCount(),
      uptime: process.uptime()
    }
  }
}