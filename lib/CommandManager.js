import MovementCommands from './commands/MovementCommands.js'
import InventoryCommands from './commands/InventoryCommands.js'
import CombatCommands from './commands/CombatCommands.js'
import SocialCommands from './commands/SocialCommands.js'
import InfoCommands from './commands/InfoCommands.js'
import SystemCommands from './commands/SystemCommands.js'
import QuestCommands from './commands/QuestCommands.js'
import FriendsCommands from './commands/FriendsCommands.js'
import CombatManager from './CombatManager.js'

class CommandManager {
  constructor(worldManager, players, combatSessions, io) {
    this.worldManager = worldManager
    this.players = players
    this.combatSessions = combatSessions
    this.io = io
    
    // Initialize combat manager
    this.combatManager = new CombatManager(worldManager, players, io)
    
    // Initialize command categories
    this.questCommands = new QuestCommands(worldManager, players, combatSessions, io, this)
    this.combatCommands = new CombatCommands(worldManager, players, combatSessions, io, this)
    
    // Inject combat manager into combat commands
    this.combatCommands.setCombatManager(this.combatManager)
    
    this.commandCategories = [
      new MovementCommands(worldManager, players, combatSessions, io, this),
      new InventoryCommands(worldManager, players, combatSessions, io, this),
      this.combatCommands,
      new SocialCommands(worldManager, players, combatSessions, io, this),
      new InfoCommands(worldManager, players, combatSessions, io, this),
      new SystemCommands(worldManager, players, combatSessions, io, this),
      new FriendsCommands(worldManager, players, combatSessions, io, this),
      this.questCommands
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
}

export default CommandManager