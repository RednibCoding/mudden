class InventoryManager {
  constructor(templateManager) {
    this.templateManager = templateManager
    this.maxInventorySlots = 15
  }

  /**
   * Initialize player inventory with slot-based system
   * @param {Player} player - The player object
   */
  initializeInventory(player) {
    if (!player.inventory) {
      player.inventory = new Array(this.maxInventorySlots).fill(null)
    } else if (Array.isArray(player.inventory)) {
      // Check if this is the old inventory format
      const hasOldFormat = player.inventory.some(item => 
        item && typeof item === 'object' && item.id && typeof item.quantity === 'number'
      )
      
      if (hasOldFormat) {
        // Migrate from old system to slot-based system
        this.migrateToSlotBased(player)
      } else if (player.inventory.length !== this.maxInventorySlots) {
        // Resize inventory to match max slots
        player.inventory.length = this.maxInventorySlots
        for (let i = 0; i < this.maxInventorySlots; i++) {
          if (player.inventory[i] === undefined) {
            player.inventory[i] = null
          }
        }
      }
    } else {
      // Invalid inventory format, reset to empty
      player.inventory = new Array(this.maxInventorySlots).fill(null)
    }
  }

  /**
   * Migrate from old inventory system to slot-based system
   * @param {Player} player - The player object
   */
  migrateToSlotBased(player) {
    const oldInventory = [...player.inventory]
    player.inventory = new Array(this.maxInventorySlots).fill(null)
    
    let slotIndex = 0
    for (const oldItem of oldInventory) {
      if (slotIndex >= this.maxInventorySlots) break
      
      // Skip null or invalid items
      if (!oldItem || !oldItem.id || typeof oldItem.quantity !== 'number' || oldItem.quantity <= 0) continue
      
      const itemData = this.templateManager.getItem(oldItem.id)
      if (!itemData) continue
      
      if (itemData.stackable) {
        // For stackable items, add to existing stack or create new slot
        const existingSlot = player.inventory.findIndex(slot => 
          slot && slot.id === oldItem.id
        )
        
        if (existingSlot !== -1) {
          player.inventory[existingSlot].quantity += oldItem.quantity
        } else {
          player.inventory[slotIndex] = { id: oldItem.id, quantity: oldItem.quantity }
          slotIndex++
        }
      } else {
        // For non-stackable items, each gets its own slot
        for (let i = 0; i < oldItem.quantity && slotIndex < this.maxInventorySlots; i++) {
          player.inventory[slotIndex] = { id: oldItem.id, quantity: 1 }
          slotIndex++
        }
      }
    }

    // After migration, consolidate any stackable items that might now be stackable
    // (Call consolidation directly without re-initializing)
    this.directConsolidate(player)
  }

  /**
   * Add item to player inventory with slot-based system
   * @param {Player} player - The player object
   * @param {string} itemId - The item ID to add
   * @param {number} quantity - The quantity to add
   * @returns {boolean} - Success status
   */
  addItem(player, itemId, quantity = 1) {
    this.initializeInventory(player)

    const itemData = this.templateManager.getItem(itemId)
    if (!itemData) {
      console.error(`InventoryManager: Unknown item ${itemId}`)
      return false
    }

    const isStackable = itemData.stackable === true

    if (isStackable) {
      // For stackable items, try to add to existing stack first
      const existingSlot = player.inventory.findIndex(slot => 
        slot && slot.id === itemId
      )
      
      if (existingSlot !== -1) {
        player.inventory[existingSlot].quantity += quantity
        return true
      } else {
        // Find first empty slot
        const emptySlot = player.inventory.findIndex(slot => slot === null)
        if (emptySlot !== -1) {
          player.inventory[emptySlot] = { id: itemId, quantity }
          return true
        }
      }
    } else {
      // For non-stackable items, each needs its own slot
      let itemsAdded = 0
      for (let i = 0; i < quantity; i++) {
        const emptySlot = player.inventory.findIndex(slot => slot === null)
        if (emptySlot !== -1) {
          player.inventory[emptySlot] = { id: itemId, quantity: 1 }
          itemsAdded++
        } else {
          break // No more empty slots
        }
      }
      return itemsAdded === quantity
    }

    return false // No space
  }

    /**
   * Remove item from player inventory with slot-based system
   * @param {Player} player - The player object
   * @param {string} itemId - The item ID to remove
   * @param {number} quantity - The quantity to remove
   * @returns {boolean} - Success status
   */
  removeItem(player, itemId, quantity = 1) {
    this.initializeInventory(player)

    const itemData = this.templateManager.getItem(itemId)
    if (!itemData) {
      return false
    }

    const isStackable = itemData.stackable === true

    if (isStackable) {
      // For stackable items, reduce quantity from existing stack
      const slotIndex = player.inventory.findIndex(slot => 
        slot && slot.id === itemId && slot.quantity >= quantity
      )
      
      if (slotIndex !== -1) {
        player.inventory[slotIndex].quantity -= quantity
        if (player.inventory[slotIndex].quantity <= 0) {
          player.inventory[slotIndex] = null
        }
        return true
      }
    } else {
      // For non-stackable items, remove individual slots
      let removedCount = 0
      for (let i = player.inventory.length - 1; i >= 0 && removedCount < quantity; i--) {
        if (player.inventory[i] && player.inventory[i].id === itemId) {
          player.inventory[i] = null
          removedCount++
        }
      }
      return removedCount === quantity
    }

    return false
  }

  /**
   * Get total quantity of an item in inventory
   * @param {Player} player - The player object
   * @param {string} itemId - The item ID to count
   * @returns {number} - Total quantity
   */
  getItemQuantity(player, itemId) {
    this.initializeInventory(player)

    const itemData = this.templateManager.getItem(itemId)
    if (!itemData) {
      return 0
    }

    const isStackable = itemData.stackable === true

    if (isStackable) {
      const slot = player.inventory.find(slot => slot && slot.id === itemId)
      return slot ? slot.quantity : 0
    } else {
      return player.inventory.filter(slot => slot && slot.id === itemId).length
    }
  }

  /**
   * Get inventory display for slot-based system
   * @param {Player} player - The player object
   * @returns {Array} - Array of {id, name, quantity, stackable, slotIndex} objects
   */
  getInventoryDisplay(player) {
    this.initializeInventory(player)

    const displayItems = []

    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i]
      if (slot) {
        const itemData = this.templateManager.getItem(slot.id)
        if (itemData) {
          displayItems.push({
            id: slot.id,
            name: itemData.name,
            quantity: slot.quantity,
            stackable: itemData.stackable === true,
            slotIndex: i,
            itemData: itemData
          })
        }
      }
    }

    return displayItems
  }

  /**
   * Get number of free inventory slots
   * @param {Player} player - The player object
   * @returns {number} - Number of free slots
   */
  getFreeSlots(player) {
    this.initializeInventory(player)
    return player.inventory.filter(slot => slot === null).length
  }

  /**
   * Check if inventory has space for an item
   * @param {Player} player - The player object
   * @param {string} itemId - The item ID to check
   * @param {number} quantity - The quantity to add
   * @returns {boolean} - Whether there's space
   */
  hasSpace(player, itemId, quantity = 1) {
    this.initializeInventory(player)

    const itemData = this.templateManager.getItem(itemId)
    if (!itemData) return false

    if (itemData.stackable) {
      // For stackable items, check if existing stack or one free slot
      const existingSlot = player.inventory.find(slot => slot && slot.id === itemId)
      if (existingSlot) return true
      return this.getFreeSlots(player) > 0
    } else {
      // For non-stackable items, need one slot per item
      return this.getFreeSlots(player) >= quantity
    }
  }

  /**
   * Get a specific item from a slot (for fuzzy matching)
   * @param {Player} player - The player object
   * @param {string} itemQuery - The item query to search for
   * @returns {Object|null} - The inventory slot object or null
   */
  findItemInSlot(player, itemQuery) {
    this.initializeInventory(player)

    for (const slot of player.inventory) {
      if (slot) {
        const itemData = this.templateManager.getItem(slot.id)
        if (itemData && itemData.name.toLowerCase().includes(itemQuery.toLowerCase())) {
          return slot
        }
      }
    }
    return null
  }

  /**
   * Consolidate stackable items in inventory (combine individual items into stacks)
   * @param {Player} player - The player object
   * @returns {number} - Number of slots freed up
   */
  consolidateInventory(player) {
    this.initializeInventory(player)
    return this.directConsolidate(player)
  }

  /**
   * Direct consolidation without initialization (used during migration)
   * @param {Player} player - The player object
   * @returns {number} - Number of slots freed up
   */
  directConsolidate(player) {
    const stackableItems = new Map()
    let slotsFreed = 0

    // First pass: identify all stackable items and their quantities
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i]
      if (slot) {
        const itemData = this.templateManager.getItem(slot.id)
        if (itemData && itemData.stackable) {
          const currentCount = stackableItems.get(slot.id) || { quantity: 0, firstSlot: -1 }
          currentCount.quantity += slot.quantity
          if (currentCount.firstSlot === -1) {
            currentCount.firstSlot = i
          }
          stackableItems.set(slot.id, currentCount)
        }
      }
    }

    // Second pass: consolidate stackable items
    for (const [itemId, info] of stackableItems) {
      if (info.quantity <= 1 || info.firstSlot === -1) continue

      let totalQuantity = 0
      let firstSlotIndex = -1

      // Count total quantity and clear all slots with this item
      for (let i = 0; i < player.inventory.length; i++) {
        const slot = player.inventory[i]
        if (slot && slot.id === itemId) {
          totalQuantity += slot.quantity
          if (firstSlotIndex === -1) {
            firstSlotIndex = i
          } else {
            player.inventory[i] = null
            slotsFreed++
          }
        }
      }

      // Put all quantity in the first slot found
      if (firstSlotIndex !== -1 && totalQuantity > 0) {
        player.inventory[firstSlotIndex] = { id: itemId, quantity: totalQuantity }
      }
    }

    return slotsFreed
  }

  /**
   * Check if player has enough of an item
   * @param {Player} player - The player object
   * @param {string} itemId - The item ID to check
   * @param {number} quantity - The quantity needed
   * @returns {boolean} - Whether player has enough
   */
  hasItem(player, itemId, quantity = 1) {
    return this.getItemQuantity(player, itemId) >= quantity
  }

  /**
   * Migrate existing inventory to new system (for existing saves)
   * @param {Player} player - The player object
   */
  migrateInventory(player) {
    if (!player.inventory) {
      return
    }

    // Group existing items and rebuild inventory with proper stacking
    const itemCounts = new Map()
    
    // Count all items
    for (const invItem of player.inventory) {
      const current = itemCounts.get(invItem.id) || 0
      itemCounts.set(invItem.id, current + invItem.quantity)
    }

    // Clear and rebuild inventory
    player.inventory = []
    
    for (const [itemId, totalQuantity] of itemCounts) {
      this.addItem(player, itemId, totalQuantity)
    }
  }
}

export default InventoryManager