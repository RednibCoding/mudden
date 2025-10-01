/**
 * World Manager - handles rooms, NPCs, and world state
 * Provides clean interface for world operations
 */
import fs from 'fs';
import path from 'path';

export class WorldManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        this.rooms = new Map(); // roomId -> room data with current state
        this.roomTemplates = new Map(); // roomId -> template data
        
        this.loadWorldData();
        console.log('WorldManager initialized');
    }

    /**
     * Load world data from templates
     */
    loadWorldData() {
        try {
            // Load room templates from areas
            const areasDir = 'templates/areas';
            if (fs.existsSync(areasDir)) {
                const areaFolders = fs.readdirSync(areasDir).filter(item => {
                    return fs.statSync(path.join(areasDir, item)).isDirectory();
                });
                
                for (const areaFolder of areaFolders) {
                    this.loadAreaRooms(path.join(areasDir, areaFolder));
                }
            }
            
            console.log(`Loaded ${this.rooms.size} rooms from world templates`);
        } catch (error) {
            console.error('Error loading world data:', error);
        }
    }

    /**
     * Load rooms from an area folder
     * @param {string} areaPath - Path to area folder
     */
    loadAreaRooms(areaPath) {
        try {
            const roomFiles = fs.readdirSync(areaPath).filter(file => file.endsWith('.json'));
            const areaName = path.basename(areaPath); // Get area folder name
            
            for (const roomFile of roomFiles) {
                const roomFileName = path.basename(roomFile, '.json');
                const roomId = `${areaName}.${roomFileName}`; // Create full room ID
                const roomPath = path.join(areaPath, roomFile);
                const roomTemplate = JSON.parse(fs.readFileSync(roomPath, 'utf8'));
                
                // Store template with full ID
                this.roomTemplates.set(roomId, roomTemplate);
                
                // Create active room state from template
                const roomState = {
                    ...roomTemplate,
                    id: roomId,
                    items: [...(roomTemplate.items || [])], // Copy items array
                    npcs: [...(roomTemplate.npcs || [])], // Copy NPCs array
                    players: [] // Active players in room
                };
                
                this.rooms.set(roomId, roomState);
            }
        } catch (error) {
            console.error(`Error loading area ${areaPath}:`, error);
        }
    }

    /**
     * Get room data
     * @param {string} roomId - Room ID
     * @returns {Object|null} Room data
     */
    getRoom(roomId) {
        return this.rooms.get(roomId) || null;
    }

    /**
     * Get room template (original data)
     * @param {string} roomId - Room ID
     * @returns {Object|null} Room template
     */
    getRoomTemplate(roomId) {
        return this.roomTemplates.get(roomId) || null;
    }

    /**
     * Add item to room
     * @param {string} roomId - Room ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Item quantity
     */
    addItemToRoom(roomId, itemId, quantity = 1) {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        
        if (!room.items) {
            room.items = [];
        }
        
        // Find existing item
        const existingItem = room.items.find(item => item.id === itemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            room.items.push({ id: itemId, quantity });
        }
        
        return true;
    }

    /**
     * Remove item from room
     * @param {string} roomId - Room ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to remove
     * @returns {boolean} Success
     */
    removeItemFromRoom(roomId, itemId, quantity = 1) {
        const room = this.rooms.get(roomId);
        if (!room || !room.items) return false;
        
        const itemIndex = room.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;
        
        const item = room.items[itemIndex];
        if (item.quantity <= quantity) {
            // Remove item completely
            room.items.splice(itemIndex, 1);
        } else {
            // Reduce quantity
            item.quantity -= quantity;
        }
        
        return true;
    }

    /**
     * Check if room has item
     * @param {string} roomId - Room ID
     * @param {string} itemId - Item ID
     * @returns {boolean} Has item
     */
    roomHasItem(roomId, itemId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.items) return false;
        
        return room.items.some(item => item.id === itemId && item.quantity > 0);
    }

    /**
     * Get all rooms
     * @returns {Map} All rooms
     */
    getAllRooms() {
        return this.rooms;
    }

    /**
     * Reset room to template state
     * @param {string} roomId - Room ID
     */
    resetRoom(roomId) {
        const template = this.roomTemplates.get(roomId);
        if (!template) return false;
        
        const roomState = {
            ...template,
            id: roomId,
            items: [...(template.items || [])],
            npcs: [...(template.npcs || [])],
            players: []
        };
        
        this.rooms.set(roomId, roomState);
        return true;
    }

    /**
     * Add player to room tracking
     * @param {string} roomId - Room ID
     * @param {string} playerId - Player ID
     */
    addPlayerToRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (room && !room.players.includes(playerId)) {
            room.players.push(playerId);
        }
    }

    /**
     * Remove player from room tracking
     * @param {string} roomId - Room ID
     * @param {string} playerId - Player ID
     */
    removePlayerFromRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (room) {
            const index = room.players.indexOf(playerId);
            if (index !== -1) {
                room.players.splice(index, 1);
            }
        }
    }

    /**
     * Get room statistics
     * @returns {Object} Room statistics
     */
    getStats() {
        return {
            totalRooms: this.rooms.size,
            roomsWithItems: Array.from(this.rooms.values()).filter(room => room.items && room.items.length > 0).length,
            roomsWithNPCs: Array.from(this.rooms.values()).filter(room => room.npcs && room.npcs.length > 0).length,
            roomsWithPlayers: Array.from(this.rooms.values()).filter(room => room.players && room.players.length > 0).length
        };
    }
}