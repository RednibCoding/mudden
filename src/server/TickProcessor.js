/**
 * Tick Processor - processes all commands atomically during each tick
 * Handles command routing, validation, and update generation
 */
import { BaseUpdate } from '../shared/updates/BaseUpdate.js';
import { CommandTypes } from '../shared/CommandTypes.js';
export class TickProcessor {
    constructor(managers) {
        this.playerManager = managers.player;
        this.worldManager = managers.world;
        this.inventoryManager = managers.inventory;
        this.equipmentManager = managers.equipment;
        this.templateManager = managers.template;
        
        console.log('TickProcessor initialized');
    }

    /**
     * Process all commands for this tick
     * @param {BaseCommand[]} commands - Commands to process
     * @returns {BaseUpdate[]} - Updates to send to clients
     */
    processCommands(commands) {
        const updates = [];
        
        for (const command of commands) {
            try {
                const commandUpdates = this.handleCommand(command);
                if (commandUpdates) {
                    updates.push(...commandUpdates);
                }
            } catch (error) {
                console.error('Error processing command:', error);
                // Send error update to client
                const ErrorUpdate = BaseUpdate; // Import proper ErrorUpdate when implemented
                updates.push(new ErrorUpdate(command.playerId, 'COMMAND_FAILED', error.message));
            }
        }
        
        return updates;
    }

    /**
     * Route command to appropriate handler
     * @param {BaseCommand} command
     * @returns {BaseUpdate[]}
     */
    handleCommand(command) {
        switch (command.type) {
            case CommandTypes.MOVE:
                return this.handleMoveCommand(command);
            case CommandTypes.LOOK:
                return this.handleLookCommand(command);
            case CommandTypes.TAKE_ITEM:
                return this.handleTakeItemCommand(command);
            case CommandTypes.EQUIP_ITEM:
                return this.handleEquipItemCommand(command);
            case CommandTypes.SAY:
                return this.handleSayCommand(command);
            case CommandTypes.INVENTORY:
                return this.handleInventoryCommand(command);
            default:
                console.warn(`Unknown command type: ${command.type}`);
                return [];
        }
    }

    /**
     * Handle movement command
     * @param {MoveCommand} command
     * @returns {BaseUpdate[]}
     */
    handleMoveCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }

        const currentRoom = this.worldManager.getRoom(player.location);
        if (!currentRoom || !currentRoom.exits[command.direction]) {
            updates.push(new BaseUpdate(command.playerId, 'ROOM_UPDATE', { 
                message: `You cannot go ${command.direction}.` 
            }));
            return updates;
        }

        const newLocation = currentRoom.exits[command.direction];
        const newRoom = this.worldManager.getRoom(newLocation);
        
        if (!newRoom) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { 
                message: 'Room not found' 
            }));
            return updates;
        }

        // Update player location
        this.playerManager.movePlayer(command.playerId, newLocation);
        
        // Send room update to player
        updates.push(new BaseUpdate(command.playerId, 'ROOM_UPDATE', {
            location: newLocation,
            name: newRoom.name,
            description: newRoom.description,
            exits: Object.keys(newRoom.exits),
            items: newRoom.items || [],
            npcs: newRoom.npcs || [],
            players: this.playerManager.getPlayersInRoom(newLocation)
        }));
        
        return updates;
    }

    /**
     * Handle take item command
     * @param {TakeItemCommand} command
     * @returns {BaseUpdate[]}
     */
    handleTakeItemCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }

        const room = this.worldManager.getRoom(player.location);
        if (!room || !room.items || !room.items.find(item => item.id === command.itemId)) {
            updates.push(new BaseUpdate(command.playerId, 'INVENTORY_UPDATE', { 
                message: 'Item not found in room' 
            }));
            return updates;
        }

        // Check if player can carry the item
        if (!this.inventoryManager.canAddItem(command.playerId, command.itemId, command.quantity)) {
            updates.push(new BaseUpdate(command.playerId, 'INVENTORY_UPDATE', { 
                message: 'Not enough inventory space' 
            }));
            return updates;
        }

        // Remove item from room
        this.worldManager.removeItemFromRoom(player.location, command.itemId, command.quantity);
        
        // Add item to player inventory
        this.inventoryManager.addItem(command.playerId, command.itemId, command.quantity);
        
        // Send updates
        const itemTemplate = this.templateManager.getItem(command.itemId);
        const inventory = this.inventoryManager.getInventory(command.playerId);
        updates.push(new BaseUpdate(command.playerId, 'INVENTORY_UPDATE', {
            message: `You take ${command.quantity} ${itemTemplate?.name || command.itemId}.`,
            inventory: inventory ? inventory.items : []
        }));
        
        return updates;
    }

    /**
     * Handle equip item command
     * @param {EquipItemCommand} command
     * @returns {BaseUpdate[]}
     */
    handleEquipItemCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }

        // Check if player has the item
        if (!this.inventoryManager.hasItem(command.playerId, command.itemId)) {
            updates.push(new BaseUpdate(command.playerId, 'EQUIPMENT_UPDATE', { 
                message: 'You do not have that item' 
            }));
            return updates;
        }

        const itemTemplate = this.templateManager.getItem(command.itemId);
        if (!itemTemplate?.equipment) {
            updates.push(new BaseUpdate(command.playerId, 'EQUIPMENT_UPDATE', { 
                message: 'That item cannot be equipped' 
            }));
            return updates;
        }

        // Equip the item
        const result = this.equipmentManager.equipItem(command.playerId, command.itemId, command.slot);
        
        if (result.success) {
            // Remove from inventory
            this.inventoryManager.removeItem(command.playerId, command.itemId, 1);
            
            const inventory = this.inventoryManager.getInventory(command.playerId);
            updates.push(new BaseUpdate(command.playerId, 'EQUIPMENT_UPDATE', {
                message: `You equip ${itemTemplate.name}.`,
                equipment: this.equipmentManager.getEquipment(command.playerId),
                inventory: inventory ? inventory.items : []
            }));
            
            // If something was unequipped, add it back to inventory
            if (result.unequippedItem) {
                this.inventoryManager.addItem(command.playerId, result.unequippedItem, 1);
                const unequippedTemplate = this.templateManager.getItem(result.unequippedItem);
                const updatedInventory = this.inventoryManager.getInventory(command.playerId);
                updates.push(new BaseUpdate(command.playerId, 'INVENTORY_UPDATE', {
                    message: `You unequip ${unequippedTemplate?.name || result.unequippedItem}.`,
                    inventory: updatedInventory ? updatedInventory.items : []
                }));
            }
        } else {
            updates.push(new BaseUpdate(command.playerId, 'EQUIPMENT_UPDATE', { 
                message: result.error 
            }));
        }
        
        return updates;
    }

    /**
     * Handle look command
     * @param {BaseCommand} command
     * @returns {BaseUpdate[]}
     */
    handleLookCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }

        const room = this.worldManager.getRoom(player.location);
        if (!room) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Room not found' }));
            return updates;
        }

        updates.push(new BaseUpdate(command.playerId, 'ROOM_UPDATE', {
            location: player.location,
            name: room.name,
            description: room.description,
            exits: Object.keys(room.exits),
            items: room.items || [],
            npcs: room.npcs || [],
            players: this.playerManager.getPlayersInRoom(player.location)
        }));
        
        return updates;
    }

    /**
     * Handle say command
     * @param {BaseCommand} command
     * @returns {BaseUpdate[]}
     */
    handleSayCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }
        
        // Send message to all players in the same room
        const playersInRoom = this.playerManager.getPlayersInRoom(player.location);
        
        for (const otherPlayerId of playersInRoom) {
            if (otherPlayerId === command.playerId) {
                // Send confirmation to speaker
                updates.push(new BaseUpdate(otherPlayerId, 'CHAT_UPDATE', {
                    message: `You say: "${command.message}"`
                }));
            } else {
                // Send message to others
                updates.push(new BaseUpdate(otherPlayerId, 'CHAT_UPDATE', {
                    message: `${player.name} says: "${command.message}"`
                }));
            }
        }
        
        return updates;
    }

    /**
     * Handle inventory command
     * @param {BaseCommand} command
     * @returns {BaseUpdate[]}
     */
    handleInventoryCommand(command) {
        const updates = [];
        const player = this.playerManager.getPlayer(command.playerId);
        
        if (!player) {
            updates.push(new BaseUpdate(command.playerId, 'ERROR', { message: 'Player not found' }));
            return updates;
        }

        const inventory = this.inventoryManager.getInventory(command.playerId);
        const stats = this.inventoryManager.getInventoryStats(command.playerId);
        
        let message = '\n=== INVENTORY ===\n';
        if (!inventory || inventory.items.length === 0) {
            message += 'Your inventory is empty.';
        } else {
            inventory.items.forEach(item => {
                const template = this.templateManager.getItem(item.id);
                const name = template?.name || item.id;
                message += `${name} (${item.quantity})\n`;
            });
            
            if (stats) {
                message += `\nCapacity: ${stats.uniqueItems}/${stats.capacity} slots used`;
            }
        }
        
        updates.push(new BaseUpdate(command.playerId, 'INVENTORY_UPDATE', {
            message: message,
            inventory: inventory ? inventory.items : []
        }));
        
        return updates;
    }
}