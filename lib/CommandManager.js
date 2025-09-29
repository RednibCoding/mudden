import MovementCommands from './commands/MovementCommands.js'
import InventoryCommands from './commands/InventoryCommands.js'
import CombatCommands from './commands/CombatCommands.js'
import SocialCommands from './commands/SocialCommands.js'
import InfoCommands from './commands/InfoCommands.js'
import SystemCommands from './commands/SystemCommands.js'
import QuestCommands from './commands/QuestCommands.js'
import CtxStateManager from './CtxStateManager.js'

class CommandManager {
  constructor(gameWorld, players, combatSessions, io) {
    this.gameWorld = gameWorld
    this.players = players
    this.combatSessions = combatSessions
    this.io = io
    
    // Initialize contextual state manager
    this.ctxStateManager = new CtxStateManager()
    
    // Register contextual states with their exception commands
    this.setupCtxStates()
    
    // Initialize command categories
    this.questCommands = new QuestCommands(gameWorld, players, combatSessions, io, this)
    this.commandCategories = [
      new MovementCommands(gameWorld, players, combatSessions, io, this),
      new InventoryCommands(gameWorld, players, combatSessions, io, this),
      new CombatCommands(gameWorld, players, combatSessions, io, this),
      new SocialCommands(gameWorld, players, combatSessions, io, this),
      new InfoCommands(gameWorld, players, combatSessions, io, this),
      new SystemCommands(gameWorld, players, combatSessions, io, this),
      this.questCommands
    ]
    
    // Make quest system and contextual state manager available to GameWorld for cross-system access
    gameWorld.questSystem = this.questCommands
    gameWorld.ctxStateManager = this.ctxStateManager
    
    // Build command registry
    this.commands = {}
    this.commandCategories.forEach(category => {
      const categoryCommands = category.getCommands()
      Object.assign(this.commands, categoryCommands)
    })
  }

  // Setup contextual states and their exception commands
  setupCtxStates() {
    // Quest reward viewing - only cleared by commands other than quest info and look
    this.ctxStateManager.registerState('viewingQuestRewards', [
      'quest', 'look', 'l', 'examine', 'ex'
    ])
  }

  // Process command from player input
  processCommand(player, input) {
    if (!input || typeof input !== 'string') {
      return "Please enter a command."
    }

    const parts = input.trim().split(/\s+/)
    const commandName = parts[0].toLowerCase()
    const args = parts.slice(1)

    // Find and execute command
    const command = this.commands[commandName]
    if (command) {
      try {
        // Reset contextual states before command execution
        this.ctxStateManager.resetStatesForCommand(player, commandName)
        
        return command(player, args)
      } catch (error) {
        console.error(`Error executing command '${commandName}':`, error)
        return "Something went wrong with that command."
      }
    }

    return `Unknown command: "${commandName}". Type "help" for available commands.`
  }

  // Get list of all available commands
  getAvailableCommands() {
    return Object.keys(this.commands).sort()
  }
  
  // Get command instance by class name for cross-command communication
  getCommandInstance(className) {
    return this.commandCategories.find(category => 
      category.constructor.name === className
    )
  }
}

export default CommandManager