/**
 * EquipmentManager - Handles all equipment-related operations
 * Manages equipping, unequipping, and equipment validation
 */
export class EquipmentManager {
  constructor(templateManager, inventoryManager) {
    this.templateManager = templateManager
    this.inventoryManager = inventoryManager
    
    // Define valid equipment slots
    this.validSlots = ['main_hand', 'off_hand', 'chest', 'legs', 'head', 'feet', 'hands']
  }

  /**
   * Equip an item to a specific slot
   * @param {Player} player - The player object
   * @param {string} itemId - ID of the item to equip
   * @param {string} slot - Equipment slot to equip to
   * @returns {Object} Result object with success status and message
   */
  equipItem(player, itemId, slot) {
    try {
      // Validate slot
      if (!this.validSlots.includes(slot)) {
        return {
          success: false,
          message: `Invalid equipment slot: ${slot}. Valid slots are: ${this.validSlots.join(', ')}`
        }
      }

      // Check if player has the item
      if (!this.inventoryManager.hasItem(player, itemId, 1)) {
        return {
          success: false,
          message: `You don't have ${itemId} in your inventory.`
        }
      }

      // Get item template to validate it's equippable
      const itemTemplate = this.templateManager.getItem(itemId)
      if (!itemTemplate) {
        return {
          success: false,
          message: `Item ${itemId} not found.`
        }
      }

      // Check if item is equippable in this slot
      if (!itemTemplate.slot || itemTemplate.slot !== slot) {
        return {
          success: false,
          message: `${itemTemplate.name} cannot be equipped in ${slot} slot.`
        }
      }

      // Initialize equipment object if it doesn't exist
      if (!player.equipment) {
        player.equipment = {}
      }

      // Unequip current item in slot if any
      if (player.equipment[slot]) {
        const unequipResult = this.unequipItem(player, slot)
        if (!unequipResult.success) {
          return unequipResult
        }
      }

      // Remove item from inventory
      const removeResult = this.inventoryManager.removeItem(player, itemId, 1)
      if (!removeResult) {
        return {
          success: false,
          message: `Failed to remove ${itemId} from inventory.`
        }
      }

      // Equip the item
      player.equipment[slot] = itemId

      return {
        success: true,
        message: `You equip ${itemTemplate.name} in your ${slot.replace('_', ' ')} slot.`,
        equippedItem: itemTemplate.name,
        slot: slot
      }

    } catch (error) {
      console.error('Error equipping item:', error)
      return {
        success: false,
        message: 'An error occurred while equipping the item.'
      }
    }
  }

  /**
   * Unequip an item from a specific slot
   * @param {Player} player - The player object
   * @param {string} slot - Equipment slot to unequip from
   * @returns {Object} Result object with success status and message
   */
  unequipItem(player, slot) {
    try {
      // Validate slot
      if (!this.validSlots.includes(slot)) {
        return {
          success: false,
          message: `Invalid equipment slot: ${slot}`
        }
      }

      // Check if there's an item equipped in this slot
      if (!player.equipment || !player.equipment[slot]) {
        return {
          success: false,
          message: `No item equipped in ${slot.replace('_', ' ')} slot.`
        }
      }

      const itemId = player.equipment[slot]
      const itemTemplate = this.templateManager.getItem(itemId)
      const itemName = itemTemplate ? itemTemplate.name : itemId

      // Add item back to inventory
      const addResult = this.inventoryManager.addItem(player, itemId, 1)
      if (!addResult) {
        return {
          success: false,
          message: `Failed to add ${itemName} back to inventory.`
        }
      }

      // Remove from equipment slot
      player.equipment[slot] = null

      return {
        success: true,
        message: `You unequip ${itemName} from your ${slot.replace('_', ' ')} slot.`,
        unequippedItem: itemName,
        slot: slot
      }

    } catch (error) {
      console.error('Error unequipping item:', error)
      return {
        success: false,
        message: 'An error occurred while unequipping the item.'
      }
    }
  }

  /**
   * Get equipment display for a player
   * @param {Player} player - The player object
   * @returns {string} Formatted equipment display
   */
  getEquipmentDisplay(player) {
    if (!player.equipment) {
      return "You have no equipment."
    }

    const lines = ["Equipment:"]
    let hasEquipment = false

    for (const slot of this.validSlots) {
      const itemId = player.equipment[slot]
      if (itemId) {
        const itemTemplate = this.templateManager.getItem(itemId)
        const itemName = itemTemplate ? itemTemplate.name : itemId
        const slotName = slot.replace('_', ' ')
        lines.push(`  ${slotName}: ${itemName}`)
        hasEquipment = true
      }
    }

    if (!hasEquipment) {
      return "You have no equipment."
    }

    return lines.join('\n')
  }

  /**
   * Calculate total stats from equipped items
   * @param {Player} player - The player object
   * @returns {Object} Object containing stat bonuses from equipment
   */
  getEquipmentStats(player) {
    const stats = {
      strength: 0,
      defense: 0,
      speed: 0
    }

    if (!player.equipment) {
      return stats
    }

    for (const slot of this.validSlots) {
      const itemId = player.equipment[slot]
      if (itemId) {
        const itemTemplate = this.templateManager.getItem(itemId)
        if (itemTemplate && itemTemplate.effects) {
          if (itemTemplate.effects.strength) {
            stats.strength += itemTemplate.effects.strength
          }
          if (itemTemplate.effects.defense) {
            stats.defense += itemTemplate.effects.defense
          }
          if (itemTemplate.effects.speed) {
            stats.speed += itemTemplate.effects.speed
          }
        }
      }
    }

    return stats
  }

  /**
   * Check if an item is currently equipped
   * @param {Player} player - The player object
   * @param {string} itemId - ID of the item to check
   * @returns {string|null} The slot where the item is equipped, or null if not equipped
   */
  isItemEquipped(player, itemId) {
    if (!player.equipment) {
      return null
    }

    for (const slot of this.validSlots) {
      if (player.equipment[slot] === itemId) {
        return slot
      }
    }

    return null
  }

  /**
   * Get all equipped items
   * @param {Player} player - The player object
   * @returns {Array} Array of {slot, itemId, itemTemplate} objects
   */
  getEquippedItems(player) {
    const equippedItems = []

    if (!player.equipment) {
      return equippedItems
    }

    for (const slot of this.validSlots) {
      const itemId = player.equipment[slot]
      if (itemId) {
        const itemTemplate = this.templateManager.getItem(itemId)
        equippedItems.push({
          slot,
          itemId,
          itemTemplate
        })
      }
    }

    return equippedItems
  }

  /**
   * Validate equipment integrity (cleanup invalid items)
   * @param {Player} player - The player object
   * @returns {Array} Array of error messages for any issues found
   */
  validateEquipment(player) {
    const errors = []

    if (!player.equipment) {
      return errors
    }

    // Check for invalid slots
    for (const slot in player.equipment) {
      if (!this.validSlots.includes(slot)) {
        delete player.equipment[slot]
        errors.push(`Removed invalid equipment slot: ${slot}`)
      }
    }

    // Check for invalid items
    for (const slot of this.validSlots) {
      const itemId = player.equipment[slot]
      if (itemId) {
        const itemTemplate = this.templateManager.getItem(itemId)
        if (!itemTemplate) {
          player.equipment[slot] = null
          errors.push(`Removed invalid item ${itemId} from ${slot} slot`)
        } else if (itemTemplate.slot !== slot) {
          // Move item back to inventory if possible
          if (this.inventoryManager.addItem(player, itemId, 1)) {
            player.equipment[slot] = null
            errors.push(`Moved ${itemTemplate.name} back to inventory (invalid slot)`)
          } else {
            player.equipment[slot] = null
            errors.push(`Removed ${itemTemplate.name} from invalid slot (inventory full)`)
          }
        }
      }
    }

    return errors
  }
}

export default EquipmentManager