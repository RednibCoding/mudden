import { ErrorCodes } from '../../shared/ErrorCodes.js';

/**
 * Equipment Management System
 * Handles equipment operations and stat calculations
 * Provides high-level equipment workflow methods
 */
export class EquipmentManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        this.equipment = new Map(); // playerId -> equipment data
        
        // Equipment slots
        this.slots = [
            'main_hand',
            'off_hand', 
            'head',
            'chest',
            'legs',
            'feet',
            'hands'
        ];
        
        console.log('EquipmentManager initialized');
    }

    /**
     * Initialize player equipment
     * @param {string} playerId - Player ID
     * @param {Object} savedEquipment - Saved equipment data
     */
    initializeEquipment(playerId, savedEquipment = null) {
        const equipment = {};
        
        // Initialize all slots
        for (const slot of this.slots) {
            equipment[slot] = null;
        }
        
        // Load saved equipment if provided
        if (savedEquipment) {
            for (const slot of this.slots) {
                if (savedEquipment[slot]) {
                    equipment[slot] = savedEquipment[slot];
                }
            }
        }
        
        this.equipment.set(playerId, equipment);
    }

    /**
     * Get player equipment
     * @param {string} playerId - Player ID
     * @returns {Object|null} Equipment data
     */
    getEquipment(playerId) {
        return this.equipment.get(playerId) || null;
    }

    /**
     * Equip item to slot
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @param {string} slot - Equipment slot
     * @returns {Object} Result with success status
     */
    equipItem(playerId, itemId, slot = null) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) {
            return { success: false, error: 'Player equipment not found' };
        }
        
        const itemTemplate = this.templateManager.getItem(itemId);
        if (!itemTemplate || !itemTemplate.equipment) {
            return { success: false, errorCode: ErrorCodes.ITEM_NOT_EQUIPPABLE };
        }
        
        // Determine slot if not specified
        if (!slot) {
            slot = itemTemplate.equipment.slot;
        }
        
        // Validate slot
        if (!this.slots.includes(slot)) {
            return { success: false, errorCode: ErrorCodes.INVALID_SLOT };
        }
        
        // Check if item can be equipped to this slot
        if (itemTemplate.equipment.slot !== slot) {
            return { success: false, errorCode: ErrorCodes.SLOT_RESTRICTION, context: { itemName: itemTemplate.name, slot } };
        }
        
        // Check what's currently equipped
        const currentlyEquipped = equipment[slot];
        
        // Equip the new item
        equipment[slot] = {
            id: itemId,
            equippedAt: Date.now()
        };
        
        const result = { success: true };
        
        // Return previously equipped item if any
        if (currentlyEquipped) {
            result.unequippedItem = currentlyEquipped.id;
        }
        
        return result;
    }

    /**
     * Unequip item from slot
     * @param {string} playerId - Player ID
     * @param {string} slot - Equipment slot
     * @returns {Object} Result with unequipped item
     */
    unequipItem(playerId, slot) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }
        
        if (!this.slots.includes(slot)) {
            return { success: false, errorCode: ErrorCodes.INVALID_SLOT };
        }
        
        const currentItem = equipment[slot];
        if (!currentItem) {
            return { success: false, errorCode: ErrorCodes.NO_ITEM_EQUIPPED };
        }
        
        // Unequip
        equipment[slot] = null;
        
        return {
            success: true,
            unequippedItem: currentItem.id
        };
    }

    /**
     * Get equipped item in slot
     * @param {string} playerId - Player ID
     * @param {string} slot - Equipment slot
     * @returns {Object|null} Equipped item
     */
    getEquippedItem(playerId, slot) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return null;
        
        return equipment[slot];
    }

    /**
     * Check if item is equipped
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID
     * @returns {string|null} Slot where item is equipped, or null
     */
    isItemEquipped(playerId, itemId) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return null;
        
        for (const slot of this.slots) {
            const equipped = equipment[slot];
            if (equipped && equipped.id === itemId) {
                return slot;
            }
        }
        
        return null;
    }

    /**
     * Calculate total equipment stats
     * @param {string} playerId - Player ID
     * @returns {Object} Total stats from equipment
     */
    calculateStats(playerId) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return {};
        
        const totalStats = {
            attack: 0,
            defense: 0,
            health: 0,
            speed: 0
        };
        
        for (const slot of this.slots) {
            const equipped = equipment[slot];
            if (equipped) {
                const itemTemplate = this.templateManager.getItem(equipped.id);
                if (itemTemplate && itemTemplate.equipment && itemTemplate.equipment.stats) {
                    const stats = itemTemplate.equipment.stats;
                    
                    totalStats.attack += stats.attack || 0;
                    totalStats.defense += stats.defense || 0;
                    totalStats.health += stats.health || 0;
                    totalStats.speed += stats.speed || 0;
                }
            }
        }
        
        return totalStats;
    }

    /**
     * Get all equipped items
     * @param {string} playerId - Player ID
     * @returns {Array} Array of equipped items with slot info
     */
    getAllEquippedItems(playerId) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return [];
        
        const equippedItems = [];
        
        for (const slot of this.slots) {
            const equipped = equipment[slot];
            if (equipped) {
                const itemTemplate = this.templateManager.getItem(equipped.id);
                equippedItems.push({
                    slot,
                    itemId: equipped.id,
                    itemName: itemTemplate?.name || equipped.id,
                    equippedAt: equipped.equippedAt
                });
            }
        }
        
        return equippedItems;
    }

    /**
     * Get equipment data for saving
     * @param {string} playerId - Player ID
     * @returns {Object|null} Serializable equipment data
     */
    getEquipmentForSave(playerId) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return null;
        
        const saveData = {};
        
        for (const slot of this.slots) {
            if (equipment[slot]) {
                saveData[slot] = equipment[slot];
            }
        }
        
        return saveData;
    }

    /**
     * Remove player equipment from memory
     * @param {string} playerId - Player ID
     */
    removePlayerEquipment(playerId) {
        this.equipment.delete(playerId);
    }

    /**
     * Get equipment statistics
     * @param {string} playerId - Player ID
     * @returns {Object} Equipment stats
     */
    getEquipmentStats(playerId) {
        const equipment = this.equipment.get(playerId);
        if (!equipment) return null;
        
        let equippedCount = 0;
        const slotStatus = {};
        
        for (const slot of this.slots) {
            const isEquipped = equipment[slot] !== null;
            if (isEquipped) equippedCount++;
            slotStatus[slot] = isEquipped;
        }
        
        return {
            totalSlots: this.slots.length,
            equippedSlots: equippedCount,
            emptySlots: this.slots.length - equippedCount,
            slotStatus,
            stats: this.calculateStats(playerId)
        };
    }

    /**
     * High-level equipment workflow - handles complete equip process
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID to equip
     * @param {Object} inventoryManager - Inventory manager instance
     * @returns {Object} Complete result with all necessary data
     */
    processEquipItem(playerId, itemId, inventoryManager) {
        // Check if player has the item in inventory
        if (!inventoryManager.hasItem(playerId, itemId, 1)) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ITEM_NOT_FOUND,
                itemId: itemId
            };
        }

        // Get item template for validation
        const itemTemplate = this.templateManager.getItem(itemId);
        if (!itemTemplate) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ITEM_NOT_FOUND,
                itemId: itemId
            };
        }

        // Check if item is equippable
        if (!itemTemplate.equipment) {
            return { 
                success: false, 
                errorCode: ErrorCodes.ITEM_NOT_EQUIPPABLE,
                itemId: itemId
            };
        }

        const slot = itemTemplate.equipment.slot;
        if (!slot) {
            return { 
                success: false, 
                errorCode: ErrorCodes.INVALID_SLOT,
                itemId: itemId
            };
        }

        // Try to equip the item
        const equipResult = this.equipItem(playerId, itemId, slot);
        if (!equipResult.success) {
            return {
                success: false,
                errorCode: equipResult.errorCode,
                itemId: itemId,
                context: equipResult.context
            };
        }

        // Remove item from inventory
        inventoryManager.removeItem(playerId, itemId, 1);

        // If there was a previously equipped item, add it back to inventory
        if (equipResult.unequippedItem) {
            inventoryManager.addItem(playerId, equipResult.unequippedItem, 1);
        }

        // Get final equipment state
        const equipment = this.getPlayerEquipment(playerId);

        return {
            success: true,
            action: 'equip',
            itemId: itemId,
            slot: slot,
            equipment: equipment,
            unequippedItem: equipResult.unequippedItem || null
        };
    }

    /**
     * High-level unequip workflow - handles complete unequip process
     * @param {string} playerId - Player ID
     * @param {string} slot - Equipment slot to unequip
     * @param {Object} inventoryManager - Inventory manager instance
     * @returns {Object} Complete result with all necessary data
     */
    processUnequipItem(playerId, slot, inventoryManager) {
        // Validate slot
        if (!this.slots.includes(slot)) {
            return {
                success: false,
                errorCode: ErrorCodes.INVALID_SLOT,
                slot: slot
            };
        }

        // Try to unequip the item
        const unequipResult = this.unequipItem(playerId, slot);
        if (!unequipResult.success) {
            return {
                success: false,
                errorCode: unequipResult.errorCode,
                slot: slot
            };
        }

        // Check if there was an item to unequip
        if (!unequipResult.unequippedItem) {
            return {
                success: false,
                errorCode: ErrorCodes.NO_ITEM_EQUIPPED,
                slot: slot
            };
        }

        // Check if player has inventory space
        const canAdd = inventoryManager.canAddItem(playerId, unequipResult.unequippedItem, 1);
        if (!canAdd) {
            // Rollback the unequip since we can't add to inventory
            const itemTemplate = this.templateManager.getItem(unequipResult.unequippedItem);
            if (itemTemplate && itemTemplate.equipment) {
                this.equipItem(playerId, unequipResult.unequippedItem, slot);
            }
            
            return {
                success: false,
                errorCode: ErrorCodes.INVENTORY_FULL,
                slot: slot
            };
        }

        // Add unequipped item back to inventory
        inventoryManager.addItem(playerId, unequipResult.unequippedItem, 1);

        // Get final equipment state
        const equipment = this.getPlayerEquipment(playerId);

        return {
            success: true,
            action: 'unequip',
            itemId: unequipResult.unequippedItem,
            slot: slot,
            equipment: equipment
        };
    }
}