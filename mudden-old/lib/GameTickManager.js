class GameTickManager {
  constructor() {
    this.currentTick = 0
    this.tickInterval = null
    this.tickHandlers = new Map() // System name -> handler function
    
    // External system handlers
    this.combatHandler = null
    this.healthRegenHandler = null
    this.respawnHandler = null
    this.cleanupHandler = null
    
    // Register core systems with their tick intervals
    this.registerSystem('combat', this.processCombat.bind(this))           // Every 3 ticks (3s)
    this.registerSystem('healthRegen', this.processHealthRegeneration.bind(this)) // Every 5 ticks (5s)
    this.registerSystem('respawns', this.processRespawns.bind(this))       // Every 1 tick (check pending)
    this.registerSystem('cleanup', this.processCleanup.bind(this))         // Every 60 ticks (1 min)
  }

  // Start the global tick system
  start(tickDurationMs = 1000) {
    if (this.tickInterval) {
      console.warn('GameTickManager already started')
      return
    }
    
    console.log(`Starting game tick system (${tickDurationMs}ms per tick)`)
    this.tickInterval = setInterval(() => {
      this.processTick()
    }, tickDurationMs)
  }

  // Stop the tick system
  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
      console.log('Game tick system stopped')
    }
  }

  // Register a system to receive tick events
  registerSystem(name, handler) {
    this.tickHandlers.set(name, handler)
  }

  // Process a single game tick
  processTick() {
    this.currentTick++
    
    // Process all registered systems
    for (const [systemName, handler] of this.tickHandlers) {
      try {
        handler(this.currentTick)
      } catch (error) {
        console.error(`Error in ${systemName} tick handler:`, error)
      }
    }
  }

  // Combat system - process every 3 ticks (3 seconds)
  processCombat(tick) {
    if (tick % 3 !== 0) return // Only every 3rd tick
    
    // Use combat manager if available, fallback to legacy handler
    if (this.combatManager) {
      this.combatManager.processCombatTick()
    } else if (this.combatHandler) {
      this.combatHandler(tick)
    }
  }

  // Set combat manager reference
  setCombatManager(combatManager) {
    this.combatManager = combatManager
  }

  // Health regeneration - process every 5 ticks (5 seconds)
  processHealthRegeneration(tick) {
    if (tick % 5 !== 0) return // Only every 5th tick
    
    // This will be called by the player health system
    if (this.healthRegenHandler) {
      this.healthRegenHandler(tick)
    }
  }

  // Set combat handler (called by CombatCommands)
  setCombatHandler(handler) {
    this.combatHandler = handler
  }

  // Set health regen handler (called by Player health system)
  setHealthRegenHandler(handler) {
    this.healthRegenHandler = handler
  }

  // Set respawn handler (called by GameWorld)
  setRespawnHandler(handler) {
    this.respawnHandler = handler
  }

  // Set cleanup handler (called by server)
  setCleanupHandler(handler) {
    this.cleanupHandler = handler  
  }

  // Respawn system - check every tick for pending respawns
  processRespawns(tick) {
    if (this.respawnHandler) {
      this.respawnHandler(tick)
    }
  }

  // Cleanup system - process every 60 ticks (1 minute)
  processCleanup(tick) {
    if (tick % 60 !== 0) return // Only every 60th tick
    
    if (this.cleanupHandler) {
      this.cleanupHandler(tick)
    }
  }

  // Get current tick for debugging
  getCurrentTick() {
    return this.currentTick
  }

  // Check if it's a combat tick
  isCombatTick(tick = this.currentTick) {
    return tick % 3 === 0
  }

  // Check if it's a health regen tick
  isHealthRegenTick(tick = this.currentTick) {
    return tick % 5 === 0
  }
}

export default GameTickManager