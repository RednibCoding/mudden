import MovementCommands from './commands/MovementCommands.js'
import InventoryCommands from './commands/InventoryCommands.js'
import CombatCommands from './commands/CombatCommands.js'
import SocialCommands from './commands/SocialCommands.js'
import InfoCommands from './commands/InfoCommands.js'
import SystemCommands from './commands/SystemCommands.js'
import QuestCommands from './commands/QuestCommands.js'
import FriendsCommands from './commands/FriendsCommands.js'
import TradeCommands from './commands/TradeCommands.js'
import CombatManager from './CombatManager.js'
import TradeManager from './TradeManager.js'

class CommandManager {
  constructor(worldManager, sessionManager, combatSessions, io) {
    this.worldManager = worldManager
    this.sessionManager = sessionManager
    this.players = sessionManager.getActivePlayers() // Keep this for compatibility
    this.combatSessions = combatSessions
    this.io = io
    
    // Initialize managers
    this.combatManager = new CombatManager(worldManager, this.players, io)
    this.tradeManager = new TradeManager(worldManager, sessionManager, io)
    
    // Initialize command categories
    this.questCommands = new QuestCommands(worldManager, this.players, combatSessions, io, this)
    this.combatCommands = new CombatCommands(worldManager, this.players, combatSessions, io, this)
    this.tradeCommands = new TradeCommands(worldManager, this.players, combatSessions, io, this)
    
    // Inject managers into command categories
    this.combatCommands.setCombatManager(this.combatManager)
    
    this.commandCategories = [
      new MovementCommands(worldManager, this.players, combatSessions, io, this),
      new InventoryCommands(worldManager, this.players, combatSessions, io, this),
      this.combatCommands,
      new SocialCommands(worldManager, this.players, combatSessions, io, this),
      new InfoCommands(worldManager, this.players, combatSessions, io, this),
      new SystemCommands(worldManager, this.players, combatSessions, io, this),
      new FriendsCommands(worldManager, this.players, combatSessions, io, this),
      this.questCommands,
      this.tradeCommands
    ]
    
    // Make quest system and combat manager available to WorldManager for cross-system access
    worldManager.questSystem = this.questCommands
    worldManager.combatManager = this.combatManager
    
    // Build command registry
    this.commands = {}
    this.commandCategories.forEach(category => {
      const categoryCommands = category.getCommands()
      Object.assign(this.commands, categoryCommands)
    })
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

  // Handle cleanup when player moves or enters combat
  handlePlayerActionCleanup(playerName, action) {
    // Cancel any active trades
    this.tradeManager.cancelTrade(playerName, `Trade cancelled - player ${action}`)
  }
}

export default CommandManager