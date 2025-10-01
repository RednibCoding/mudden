/**
 * Equipment Manager - handles player equipment and stats
 * Provides clean interface for equipment operations
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
            return { success: false, error: 'Item cannot be equipped' };
        }
        
        // Determine slot if not specified
        if (!slot) {
            slot = itemTemplate.equipment.slot;
        }
        
        // Validate slot
        if (!this.slots.includes(slot)) {
            return { success: false, error: 'Invalid equipment slot' };
        }
        
        // Check if item can be equipped to this slot
        if (itemTemplate.equipment.slot !== slot) {
            return { success: false, error: `${itemTemplate.name} cannot be equipped to ${slot}` };
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
            return { success: false, error: 'Player equipment not found' };
        }
        
        if (!this.slots.includes(slot)) {
            return { success: false, error: 'Invalid equipment slot' };
        }
        
        const currentItem = equipment[slot];
        if (!currentItem) {
            return { success: false, error: 'No item equipped in that slot' };
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
}