import { BaseUpdate } from '../shared/BaseUpdate.js'
import { CommandTypes } from '../shared/CommandTypes.js'
import { CommandFactory } from '../shared/CommandFactory.js'

/**
 * TickProcessor - processes queued commands and generates updates
 * Handles command routing, validation, and update generation
 */
export class TickProcessor {
    constructor(managers) {
        this.managers = managers
        
        // Quick access to frequently used managers
        this.playerManager = managers.playerManager
        this.worldManager = managers.worldManager
        this.inventoryManager = managers.inventoryManager
        this.equipmentManager = managers.equipmentManager
        this.templateManager = managers.templateManager
    }

    /**
     * Process all queued commands and generate updates
     * @param {BaseCommand[]} commands
     * @returns {BaseUpdate[]}
     */
    processCommands(commands) {
        const updates = []

        for (const command of commands) {
            try {
                const commandUpdates = this.handleCommand(command)
                updates.push(...commandUpdates)
            } catch (error) {
                console.error('Error processing command:', error)
                updates.push(new BaseUpdate(command.playerId, 'ERROR', {
                    message: 'Command processing failed'
                }))
            }
        }

        // Process additional game logic (health regen, combat, etc.)
        // This would be where background processes are handled

        return updates
    }

    /**
     * Route command to appropriate handler using command's execute method
     * @param {BaseCommand} command
     * @returns {BaseUpdate[]}
     */
    handleCommand(command) {
        try {
            // Use the command's own execute method
            return command.execute(this.managers)
        } catch (error) {
            console.error(`Error executing command ${command.type}:`, error)
            return [new BaseUpdate(command.playerId, 'ERROR', { 
                message: 'Command execution failed' 
            })]
        }
    }
}