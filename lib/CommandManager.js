import MovementCommands from './commands/MovementCommands.js'
import InventoryCommands from './commands/InventoryCommands.js'
import CombatCommands from './commands/CombatCommands.js'
import SocialCommands from './commands/SocialCommands.js'
import InfoCommands from './commands/InfoCommands.js'
import SystemCommands from './commands/SystemCommands.js'

class CommandManager {
  constructor(gameWorld, players, combatSessions, io) {
    this.gameWorld = gameWorld
    this.players = players
    this.combatSessions = combatSessions
    this.io = io
    
    // Initialize command categories
    this.commandCategories = [
      new MovementCommands(gameWorld, players, combatSessions, io),
      new InventoryCommands(gameWorld, players, combatSessions, io),
      new CombatCommands(gameWorld, players, combatSessions, io),
      new SocialCommands(gameWorld, players, combatSessions, io),
      new InfoCommands(gameWorld, players, combatSessions, io),
      new SystemCommands(gameWorld, players, combatSessions, io)
    ]
    
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
}

export default CommandManager