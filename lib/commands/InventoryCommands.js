import BaseCommand from './BaseCommand.js'

class InventoryCommands extends BaseCommand {
  getCommands() {
    return {
      // Inventory
      'inventory': this.inventory.bind(this),
      'inv': this.inventory.bind(this),
      'i': this.inventory.bind(this),
      'take': this.take.bind(this),
      'get': this.take.bind(this),
      'drop': this.drop.bind(this),
      'use': this.use.bind(this),
      'equip': this.equip.bind(this),
      'unequip': this.unequip.bind(this),
      'wear': this.equip.bind(this),
      'remove': this.unequip.bind(this),
      'consolidate': this.consolidate.bind(this)
    }
  }

  inventory(player) {
    // Use InventoryManager for proper display
    const displayItems = this.worldManager.inventoryManager.getInventoryDisplay(player)
    const freeSlots = this.worldManager.inventoryManager.getFreeSlots(player)
    
    if (displayItems.length === 0) {
      return `Your inventory is empty. (${freeSlots}/15 slots free)`
    }
    
    let result = `\n=== Inventory (${displayItems.length}/15) ===\n`
    
    // Get equipped items
    const equippedItems = new Set()
    if (player.equipment) {
      Object.values(player.equipment).forEach(itemId => {
        if (itemId) equippedItems.add(itemId)
      })
    }
    
    displayItems.forEach(displayItem => {
      // Check if this specific slot contains an equipped item
      let isEquipped = false
      if (equippedItems.has(displayItem.id)) {
        // For slot-based system, we need to check if this specific item is equipped
        // We'll mark the first occurrence as equipped for individual items
        if (displayItem.stackable) {
          isEquipped = true
        } else {
          // For individual items, check if any previous slots had this item marked
          const previousSameItems = displayItems.slice(0, displayItems.indexOf(displayItem))
            .filter(item => item.id === displayItem.id && equippedItems.has(item.id))
          isEquipped = previousSameItems.length === 0
        }
      }
      
      const equippedText = isEquipped ? " (equipped)" : ""
      
      // Show quantity only for stackable items with quantity > 1
      const quantityText = displayItem.stackable && displayItem.quantity > 1 ? ` (x${displayItem.quantity})` : ""
      
      result += `• ${displayItem.name}${quantityText}${equippedText}\n`
    })
    
    if (freeSlots > 0) {
      result += `\n`
    }
    
    return result
  }

  take(player, args) {
    if (args.length === 0) {
      return "Take what?"
    }

    const room = this.getCurrentRoom(player)
    
    if (!room.items || room.items.length === 0) {
      return "There's nothing here to take."
    }

    // Parse comma-separated item names
    const inputText = args.join(' ')
    const itemNames = inputText.split(',').map(name => name.trim()).filter(name => name.length > 0)
    
    if (itemNames.length === 0) {
      return "Take what?"
    }

    const results = []
    const takenItems = []
    
    // Process each item name
    for (const itemName of itemNames) {
      // Use fuzzy matching to find the item
      const item = this.findBestMatch(room.items, itemName)
      
      if (!item) {
        results.push(`You don't see "${itemName}" here.`)
        continue
      }

      // Check if we already took this item in this command
      if (takenItems.includes(item.id)) {
        results.push(`You already took the ${item.name}.`)
        continue
      }

      // Check if this is a onetime item that the player has already taken (but not quest items)
      if (item._respawnConfig?.onetime && !item._respawnConfig?.quest && player.hasTakenOnetimeItem(player.currentArea, player.currentRoom, item.id)) {
        results.push(`You have already taken the ${item.name}.`)
        continue
      }

      // Check if player has space
      if (!this.worldManager.inventoryManager.hasSpace(player, item.id, 1)) {
        results.push(`Your inventory is full. You can't take the ${item.name}.`)
        continue
      }

      // Add to player inventory
      const success = player.addItem(item.id, 1)
      if (!success) {
        results.push(`Failed to take the ${item.name}.`)
        continue
      }
      takenItems.push(item.id)
      
      // Handle respawn logic via WorldManager
      this.worldManager.takeItem(player.currentArea, player.currentRoom, item.id)
      
      // Mark onetime items as taken by this player (but not quest items)
      if (item._respawnConfig?.onetime && !item._respawnConfig?.quest) {
        player.takeOnetimeItem(player.currentArea, player.currentRoom, item.id)
      }
      
      let itemResult = `You take the ${item.name}.`
      
      // Show feedback if match wasn't exact
      if (item.name.toLowerCase() !== itemName.toLowerCase()) {
        itemResult = `("${item.name}")\n${itemResult}`
      }
      
      results.push(itemResult)
    }
    
    player.save()
    
    return results.join('\n')
  }

  use(player, args) {
    if (args.length === 0) {
      return "Use what?"
    }

    const itemName = args.join(' ')
    
    // Create enriched inventory for matching (add item names)
    const enrichedInventory = player.inventory.map(invItem => {
      const itemData = this.worldManager.templateManager.getItem(invItem.id)
      return {
        ...invItem,
        name: itemData ? itemData.name : invItem.id,
        data: itemData
      }
    })
    
    const item = this.findBestMatch(enrichedInventory, itemName)
    
    if (!item) {
      return `You don't have "${itemName}".`
    }

    // Handle different item types
    const itemData = item.data
    if (itemData.type === 'consumable' || itemData.type === 'scroll') {
      if (itemData.effects) {
        let result = `You use the ${itemData.name}.`
        
        // Apply healing effects (potions)
        if (itemData.effects.health) {
          player.health = Math.min(player.maxHealth, player.health + itemData.effects.health)
          result += ` You restore ${itemData.effects.health} health.`
        }
        
        // Apply offensive effects (scrolls) - only works in combat
        if (itemData.effects.damage) {
          const combat = this.combatSessions[player.name]
          if (!combat) {
            result += ` The scroll's power fizzles without a target to attack.`
          } else {
            const damage = itemData.effects.damage
            combat.defender.data.health -= damage
            result += ` The scroll unleashes magical energy, dealing ${damage} damage to ${combat.defender.name}!`
            
            // Check if target dies from scroll damage
            if (combat.defender.data.health <= 0) {
              // Get reference to CombatCommands to handle victory
              const combatCommands = this.commandManager?.getCommandInstance('CombatCommands')
              if (combatCommands) {
                result += `\n${combatCommands.handleCombatVictory(combat)}`
              } else {
                result += `\n${combat.defender.name} is defeated by your scroll!`
                // Combat cleanup handled by global tick system
                player.inCombat = false
                delete this.combatSessions[player.name]
              }
            }
          }
        }
        
        // Apply spell effects (other magical effects)
        if (itemData.effects.spell) {
          result += ` The scroll glows with ${itemData.effects.spell} magic!`
        }
        
        // Remove item from inventory (it's consumed)
        player.removeItem(item.id, 1)
        player.save()
        
        return result
      }
    }
    
    if (itemData.type === 'weapon' || itemData.type === 'armor') {
      return this.equip(player, args)
    }
    
    return `You can't use the ${itemData.name}.`
  }

  equip(player, args) {
    if (args.length === 0) {
      return "Equip what?"
    }

    // Check if player is in a trade
    if (this.commandManager && this.commandManager.tradeManager.isPlayerInTrade(player.name)) {
      return "You can't change equipment while in a trade. Cancel the trade first."
    }

    const targetName = args.join(' ')
    
    // Find item in inventory using fuzzy matching
    const inventoryItem = this.findItemInInventory(player, targetName)
    if (!inventoryItem) {
      const suggestions = this.getSimilarItems(player.inventory, targetName)
      let message = `You don't have '${targetName}' in your inventory.`
      if (suggestions.length > 0) {
        message += `\nDid you mean: ${suggestions.join(', ')}?`
      }
      return message
    }
    
    const itemTemplate = this.worldManager.templateManager.getItem(inventoryItem.id)
    if (!itemTemplate) {
      return `Item not found.`
    }

    // Check if item is equippable
    if (!itemTemplate.type || (itemTemplate.type !== 'weapon' && itemTemplate.type !== 'armor')) {
      return `You can't equip the ${itemTemplate.name}.`
    }

    // Check if item has a valid slot
    if (!itemTemplate.slot) {
      return `The ${itemTemplate.name} cannot be equipped (no slot defined).`
    }

    // Use EquipmentManager to equip the item
    const result = player.equip(inventoryItem.id, itemTemplate.slot)
    if (result.success) {
      player.save()
      let message = result.message
      
      // Show feedback if match wasn't exact
      if (itemTemplate.name.toLowerCase() !== targetName.toLowerCase()) {
        message = `("${itemTemplate.name}")\n${result.message}`
      }
      
      return message
    } else {
      return result.message
    }
  }

  unequip(player, args) {
    if (args.length === 0) {
      return "Unequip what?"
    }

    // Check if player is in a trade
    if (this.commandManager && this.commandManager.tradeManager.isPlayerInTrade(player.name)) {
      return "You can't change equipment while in a trade. Cancel the trade first."
    }

    const targetName = args.join(' ')
    
    if (!player.equipment) {
      return "You don't have anything equipped."
    }

    // Find equipped item by name using fuzzy matching
    let bestMatch = null
    let bestScore = 0
    let bestSlot = null
    
    for (const [slot, itemId] of Object.entries(player.equipment)) {
      if (itemId) {
        const itemTemplate = this.worldManager.templateManager.getItem(itemId)
        if (itemTemplate) {
          const score = this.calculateMatchScore(itemTemplate.name, targetName)
          if (score > bestScore && score >= 60) {
            bestScore = score
            bestMatch = itemTemplate
            bestSlot = slot
          }
        }
      }
    }
    
    if (!bestMatch) {
      return `You don't have "${targetName}" equipped.`
    }

    // Use EquipmentManager to unequip the item
    const result = player.unequip(bestSlot)
    if (result.success) {
      player.save()
      let message = result.message
      
      // Show feedback if match wasn't exact
      if (bestMatch.name.toLowerCase() !== targetName.toLowerCase()) {
        message = `("${bestMatch.name}")\n${result.message}`
      }
      
      return message
    } else {
      return result.message
    }
  }

  drop(player, args) {
    if (args.length === 0) {
      return "Drop what?"
    }

    // Check if player is in a trade
    if (this.commandManager && this.commandManager.tradeManager.isPlayerInTrade(player.name)) {
      return "You can't drop items while in a trade. Cancel the trade first."
    }

    let itemQuery = args.join(' ')
    
    // Parse quantity if specified (e.g., "drop iron sword 2")
    let quantity = 1
    const words = itemQuery.split(' ')
    const lastWord = words[words.length - 1]
    
    if (!isNaN(lastWord) && parseInt(lastWord) > 0) {
      quantity = parseInt(lastWord)
      itemQuery = words.slice(0, -1).join(' ')
    }

    // Find item in inventory using fuzzy matching
    const inventoryItem = this.findItemInInventory(player, itemQuery)
    if (!inventoryItem) {
      const suggestions = this.getSimilarItems(player.inventory, itemQuery)
      let message = `You don't have '${itemQuery}' in your inventory.`
      if (suggestions.length > 0) {
        message += `\nDid you mean: ${suggestions.join(', ')}?`
      }
      return message
    }

    // Check quantity
    if (quantity > inventoryItem.quantity) {
      return `You only have ${inventoryItem.quantity} ${this.getItemName(inventoryItem.id)}, but tried to drop ${quantity}.`
    }

    // Remove item from inventory
    const success = player.removeItem(inventoryItem.id, quantity)
    if (!success) {
      return "Failed to drop the item."
    }

    player.save()

    const itemName = this.getItemName(inventoryItem.id)
    const quantityText = quantity > 1 ? ` x${quantity}` : ''
    
    // Notify other players in the room
    const room = this.getCurrentRoom(player)
    if (room) {
      this.sendToRoom(player.currentArea, player.currentRoom, 
        `${player.name} drops ${itemName}${quantityText}.`, player.name)
    }

    return `You drop ${itemName}${quantityText}.`
  }

  // Helper method to find item in inventory with fuzzy matching
  findItemInInventory(player, query) {
    if (!player.inventory || player.inventory.length === 0) {
      return null
    }

    const queryLower = query.toLowerCase()
    
    // First: exact ID match
    let match = player.inventory.find(item => item.id === queryLower)
    if (match) return match

    // Second: exact name match
    for (const item of player.inventory) {
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName === queryLower) {
        return item
      }
    }

    // Third: fuzzy name match (starts with)
    for (const item of player.inventory) {
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName.startsWith(queryLower)) {
        return item
      }
    }

    // Fourth: fuzzy name match (contains)
    for (const item of player.inventory) {
      const itemName = this.getItemName(item.id).toLowerCase()
      if (itemName.includes(queryLower)) {
        return item
      }
    }

    // Fifth: fuzzy ID match (contains)
    for (const item of player.inventory) {
      if (item.id.toLowerCase().includes(queryLower)) {
        return item
      }
    }

    return null
  }

  // Helper method to get item name from template
  getItemName(itemId) {
    const itemTemplate = this.worldManager.templateManager.getItem(itemId)
    return itemTemplate ? itemTemplate.name : itemId
  }

  // Helper method to get similar items for suggestions
  getSimilarItems(inventory, query) {
    if (!inventory || inventory.length === 0) {
      return []
    }

    const queryLower = query.toLowerCase()
    const suggestions = []

    for (const item of inventory) {
      const itemName = this.getItemName(item.id)
      // Include items that share words or have similar characters
      if (this.isSimilar(itemName.toLowerCase(), queryLower)) {
        suggestions.push(itemName)
      }
    }

    // Remove duplicates and limit to 3 suggestions
    return [...new Set(suggestions)].slice(0, 3)
  }

  // Simple similarity check
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

  // Simple edit distance calculation
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

  consolidate(player) {
    const slotsFreed = this.worldManager.inventoryManager.consolidateInventory(player)
    
    if (slotsFreed > 0) {
      player.save()
      return `Inventory consolidated! ${slotsFreed} slots freed up by combining stackable items.`
    } else {
      return "No stackable items to consolidate."
    }
  }
}

export default InventoryCommands