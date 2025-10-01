import { CommandTypes } from './CommandTypes.js'
import { MoveCommand, LookCommand } from './commands/MovementCommands.js'
import { TakeItemCommand, DropItemCommand, UseItemCommand } from './commands/InventoryCommands.js'
import { EquipItemCommand, UnequipItemCommand } from './commands/EquipmentCommands.js'
import { SayCommand, TellCommand, EmoteCommand } from './commands/SocialCommands.js'
import { StatsCommand, HealthCommand, EquipmentDisplayCommand, ExamineCommand } from './commands/InfoCommands.js'

/**
 * Factory for creating command instances from JSON data
 * Maps command types to their respective classes
 */
export class CommandFactory {
    static commandMap = {
        [CommandTypes.MOVE]: MoveCommand,
        [CommandTypes.LOOK]: LookCommand,
        [CommandTypes.TAKE_ITEM]: TakeItemCommand,
        [CommandTypes.DROP_ITEM]: DropItemCommand,
        [CommandTypes.USE_ITEM]: UseItemCommand,
        [CommandTypes.EQUIP_ITEM]: EquipItemCommand,
        [CommandTypes.UNEQUIP_ITEM]: UnequipItemCommand,
        [CommandTypes.SAY]: SayCommand,
        [CommandTypes.TELL]: TellCommand,
        [CommandTypes.EMOTE]: EmoteCommand,
        [CommandTypes.STATS]: StatsCommand,
        [CommandTypes.HEALTH]: HealthCommand,
        [CommandTypes.EQUIPMENT_DISPLAY]: EquipmentDisplayCommand,
        [CommandTypes.EXAMINE]: ExamineCommand,
        // Add more command mappings as needed
    }

    /**
     * Create command instance from JSON data
     * @param {Object} data - Command data from client
     * @returns {BaseCommand} Command instance
     */
    static fromJSON(data) {
        const CommandClass = this.commandMap[data.type]
        if (!CommandClass) {
            throw new Error(`Unknown command type: ${data.type}`)
        }
        
        return CommandClass.fromJSON(data)
    }

    /**
     * Register a new command type
     * @param {number} type - Command type constant
     * @param {Class} CommandClass - Command class constructor
     */
    static register(type, CommandClass) {
        this.commandMap[type] = CommandClass
    }

    /**
     * Get all registered command types
     * @returns {number[]} Array of command type constants
     */
    static getRegisteredTypes() {
        return Object.keys(this.commandMap).map(Number)
    }
}