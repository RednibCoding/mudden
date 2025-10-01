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

    /**
     * High-level workflow - process taking an item from room
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID to take
     * @param {number} quantity - Quantity to take
     * @param {Object} worldManager - World manager instance
     * @param {string} location - Player's current location
     * @returns {Object} Complete result with inventory data
     */
    processTakeItem(playerId, itemId, quantity, worldManager, location) {
        // Check if item exists in room
        const roomItems = worldManager.getRoomItems(location);
        const roomItem = roomItems.find(item => item.id === itemId);
        
        if (!roomItem || roomItem.quantity < quantity) {
            return {
                success: false,
                errorCode: ErrorCodes.ITEM_NOT_FOUND,
                itemId: itemId,
                quantity: quantity
            };
        }

        // Check if player has inventory space
        if (!this.canAddItem(playerId, itemId, quantity)) {
            return {
                success: false,
                errorCode: ErrorCodes.INVENTORY_FULL,
                itemId: itemId,
                quantity: quantity
            };
        }

        // Remove item from room
        worldManager.removeItemFromRoom(location, itemId, quantity);

        // Add item to player inventory
        this.addItem(playerId, itemId, quantity);

        // Get updated inventory
        const inventory = this.getInventory(playerId);

        return {
            success: true,
            action: 'take',
            itemId: itemId,
            quantity: quantity,
            inventory: inventory
        };
    }

    /**
     * High-level workflow - process dropping an item to room
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID to drop
     * @param {number} quantity - Quantity to drop
     * @param {Object} worldManager - World manager instance
     * @param {string} location - Player's current location
     * @returns {Object} Complete result with inventory data
     */
    processDropItem(playerId, itemId, quantity, worldManager, location) {
        // Check if player has the item
        if (!this.hasItem(playerId, itemId, quantity)) {
            return {
                success: false,
                errorCode: ErrorCodes.ITEM_NOT_IN_INVENTORY,
                itemId: itemId,
                quantity: quantity
            };
        }

        // Remove item from player inventory
        this.removeItem(playerId, itemId, quantity);

        // Add item to room
        worldManager.addItemToRoom(location, itemId, quantity);

        // Get updated inventory
        const inventory = this.getInventory(playerId);

        return {
            success: true,
            action: 'drop',
            itemId: itemId,
            quantity: quantity,
            inventory: inventory
        };
    }

    /**
     * High-level workflow - process using a consumable item
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID to use
     * @param {Object} playerManager - Player manager instance
     * @returns {Object} Complete result with effects applied
     */
    processUseItem(playerId, itemId, playerManager) {
        // Check if player has the item
        if (!this.hasItem(playerId, itemId, 1)) {
            return {
                success: false,
                errorCode: ErrorCodes.ITEM_NOT_IN_INVENTORY,
                itemId: itemId
            };
        }

        // Get item template
        const itemTemplate = this.templateManager.getItem(itemId);
        if (!itemTemplate) {
            return {
                success: false,
                errorCode: ErrorCodes.ITEM_NOT_FOUND,
                itemId: itemId
            };
        }

        // Check if item is usable
        if (!itemTemplate.consumable) {
            return {
                success: false,
                errorCode: ErrorCodes.ITEM_NOT_USABLE,
                itemId: itemId
            };
        }

        // Apply item effects
        const player = playerManager.getPlayer(playerId);
        const effects = this.applyItemEffects(player, itemTemplate, playerManager);

        // Remove item from inventory (consumable)
        this.removeItem(playerId, itemId, 1);

        // Get updated inventory
        const inventory = this.getInventory(playerId);

        return {
            success: true,
            action: 'use',
            itemId: itemId,
            inventory: inventory,
            effects: effects,
            itemName: itemTemplate.name || itemId
        };
    }

    /**
     * Apply effects from using an item
     * @param {Object} player - Player object
     * @param {Object} itemTemplate - Item template
     * @param {Object} playerManager - Player manager instance
     * @returns {Array} Array of applied effects
     * @private
     */
    applyItemEffects(player, itemTemplate, playerManager) {
        const effects = [];
        
        if (itemTemplate.consumable) {
            // Apply health restoration
            if (itemTemplate.consumable.health) {
                const healthGain = itemTemplate.consumable.health;
                const newHealth = Math.min(player.maxHealth, player.health + healthGain);
                const actualGain = newHealth - player.health;
                
                player.health = newHealth;
                playerManager.savePlayer(player.id, player);
                
                effects.push({
                    type: 'health_restore',
                    amount: actualGain,
                    message: `You restore ${actualGain} health points.`
                });
            }

            // Apply mana restoration
            if (itemTemplate.consumable.mana) {
                const manaGain = itemTemplate.consumable.mana;
                const newMana = Math.min(player.maxMana || 100, (player.mana || 0) + manaGain);
                const actualGain = newMana - (player.mana || 0);
                
                player.mana = newMana;
                playerManager.savePlayer(player.id, player);
                
                effects.push({
                    type: 'mana_restore',
                    amount: actualGain,
                    message: `You restore ${actualGain} mana points.`
                });
            }

            // Add other consumable effects as needed
        }

        return effects;
    }
}