import BaseCommand from './BaseCommand.js'

class TradeCommands extends BaseCommand {
  constructor(worldManager, players, _unusedCombatSessions, io, commandManager = null) {
    super(worldManager, players, _unusedCombatSessions, io, commandManager)
  }

  getCommands() {
    return {
      'trade': this.trade.bind(this)
    }
  }

  trade(player, args) {
    if (args.length === 0) {
      return this.showTradeHelp()
    }

    const action = args[0].toLowerCase()
    
    switch (action) {
      case 'show':
        return this.commandManager.tradeManager.showTrade(player)
      
      case 'offer':
        return this.offerToTrade(player, args.slice(1))
      
      case 'remove':
        return this.removeFromTrade(player, args.slice(1))
      
      case 'accept':
        return this.commandManager.tradeManager.acceptTrade(player)
      
      case 'cancel':
        this.commandManager.tradeManager.cancelTrade(player.name, 'Cancelled by player')
        return "Trade cancelled."
      
      default:
        // Initiate trade with player
        const targetName = args.join(' ')
        return this.initiateTrade(player, targetName)
    }
  }

  initiateTrade(player, targetName) {
    if (!targetName) {
      return "Usage: trade <player_name>"
    }

    // Use fuzzy matching to find player
    const formattedName = this.formatPlayerName(targetName)
    return this.commandManager.tradeManager.initiateTrade(player, formattedName)
  }

  offerToTrade(player, args) {
    if (args.length === 0) {
      return "Usage: trade offer <item_name> [quantity] OR trade offer gold <amount>"
    }

    if (args[0].toLowerCase() === 'gold') {
      return this.offerGoldToTrade(player, args[1])
    }

    // Handle quantity
    let quantity = 1
    let itemQuery = args.join(' ')
    
    // Check if last argument is a number (quantity)
    const lastArg = args[args.length - 1]
    if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
      quantity = parseInt(lastArg)
      itemQuery = args.slice(0, -1).join(' ')
    }

    // Fuzzy match item in player's inventory
    const matchedItem = this.findItemInInventory(player, itemQuery)
    if (!matchedItem) {
      const suggestions = this.getSimilarItems(player, itemQuery)
      let message = `You don't have '${itemQuery}' in your inventory.`
      if (suggestions.length > 0) {
        message += `\nDid you mean: ${suggestions.join(', ')}?`
      }
      return message
    }

    return this.commandManager.tradeManager.addItemToTrade(player, matchedItem.id, quantity)
  }

  offerGoldToTrade(player, amountStr) {
    if (!amountStr) {
      return "Usage: trade offer gold <amount>"
    }

    const amount = parseInt(amountStr)
    if (isNaN(amount) || amount <= 0) {
      return "Please specify a valid gold amount."
    }

    return this.commandManager.tradeManager.addGoldToTrade(player, amount)
  }

  removeFromTrade(player, args) {
    if (args.length === 0) {
      return "Usage: trade remove <item_name>"
    }

    const itemQuery = args.join(' ')
    const matchedItem = this.findItemInTradeOffer(player, itemQuery)
    
    if (!matchedItem) {
      return `You haven't offered '${itemQuery}' in this trade.`
    }

    return this.commandManager.tradeManager.removeFromTrade(player, matchedItem.id)
  }

  // Fuzzy matching method for inventory items (handles slot-based inventory)
  findItemInInventory(player, query) {
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
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData && itemData.name.toLowerCase() === queryLower) {
        return item
      }
    }

    // Third: fuzzy name match (starts with)
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData && itemData.name.toLowerCase().startsWith(queryLower)) {
        return item
      }
    }

    // Fourth: fuzzy name match (contains)
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData && itemData.name.toLowerCase().includes(queryLower)) {
        return item
      }
    }

    // Fifth: fuzzy ID match (contains)
    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      if (item.id.toLowerCase().includes(queryLower)) {
        return item
      }
    }

    return null
  }

  // Find item in current trade offer
  findItemInTradeOffer(player, query) {
    const trade = this.commandManager.tradeManager.getPlayerTrade(player.name)
    if (!trade) return null

    const playerOffer = trade.offers[player.name]
    if (!playerOffer || !playerOffer.items) return null

    const queryLower = query.toLowerCase()

    // First: exact ID match
    let match = playerOffer.items.find(item => item.id === queryLower)
    if (match) return match

    // Second: exact name match
    for (const item of playerOffer.items) {
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData && itemData.name.toLowerCase() === queryLower) {
        return item
      }
    }

    // Third: fuzzy name match
    for (const item of playerOffer.items) {
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData && itemData.name.toLowerCase().includes(queryLower)) {
        return item
      }
    }

    return null
  }

  // Get similar items for suggestions
  getSimilarItems(player, query) {
    if (!player.inventory || player.inventory.length === 0) {
      return []
    }

    const queryLower = query.toLowerCase()
    const suggestions = []

    for (const item of player.inventory) {
      if (!item) continue // Skip null slots
      const itemData = this.worldManager.templateManager.getItem(item.id)
      if (itemData) {
        const itemName = itemData.name.toLowerCase()
        // Include items that share words or have similar characters
        if (this.isSimilar(itemName, queryLower) || this.isSimilar(item.id.toLowerCase(), queryLower)) {
          suggestions.push(itemData.name)
        }
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

  // Format player name (capitalize first letter)
  formatPlayerName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }

  showTradeHelp() {
    return `
Trade Commands:
• trade <player>            - Start a trade with another player
• trade show                - Display current trade status
• trade offer <item> [qty]  - Add item to your trade offer
• trade offer gold <amount> - Add gold to your trade offer
• trade remove <item>       - Remove item from your trade offer
• trade accept              - Accept the current trade terms
• trade cancel              - Cancel the current trade

Examples:
• trade Dragonslayer           - Start trading with player "Dragonslayer"
• trade offer healing potion   - Offer a healing potion
• trade offer iron sword 2     - Offer 2 iron swords
• trade offer gold 100         - Offer 100 gold
• trade remove iron sword      - Remove iron sword from offer
    `.trim()
  }
}

export default TradeCommands