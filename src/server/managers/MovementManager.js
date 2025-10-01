import { ErrorCodes } from '../../shared/ErrorCodes.js'

/**
 * MovementManager - handles all player movement and room inspection logic
 */
export class MovementManager {
    constructor() {
        // MovementManager is stateless - all data comes from other managers
    }

    /**
     * Process player movement in a direction
     * @param {string} playerId - Player ID
     * @param {string} direction - Direction to move (north, south, east, west, up, down)
     * @param {Object} playerManager - PlayerManager instance
     * @param {Object} worldManager - WorldManager instance
     * @param {Object} templateManager - TemplateManager instance
     * @returns {Object} Result with success flag, error code, or room data
     */
    processMovePlayer(playerId, direction, playerManager, worldManager, templateManager) {
        // Validate player exists
        const player = playerManager.getPlayer(playerId)
        if (!player) {
            return { 
                success: false, 
                errorCode: ErrorCodes.PLAYER_NOT_FOUND 
            }
        }

        // Get current room
        const currentRoom = worldManager.getRoom(player.location)
        if (!currentRoom) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ROOM_NOT_FOUND 
            }
        }

        // Check if exit exists
        if (!currentRoom.exits || !currentRoom.exits[direction]) {
            return { 
                success: false, 
                errorCode: ErrorCodes.NO_EXIT,
                direction: direction
            }
        }

        // Get destination room
        const newLocation = currentRoom.exits[direction]
        const newRoom = worldManager.getRoom(newLocation)
        if (!newRoom) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ROOM_NOT_FOUND 
            }
        }

        // Move the player
        playerManager.movePlayer(playerId, newLocation)

        // Get players in new room
        const playersInRoom = playerManager.getPlayersInRoom(newLocation)

        // Create item names mapping
        const itemNames = {}
        if (newRoom.items) {
            newRoom.items.forEach(item => {
                const template = templateManager.getItem(item.id)
                itemNames[item.id] = template?.name || item.id
            })
        }

        return {
            success: true,
            location: newLocation,
            room: newRoom,
            playersInRoom: playersInRoom,
            itemNames: itemNames
        }
    }

    /**
     * Process room inspection (look command)
     * @param {string} playerId - Player ID
     * @param {string|null} target - Target to look at (null for room)
     * @param {string} targetType - Type of target ('room', 'item', 'player', 'npc')
     * @param {Object} playerManager - PlayerManager instance
     * @param {Object} worldManager - WorldManager instance
     * @param {Object} templateManager - TemplateManager instance
     * @returns {Object} Result with success flag, error code, or room data
     */
    processLookCommand(playerId, target, targetType, playerManager, worldManager, templateManager) {
        // Validate player exists
        const player = playerManager.getPlayer(playerId)
        if (!player) {
            return { 
                success: false, 
                errorCode: ErrorCodes.PLAYER_NOT_FOUND 
            }
        }

        // For now, we only handle room looking - other target types can be added later
        if (targetType !== 'room') {
            return { 
                success: false, 
                errorCode: ErrorCodes.INVALID_COMMAND 
            }
        }

        // Get current room
        const currentRoom = worldManager.getRoom(player.location)
        if (!currentRoom) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ROOM_NOT_FOUND 
            }
        }

        // Get players in room
        const playersInRoom = playerManager.getPlayersInRoom(player.location)

        // Create item names mapping
        const itemNames = {}
        if (currentRoom.items) {
            currentRoom.items.forEach(item => {
                const template = templateManager.getItem(item.id)
                itemNames[item.id] = template?.name || item.id
            })
        }

        return {
            success: true,
            location: player.location,
            room: currentRoom,
            playersInRoom: playersInRoom,
            itemNames: itemNames
        }
    }

    /**
     * Process target-specific look commands (items, players, NPCs)
     * @param {string} playerId - Player ID
     * @param {string} target - Target to examine
     * @param {string} targetType - Type of target ('item', 'player', 'npc')
     * @param {Object} playerManager - PlayerManager instance
     * @param {Object} worldManager - WorldManager instance
     * @param {Object} templateManager - TemplateManager instance
     * @returns {Object} Result with success flag, error code, or target data
     */
    processLookAtTarget(playerId, target, targetType, playerManager, worldManager, templateManager) {
        // Validate player exists
        const player = playerManager.getPlayer(playerId)
        if (!player) {
            return { 
                success: false, 
                errorCode: ErrorCodes.PLAYER_NOT_FOUND 
            }
        }

        // Get current room
        const currentRoom = worldManager.getRoom(player.location)
        if (!currentRoom) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ROOM_NOT_FOUND 
            }
        }

        switch (targetType) {
            case 'item':
                return this._lookAtItem(target, currentRoom, player, templateManager)
            case 'player':
                return this._lookAtPlayer(target, playerManager, player.location)
            case 'npc':
                return this._lookAtNpc(target, currentRoom, templateManager)
            default:
                return { 
                    success: false, 
                    errorCode: ErrorCodes.INVALID_COMMAND 
                }
        }
    }

    /**
     * Look at an item (in room or inventory)
     * @private
     */
    _lookAtItem(target, currentRoom, player, templateManager) {
        // Check room items first
        if (currentRoom.items) {
            const roomItem = currentRoom.items.find(item => 
                item.id.toLowerCase().includes(target.toLowerCase()) ||
                templateManager.getItem(item.id)?.name?.toLowerCase().includes(target.toLowerCase())
            )
            if (roomItem) {
                const template = templateManager.getItem(roomItem.id)
                return {
                    success: true,
                    targetType: 'item',
                    target: roomItem,
                    template: template,
                    location: 'room'
                }
            }
        }

        // Check player inventory
        if (player.inventory?.items) {
            const inventoryItem = player.inventory.items.find(item => 
                item.id.toLowerCase().includes(target.toLowerCase()) ||
                templateManager.getItem(item.id)?.name?.toLowerCase().includes(target.toLowerCase())
            )
            if (inventoryItem) {
                const template = templateManager.getItem(inventoryItem.id)
                return {
                    success: true,
                    targetType: 'item',
                    target: inventoryItem,
                    template: template,
                    location: 'inventory'
                }
            }
        }

        return { 
            success: false, 
            errorCode: ErrorCodes.ITEM_NOT_FOUND,
            target: target
        }
    }

    /**
     * Look at another player
     * @private
     */
    _lookAtPlayer(target, playerManager, currentLocation) {
        const playersInRoom = playerManager.getPlayersInRoom(currentLocation)
        const targetPlayer = playersInRoom.find(p => 
            p.name.toLowerCase().includes(target.toLowerCase())
        )

        if (!targetPlayer) {
            return { 
                success: false, 
                errorCode: ErrorCodes.PLAYER_NOT_FOUND,
                target: target
            }
        }

        return {
            success: true,
            targetType: 'player',
            target: targetPlayer
        }
    }

    /**
     * Look at an NPC
     * @private
     */
    _lookAtNpc(target, currentRoom, templateManager) {
        if (!currentRoom.npcs || currentRoom.npcs.length === 0) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ITEM_NOT_FOUND, // Using generic "not found" error
                target: target
            }
        }

        const npc = currentRoom.npcs.find(npcId => {
            const template = templateManager.getNpc(npcId)
            return npcId.toLowerCase().includes(target.toLowerCase()) ||
                   template?.name?.toLowerCase().includes(target.toLowerCase())
        })

        if (!npc) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ITEM_NOT_FOUND,
                target: target
            }
        }

        const template = templateManager.getNpc(npc)
        return {
            success: true,
            targetType: 'npc',
            target: npc,
            template: template
        }
    }
}