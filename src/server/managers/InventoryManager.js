import { ErrorCodes } from '../../shared/ErrorCodes.js';

/**
 * Inventory Management System
 * Handles item interactions and inventory state
 */
export class InventoryManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        this.inventories = new Map(); // playerId -> inventory data
        
        console.log('InventoryManager initialized');
    }

    /**
     * Initialize player inventory
     * @param {string} playerId - Player ID
     * @param {Object} savedInventory - Saved inventory data
     */
    initializeInventory(playerId, savedInventory = null) {
        if (savedInventory) {
            this.inventories.set(playerId, {
                items: savedInventory.items || [],
                capacity: savedInventory.capacity || 50
            });
        } else {
            // New player - create default inventory
            this.inventories.set(playerId, {
                items: [],
                capacity: 50
            });
        }
    }

    /**
     * Get player inventory
     * @param {string} playerId - Player ID
     * @returns {Object|null} Inventory data
     */
    getInventory(playerId) {
        return this.inventories.get(playerId) || null;
    }

    /**
     * Add item to inventory
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to add
     * @returns {boolean} Success
     */
    addItem(playerId, itemId, quantity = 1) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return false;
        
        // Check if we can add the item
        if (!this.canAddItem(playerId, itemId, quantity)) {
            return false;
        }
        
        // Find existing item
        const existingItem = inventory.items.find(item => item.id === itemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            inventory.items.push({ id: itemId, quantity });
        }
        
        return true;
    }

    /**
     * Remove item from inventory
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to remove
     * @returns {boolean} Success
     */
    removeItem(playerId, itemId, quantity = 1) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return false;
        
        const itemIndex = inventory.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;
        
        const item = inventory.items[itemIndex];
        if (item.quantity < quantity) return false;
        
        if (item.quantity === quantity) {
            // Remove item completely
            inventory.items.splice(itemIndex, 1);
        } else {
            // Reduce quantity
            item.quantity -= quantity;
        }
        
        return true;
    }

    /**
     * Check if player has item
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Required quantity
     * @returns {boolean} Has item
     */
    hasItem(playerId, itemId, quantity = 1) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return false;
        
        const item = inventory.items.find(item => item.id === itemId);
        return item && item.quantity >= quantity;
    }

    /**
     * Get item count
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @returns {number} Item count
     */
    getItemCount(playerId, itemId) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return 0;
        
        const item = inventory.items.find(item => item.id === itemId);
        return item ? item.quantity : 0;
    }

    /**
     * Check if can add item (capacity check)
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to add
     * @returns {boolean} Can add
     */
    canAddItem(playerId, itemId, quantity = 1) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return false;
        
        const itemTemplate = this.templateManager.getItem(itemId);
        if (!itemTemplate) return false;
        
        // Check if item already exists (stackable)
        const existingItem = inventory.items.find(item => item.id === itemId);
        if (existingItem) {
            // Item exists, can always add more (assuming stackable)
            return true;
        }
        
        // New item - check if we have space
        const currentItems = inventory.items.length;
        return currentItems < inventory.capacity;
    }

    /**
     * Get current inventory size
     * @param {string} playerId - Player ID
     * @returns {number} Current size
     */
    getCurrentSize(playerId) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return 0;
        
        return inventory.items.length;
    }

    /**
     * Get inventory capacity  
     * @param {string} playerId - Player ID
     * @returns {number} Max capacity
     */
    getCapacity(playerId) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return 0;
        
        return inventory.capacity;
    }

    /**
     * Set inventory capacity
     * @param {string} playerId - Player ID
     * @param {number} newCapacity - New capacity
     */
    setCapacity(playerId, newCapacity) {
        const inventory = this.inventories.get(playerId);
        if (inventory) {
            inventory.capacity = newCapacity;
        }
    }

    /**
     * Clear inventory
     * @param {string} playerId - Player ID
     */
    clearInventory(playerId) {
        const inventory = this.inventories.get(playerId);
        if (inventory) {
            inventory.items = [];
        }
    }

    /**
     * Get inventory for saving
     * @param {string} playerId - Player ID
     * @returns {Object|null} Serializable inventory data
     */
    getInventoryForSave(playerId) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return null;
        
        return {
            items: inventory.items,
            capacity: inventory.capacity
        };
    }

    /**
     * Remove player inventory from memory
     * @param {string} playerId - Player ID
     */
    removePlayerInventory(playerId) {
        this.inventories.delete(playerId);
    }

    /**
     * Try to take item from room to player inventory
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to take
     * @param {Object} worldManager - World manager instance
     * @param {string} playerLocation - Player's current location
     * @returns {Object} Result with success, message, and updated inventory
     */
    tryTakeItem(playerId, itemId, quantity, worldManager, playerLocation) {
        const room = worldManager.getRoom(playerLocation);
        if (!room || !room.items || !room.items.find(item => item.id === itemId)) {
            return { success: false, errorCode: ErrorCodes.ITEM_NOT_FOUND };
        }

        if (!this.canAddItem(playerId, itemId, quantity)) {
            return { success: false, errorCode: ErrorCodes.INVENTORY_FULL };
        }

        // Remove from room and add to inventory
        worldManager.removeItemFromRoom(playerLocation, itemId, quantity);
        this.addItem(playerId, itemId, quantity);

        return {
            success: true,
            message: `You take ${quantity} ${itemId}.`,
            inventory: this.getInventory(playerId)
        };
    }

    /**
     * Try to drop item from player inventory to room
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to drop
     * @param {Object} worldManager - World manager instance
     * @param {string} playerLocation - Player's current location
     * @returns {Object} Result with success, message, and updated inventory
     */
    tryDropItem(playerId, itemId, quantity, worldManager, playerLocation) {
        if (!this.hasItem(playerId, itemId, quantity)) {
            return { success: false, message: `You don't have ${quantity} ${itemId} to drop.` };
        }

        // Remove from inventory and add to room
        const success = this.removeItem(playerId, itemId, quantity);
        if (success) {
            worldManager.addItemToRoom(playerLocation, itemId, quantity);
            return {
                success: true,
                message: `You drop ${quantity} ${itemId}.`,
                inventory: this.getInventory(playerId)
            };
        } else {
            return { success: false, errorCode: ErrorCodes.ITEM_NOT_FOUND };
        }
    }

    /**
     * Get inventory statistics
     * @param {string} playerId - Player ID
     * @returns {Object} Inventory stats
     */
    getInventoryStats(playerId) {
        const inventory = this.inventories.get(playerId);
        if (!inventory) return null;
        
        const totalItems = inventory.items.reduce((sum, item) => sum + item.quantity, 0);
        const uniqueItems = inventory.items.length;
        
        return {
            uniqueItems,
            totalItems,
            capacity: inventory.capacity,
            freeSlots: inventory.capacity - uniqueItems,
            utilizationPercent: Math.round((uniqueItems / inventory.capacity) * 100)
        };
    }
}