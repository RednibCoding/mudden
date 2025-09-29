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
      'remove': this.unequip.bind(this)
    }
  }

  inventory(player) {
    if (player.inventory.length === 0) {
      return "Your inventory is empty."
    }
    
    let result = "\n=== Inventory ===\n"
    
    player.inventory.forEach(inventoryItem => {
      const itemTemplate = this.gameWorld.getItem(inventoryItem.id)
      const itemName = itemTemplate ? itemTemplate.name : inventoryItem.id
      
      const isEquipped = player.equipment && Object.values(player.equipment).includes(inventoryItem.id)
      const equippedText = isEquipped ? " (equipped)" : ""
      const quantityText = inventoryItem.quantity > 1 ? ` (x${inventoryItem.quantity})` : ""
      result += `• ${itemName}${quantityText}${equippedText}\n`
    })
    
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

      // Remove from room and add to player inventory
      const itemIndex = room.items.findIndex(i => i.id === item.id)
      room.items.splice(itemIndex, 1)
      player.addItem(item.id, 1)
      takenItems.push(item.id)
      
      // Update quest progress for collection
      this.updateQuestProgress(player, 'collect', item.id)
      
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
    const item = this.findBestMatch(player.inventory, itemName)
    
    if (!item) {
      return `You don't have "${itemName}".`
    }

    // Handle different item types
    if (item.type === 'consumable') {
      if (item.effects) {
        let result = `You use the ${item.name}.`
        
        // Apply effects
        if (item.effects.health) {
          player.health = Math.min(player.maxHealth, player.health + item.effects.health)
          result += ` You restore ${item.effects.health} health.`
        }
        
        // Remove item from inventory (it's consumed)
        player.removeItem(item.id, 1)
        player.save()
        
        return result
      }
    }
    
    if (item.type === 'weapon' || item.type === 'armor') {
      return this.equip(player, args)
    }
    
    return `You can't use the ${item.name}.`
  }

  equip(player, args) {
    if (args.length === 0) {
      return "Equip what?"
    }

    const targetName = args.join(' ')
    
    // Find item in inventory using fuzzy matching (special handling for inventory items)
    let bestInventoryMatch = null
    let bestScore = 0
    
    for (const inventoryItem of player.inventory) {
      const itemTemplate = this.gameWorld.getItem(inventoryItem.id)
      if (itemTemplate) {
        const score = this.calculateMatchScore(itemTemplate.name, targetName)
        if (score > bestScore && score >= 60) {
          bestScore = score
          bestInventoryMatch = { inventoryItem, itemTemplate }
        }
      }
    }
    
    if (!bestInventoryMatch) {
      return `You don't have "${targetName}".`
    }
    
    const { inventoryItem, itemTemplate: item } = bestInventoryMatch

    // Check if item is equippable
    if (!item.type || (item.type !== 'weapon' && item.type !== 'armor')) {
      return `You can't equip the ${item.name}.`
    }

    // Initialize equipment if it doesn't exist
    if (!player.equipment) {
      player.equipment = {}
    }

    // Determine equipment slot
    let slot = item.slot || 'main_hand' // default to main_hand for weapons
    
    // Handle legacy items without slot property
    if (!item.slot) {
      if (item.type === 'weapon') {
        slot = 'main_hand'
      } else if (item.subtype) {
        slot = item.subtype // chest, legs, head, etc.
      }
    }

    // Check if something is already equipped in that slot
    if (player.equipment[slot]) {
      const currentItemTemplate = this.gameWorld.getItem(player.equipment[slot])
      if (currentItemTemplate) {
        return `You already have ${currentItemTemplate.name} equipped. Unequip it first.`
      }
    }

    // Equip the item
    player.equipment[slot] = item.id
    player.save()
    
    let result = `You equip the ${item.name}.`
    
    // Show feedback if match wasn't exact
    if (item.name.toLowerCase() !== targetName.toLowerCase()) {
      result = `("${item.name}")\n${result}`
    }
    
    return result
  }

  unequip(player, args) {
    if (args.length === 0) {
      return "Unequip what?"
    }

    const targetName = args.join(' ')
    
    if (!player.equipment) {
      return "You don't have anything equipped."
    }

    // Find equipped item by name using fuzzy matching
    for (const [slot, itemId] of Object.entries(player.equipment)) {
      const item = player.inventory.find(i => i.id === itemId)
      if (item) {
        const score = this.calculateMatchScore(item.name, targetName)
        if (score > 60) { // Good enough match
          // Unequip the item
          delete player.equipment[slot]
          player.save()
          
          let result = `You unequip the ${item.name}.`
          
          // Show feedback if match wasn't exact
          if (item.name.toLowerCase() !== targetName.toLowerCase()) {
            result = `("${item.name}")\n${result}`
          }
          
          return result
        }
      }
    }

    return `You don't have "${targetName}" equipped.`
  }

  drop(player, args) {
    return "Drop system coming soon!"
  }
}

export default InventoryCommands