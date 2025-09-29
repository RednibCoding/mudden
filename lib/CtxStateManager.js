class CtxStateManager {
    constructor() {
        this.registeredStates = new Map()
    }

    /**
     * Register a temporary state with exception commands
     * @param {string} stateKey - The key used to store state on player object
     * @param {Array<string>} exceptionCommands - Commands that should NOT clear this state
     */
    registerState(stateKey, exceptionCommands = []) {
        this.registeredStates.set(stateKey, {
            exceptionCommands: new Set(exceptionCommands.map(cmd => cmd.toLowerCase()))
        })
    }

    /**
     * Set temporary state on a player
     * @param {Object} player - The player object
     * @param {string} stateKey - The state key
     * @param {*} value - The value to store
     */
    setState(player, stateKey, value) {
        if (!player.tempState) {
            player.tempState = {}
        }
        player.tempState[stateKey] = value
    }

    /**
     * Get temporary state from a player
     * @param {Object} player - The player object
     * @param {string} stateKey - The state key
     * @returns {*} The stored value or undefined
     */
    getState(player, stateKey) {
        return player.tempState?.[stateKey]
    }

    /**
     * Clear specific state from a player
     * @param {Object} player - The player object
     * @param {string} stateKey - The state key to clear
     */
    clearState(player, stateKey) {
        if (player.tempState && stateKey in player.tempState) {
            delete player.tempState[stateKey]
            
            // Clean up empty tempState object
            if (Object.keys(player.tempState).length === 0) {
                delete player.tempState
            }
        }
    }

    /**
     * Reset all temporary states based on the executed command
     * This should be called by CommandManager before executing each command
     * @param {Object} player - The player object
     * @param {string} executedCommand - The command that was executed
     */
    resetStatesForCommand(player, executedCommand) {
        if (!player.tempState) {
            return
        }

        const commandLower = executedCommand.toLowerCase()
        const statesToClear = []

        // Check each registered state
        for (const [stateKey, config] of this.registeredStates) {
            // If the executed command is NOT in the exception list, mark for clearing
            if (!config.exceptionCommands.has(commandLower)) {
                statesToClear.push(stateKey)
            }
        }

        // Clear the states
        for (const stateKey of statesToClear) {
            this.clearState(player, stateKey)
        }
    }

    /**
     * Clear all temporary states from a player (force clear)
     * @param {Object} player - The player object
     */
    clearAllStates(player) {
        if (player.tempState) {
            delete player.tempState
        }
    }

    /**
     * Get debug information about registered states
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        const states = {}
        for (const [stateKey, config] of this.registeredStates) {
            states[stateKey] = {
                exceptionCommands: Array.from(config.exceptionCommands)
            }
        }
        return {
            registeredStates: states,
            totalRegistered: this.registeredStates.size
        }
    }
}

export default CtxStateManager