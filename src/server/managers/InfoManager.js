/**
 * Info Manager - handles player information displays and help systems
 * Provides clean interface for information retrieval
 */
import { ErrorCodes } from '../../shared/ErrorCodes.js';

export class InfoManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        console.log('InfoManager initialized');
    }

    /**
     * Get player statistics display
     */
    processGetStats(playerId, playerManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        return {
            success: true,
            action: 'stats',
            data: {
                name: player.name,
                level: player.level || 1,
                health: player.health || 100,
                maxHealth: player.maxHealth || 100,
                experience: player.experience || 0,
                gold: player.gold || 0,
                location: player.location || 'unknown'
            }
        };
    }

    /**
     * Get player health information
     */
    processGetHealth(playerId, playerManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        const healthPercent = Math.round((player.health / player.maxHealth) * 100);
        
        return {
            success: true,
            action: 'health',
            data: {
                health: player.health,
                maxHealth: player.maxHealth,
                healthPercent: healthPercent,
                status: this.getHealthStatus(healthPercent)
            }
        };
    }

    /**
     * Get equipment display
     */
    processGetEquipment(playerId, playerManager, templateManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        const equipment = player.equipment || {};
        const equipmentDisplay = {};
        
        // Standard equipment slots
        const slots = ['main_hand', 'off_hand', 'chest', 'legs', 'head', 'feet', 'hands'];
        
        for (const slot of slots) {
            if (equipment[slot]) {
                const template = templateManager.getItem(equipment[slot].id);
                equipmentDisplay[slot] = {
                    id: equipment[slot].id,
                    name: template ? template.name : equipment[slot].id,
                    equipped: true
                };
            } else {
                equipmentDisplay[slot] = { equipped: false };
            }
        }

        return {
            success: true,
            action: 'equipment',
            data: {
                equipment: equipmentDisplay
            }
        };
    }



    /**
     * Process look/examine command
     */
    processLook(playerId, target, playerManager, worldManager, templateManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // If no target, look at room
        if (!target) {
            return this.lookAtRoom(player, worldManager, templateManager);
        }

        // Look at specific target
        return this.lookAtTarget(player, target, playerManager, worldManager, templateManager);
    }

    /**
     * Look at current room
     */
    lookAtRoom(player, worldManager, templateManager) {
        const room = worldManager.getRoom(player.location);
        if (!room) {
            return { success: false, errorCode: ErrorCodes.ROOM_NOT_FOUND };
        }

        const roomData = {
            id: room.id,
            name: room.name,
            description: room.description,
            exits: room.exits || {},
            items: [],
            players: [],
            npcs: []
        };

        // Add items in room
        if (room.items && room.items.length > 0) {
            roomData.items = room.items.map(item => {
                const template = templateManager.getItem(item.id);
                return {
                    id: item.id,
                    name: template ? template.name : item.id,
                    quantity: item.quantity || 1
                };
            });
        }

        // Add other players in room (implement when needed)
        // Add NPCs in room (implement when needed)

        return {
            success: true,
            action: 'look_room',
            data: roomData
        };
    }

    /**
     * Look at specific target
     */
    lookAtTarget(player, target, playerManager, worldManager, templateManager) {
        // First check if it's an item in inventory
        if (player.inventory && player.inventory.items) {
            const inventoryItem = player.inventory.items.find(item => 
                item.id.toLowerCase().includes(target.toLowerCase())
            );
            
            if (inventoryItem) {
                const template = templateManager.getItem(inventoryItem.id);
                if (template) {
                    return {
                        success: true,
                        action: 'look_item',
                        data: {
                            id: inventoryItem.id,
                            name: template.name,
                            description: template.description,
                            location: 'inventory',
                            quantity: inventoryItem.quantity
                        }
                    };
                }
            }
        }

        // Check if it's an item in the room
        const room = worldManager.getRoom(player.location);
        if (room && room.items) {
            const roomItem = room.items.find(item => 
                item.id.toLowerCase().includes(target.toLowerCase())
            );
            
            if (roomItem) {
                const template = templateManager.getItem(roomItem.id);
                if (template) {
                    return {
                        success: true,
                        action: 'look_item',
                        data: {
                            id: roomItem.id,
                            name: template.name,
                            description: template.description,
                            location: 'room',
                            quantity: roomItem.quantity
                        }
                    };
                }
            }
        }

        // Target not found
        return {
            success: false,
            errorCode: ErrorCodes.ITEM_NOT_FOUND,
            target: target
        };
    }

    /**
     * Get health status description
     */
    getHealthStatus(healthPercent) {
        if (healthPercent >= 90) return 'excellent';
        if (healthPercent >= 70) return 'good';
        if (healthPercent >= 50) return 'fair';
        if (healthPercent >= 30) return 'poor';
        if (healthPercent >= 10) return 'critical';
        return 'near death';
    }


}