class InventoryManager {
  constructor(templateManager) {
    this.templateManager = templateManager
    this.baseInventorySlots = 15
  }

  /**
   * Calculate total inventory capacity including bag bonuses
   * @param {Player} player - The player object
   * @returns {number} - Total inventory capacity
   */
  getInventoryCapacity(player) {
    let capacity = this.baseInventorySlots
    
    // Add capacity from equipped bag
    const bagItemId = player.equipment?.bag
    if (bagItemId) {
      const bagData = this.templateManager.getItem(bagItemId)
      if (bagData && bagData.effects && bagData.effects.inventory) {
        capacity += bagData.effects.inventory
      }
    }

    return capacity
  }

  /**
   * Get occupied inventory slots count
   * @param {Player} player - The player object
   * @returns {number} - Number of occupied slots
   */
  getOccupiedSlots(player) {
    if (!player.inventory || !Array.isArray(player.inventory)) {
      return 0
    }
    return player.inventory.filter(slot => slot !== null).length
  }

  /**
   * Initialize player inventory with slot-based system
   * @param {Player} player - The player object
   */
  initializeInventory(player) {
    const currentCapacity = this.getInventoryCapacity(player)
    
    if (!player.inventory || !Array.isArray(player.inventory)) {
      player.inventory = new Array(currentCapacity).fill(null)
    } else {
      // Resize inventory to match current capacity
      this.resizeInventory(player, currentCapacity)
    }
  }

  /**
   * Resize inventory array to match target capacity
   * @param {Player} player - The player object
   * @param {number} targetCapacity - Target inventory capacity
   */
  resizeInventory(player, targetCapacity) {
    if (player.inventory.length === targetCapacity) {
      return // Already correct size
    }

    if (player.inventory.length < targetCapacity) {
      // Expand inventory - add null slots
      while (player.inventory.length < targetCapacity) {
        player.inventory.push(null)
      }
    } else {
      // Shrink inventory - this should only happen during bag unequipping with validation
      player.inventory.length = targetCapacity
    }
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
   * Check if a bag can be safely unequipped without causing inventory overflow
   * @param {Player} player - The player object
   * @param {string} bagItemId - The bag item ID to check
   * @returns {Object} - {canUnequip: boolean, reason?: string}
   */
  canUnequipBag(player, bagItemId) {
    const bagData = this.templateManager.getItem(bagItemId)
    if (!bagData || !bagData.effects || !bagData.effects.inventory) {
      return { canUnequip: true } // Not a bag or no inventory effect
    }

    const currentCapacity = this.getInventoryCapacity(player)
    const newCapacity = currentCapacity - bagData.effects.inventory
    const occupiedSlots = this.getOccupiedSlots(player)

    if (occupiedSlots > newCapacity) {
      return {
        canUnequip: false,
        reason: `Cannot unequip bag: you have ${occupiedSlots} items but would only have ${newCapacity} slots. Remove ${occupiedSlots - newCapacity} items first.`
      }
    }

    return { canUnequip: true }
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

  /**
   * Find item in inventory with fuzzy matching
   * @param {Player} player - The player object
   * @param {string} query - Search query
   * @returns {Object|null} - Found inventory item or null
   */
  findItemInInventory(player, query) {
    this.initializeInventory(player)
    
    if (!player.inventory || player.inventory.length === 0) {
      return null
    }

    const queryLower = query.toLowerCase()
    
    // First: exact ID match
    let match = player.inventory.find(item => item && item.id === queryLower)
    if (match) return match

    // Second: exact name match
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName === queryLower) {
        return item
      }
    }

    // Third: fuzzy name match (starts with)
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName.startsWith(queryLower)) {
        return item
      }
    }

    // Fourth: fuzzy name match (contains)
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName.includes(queryLower)) {
        return item
      }
    }

    return null
  }

  /**
   * Get item name from template
   * @param {string} itemId - The item ID
   * @returns {string} - Item name or ID if not found
   */
  getItemName(itemId) {
    const itemTemplate = this.templateManager.getItem(itemId)
    return itemTemplate ? itemTemplate.name : itemId
  }

  /**
   * Get similar items for suggestions
   * @param {Array} inventory - Player inventory array
   * @param {string} query - Search query
   * @returns {Array} - Array of similar item names
   */
  getSimilarItems(inventory, query) {
    if (!inventory || inventory.length === 0) {
      return []
    }

    const queryLower = query.toLowerCase()
    const suggestions = []

    for (const item of inventory) {
      if (!item) continue // Skip null slots
      const itemName = this.getItemName(item.id)
      // Include items that share words or have similar characters
      if (this.isSimilar(itemName.toLowerCase(), queryLower)) {
        suggestions.push(itemName)
      }
    }

    // Remove duplicates and limit to 3 suggestions
    return [...new Set(suggestions)].slice(0, 3)
  }

  /**
   * Simple similarity check for fuzzy matching
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {boolean} - Whether strings are similar
   */
  isSimilar(str1, str2) {
    // Check if they share common words
    const words1 = str1.split(' ')
    const words2 = str2.split(' ')
    
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.length > 2 && word2.length > 2) {
          if (word1.includes(word2) || word2.includes(word1)) {
            return true
          }
        }
      }
    }

    // Check edit distance for short strings
    if (str1.length <= 6 && str2.length <= 6) {
      return this.editDistance(str1, str2) <= 2
    }

    return false
  }

  /**
   * Simple edit distance calculation for fuzzy matching
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  editDistance(str1, str2) {
    const matrix = []
    const n = str1.length
    const m = str2.length

    if (n === 0) return m
    if (m === 0) return n

    // Initialize matrix
    for (let i = 0; i <= n; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j
    }

    // Fill matrix
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        )
      }
    }

    return matrix[n][m]
  }
}

export default InventoryManager