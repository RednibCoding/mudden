import crypto from 'crypto'

class TradeManager {
  constructor(worldManager, sessionManager, io) {
    this.activeTrades = new Map() // tradeId -> tradeSession
    this.playerTrades = new Map() // playerName -> tradeId
    this.worldManager = worldManager
    this.sessionManager = sessionManager
    this.io = io
    
    // Trade timeout (5 minutes)
    this.tradeTimeout = 5 * 60 * 1000
  }

  // Check if player is in a trade
  isPlayerInTrade(playerName) {
    return this.playerTrades.has(playerName)
  }

  // Get trade session for player
  getPlayerTrade(playerName) {
    const tradeId = this.playerTrades.get(playerName)
    return tradeId ? this.activeTrades.get(tradeId) : null
  }

  // Initiate trade between two players
  initiateTrade(initiator, targetName) {
    // Validation checks
    if (initiator.name === targetName) {
      return "You can't trade with yourself."
    }

    if (this.isPlayerInTrade(initiator.name)) {
      return "You are already in a trade. Cancel it first with 'trade cancel'."
    }

    if (initiator.inCombat) {
      return "You can't trade while in combat."
    }

    // Find target player
    const target = this.getPlayerByName(targetName)
    if (!target) {
      return `Player ${targetName} is not online.`
    }

    if (this.isPlayerInTrade(target.name)) {
      return `${target.name} is already in a trade.`
    }

    if (target.inCombat) {
      return `${target.name} is in combat and cannot trade.`
    }

    // Check if players are in same room
    if (initiator.currentArea !== target.currentArea || 
        initiator.currentRoom !== target.currentRoom) {
      return `You must be in the same room as ${target.name} to trade.`
    }

    // Create trade session
    const tradeId = crypto.randomUUID()
    const tradeSession = {
      id: tradeId,
      players: [initiator.name, target.name],
      offers: {
        [initiator.name]: { items: [], gold: 0, accepted: false },
        [target.name]: { items: [], gold: 0, accepted: false }
      },
      status: 'active',
      createdAt: Date.now(),
      timeoutId: null
    }

    // Set timeout
    tradeSession.timeoutId = setTimeout(() => {
      this.cancelTrade(initiator.name, 'Trade timed out after 5 minutes')
    }, this.tradeTimeout)

    // Store trade session
    this.activeTrades.set(tradeId, tradeSession)
    this.playerTrades.set(initiator.name, tradeId)
    this.playerTrades.set(target.name, tradeId)

    // Notify target player
    this.sendToPlayer(target.name, `${initiator.name} wants to trade with you. The trade window is now open.`)

    return `You start a trade with ${target.name}.`
  }

  // Add item to trade offer
  addItemToTrade(player, itemId, quantity = 1) {
    const trade = this.getPlayerTrade(player.name)
    if (!trade) {
      return "You are not in a trade."
    }

    const playerOffer = trade.offers[player.name]
    if (playerOffer.accepted) {
      return "You have already accepted this trade. Cancel first to make changes."
    }

    // Validate item ownership
    const inventoryItem = player.inventory.find(item => item.id === itemId)
    if (!inventoryItem) {
      return `You don't have ${itemId} in your inventory.`
    }

    if (inventoryItem.quantity < quantity) {
      return `You only have ${inventoryItem.quantity} ${itemId}, but tried to offer ${quantity}.`
    }

    // Check if item is already in offer
    const existingOffer = playerOffer.items.find(item => item.id === itemId)
    if (existingOffer) {
      const newTotal = existingOffer.quantity + quantity
      if (newTotal > inventoryItem.quantity) {
        return `You can't offer ${newTotal} ${itemId}, you only have ${inventoryItem.quantity}.`
      }
      existingOffer.quantity = newTotal
    } else {
      playerOffer.items.push({ id: itemId, quantity })
    }

    // Reset acceptance status
    this.resetAcceptanceStatus(trade)

    // Get item display name
    const itemData = this.getItemData(itemId)
    const itemName = itemData?.name || itemId

    // Notify other player only
    const otherPlayerName = trade.players.find(p => p !== player.name)
    const message = `${player.name} offers ${itemName}${quantity > 1 ? ` x${quantity}` : ''} to the trade.`
    this.sendToPlayer(otherPlayerName, message)

    return `You offer ${itemName}${quantity > 1 ? ` x${quantity}` : ''} to the trade.`
  }

  // Add gold to trade offer
  addGoldToTrade(player, amount) {
    const trade = this.getPlayerTrade(player.name)
    if (!trade) {
      return "You are not in a trade."
    }

    const playerOffer = trade.offers[player.name]
    if (playerOffer.accepted) {
      return "You have already accepted this trade. Cancel first to make changes."
    }

    if (isNaN(amount) || amount <= 0) {
      return "Please specify a valid gold amount."
    }

    if (player.gold < amount) {
      return `You only have ${player.gold} gold, but tried to offer ${amount}.`
    }

    // Add to existing gold offer
    const newTotal = playerOffer.gold + amount
    if (newTotal > player.gold) {
      return `You can't offer ${newTotal} gold, you only have ${player.gold}.`
    }

    playerOffer.gold = newTotal

    // Reset acceptance status
    this.resetAcceptanceStatus(trade)

    // Notify other player only
    const otherPlayerName = trade.players.find(p => p !== player.name)
    const message = `${player.name} offers ${amount} gold to the trade (total: ${newTotal} gold).`
    this.sendToPlayer(otherPlayerName, message)

    return `You offer ${amount} gold to the trade (total: ${newTotal} gold).`
  }

  // Remove item from trade offer
  removeFromTrade(player, itemId) {
    const trade = this.getPlayerTrade(player.name)
    if (!trade) {
      return "You are not in a trade."
    }

    const playerOffer = trade.offers[player.name]
    if (playerOffer.accepted) {
      return "You have already accepted this trade. Cancel first to make changes."
    }

    // Find and remove item
    const itemIndex = playerOffer.items.findIndex(item => item.id === itemId)
    if (itemIndex === -1) {
      return `You haven't offered ${itemId} in this trade.`
    }

    const removedItem = playerOffer.items.splice(itemIndex, 1)[0]

    // Reset acceptance status
    this.resetAcceptanceStatus(trade)

    // Get item display name
    const itemData = this.getItemData(itemId)
    const itemName = itemData?.name || itemId

    // Notify other player only
    const otherPlayerName = trade.players.find(p => p !== player.name)
    const message = `${player.name} removes ${itemName}${removedItem.quantity > 1 ? ` x${removedItem.quantity}` : ''} from the trade.`
    this.sendToPlayer(otherPlayerName, message)

    return `You remove ${itemName}${removedItem.quantity > 1 ? ` x${removedItem.quantity}` : ''} from the trade.`
  }

  // Accept trade
  acceptTrade(player) {
    const trade = this.getPlayerTrade(player.name)
    if (!trade) {
      return "You are not in a trade."
    }

    const playerOffer = trade.offers[player.name]
    if (playerOffer.accepted) {
      return "You have already accepted this trade."
    }

    // Mark as accepted
    playerOffer.accepted = true

    // Check if both players have accepted
    const otherPlayerName = trade.players.find(name => name !== player.name)
    const otherOffer = trade.offers[otherPlayerName]

    if (otherOffer.accepted) {
      // Complete the trade
      return this.completeTrade(trade.id)
    } else {
      // Notify other player only
      this.sendToPlayer(otherPlayerName, `${player.name} accepts the trade. Waiting for ${otherPlayerName} to accept.`)
      return `You accept the trade. Waiting for ${otherPlayerName} to accept.`
    }
  }

  // Complete trade
  completeTrade(tradeId) {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return "Trade not found."
    }

    const [player1Name, player2Name] = trade.players
    const player1 = this.getPlayerByName(player1Name)
    const player2 = this.getPlayerByName(player2Name)

    if (!player1 || !player2) {
      this.cancelTrade(player1Name || player2Name, 'Player not found')
      return "Trade cancelled: player not found."
    }

    const offer1 = trade.offers[player1Name]
    const offer2 = trade.offers[player2Name]

    try {
      // Validate inventory space
      if (!this.validateTradeCompletion(player1, player2, offer1, offer2)) {
        this.cancelTrade(player1Name, 'Not enough inventory space')
        return "Trade cancelled: not enough inventory space."
      }

      // Execute the trade
      this.executeItemTransfer(player1, player2, offer1, offer2)

      // Clear timeout
      if (trade.timeoutId) {
        clearTimeout(trade.timeoutId)
      }

      // Clean up trade session
      this.activeTrades.delete(tradeId)
      this.playerTrades.delete(player1Name)
      this.playerTrades.delete(player2Name)

      // Save both players
      player1.save()
      player2.save()

      // Notify both players
      const completionMessage = this.generateCompletionMessage(player1Name, player2Name, offer1, offer2)
      this.sendToPlayer(player1Name, completionMessage.player1)
      this.sendToPlayer(player2Name, completionMessage.player2)

      return "\n" // Success message handled by notifications

    } catch (error) {
      console.error('Trade completion error:', error)
      this.cancelTrade(player1Name, 'Trade completion failed')
      return "Trade failed due to an error."
    }
  }

  // Cancel trade
  cancelTrade(playerName, reason = 'Trade cancelled') {
    const tradeId = this.playerTrades.get(playerName)
    if (!tradeId) return false

    const trade = this.activeTrades.get(tradeId)
    if (!trade) return false

    // Clear timeout
    if (trade.timeoutId) {
      clearTimeout(trade.timeoutId)
    }

    // Notify both players
    for (const pName of trade.players) {
      this.sendToPlayer(pName, `Trade cancelled: ${reason}`)
      this.playerTrades.delete(pName)
    }

    this.activeTrades.delete(tradeId)
    return true
  }

  // Show trade status
  showTrade(player) {
    const trade = this.getPlayerTrade(player.name)
    if (!trade) {
      return "You are not in a trade."
    }

    const otherPlayerName = trade.players.find(name => name !== player.name)
    const playerOffer = trade.offers[player.name]
    const otherOffer = trade.offers[otherPlayerName]

    let result = `\n=== Trade with ${otherPlayerName} ===\n`
    
    // Show player's offer
    result += `\nYour offer:\n`
    if (playerOffer.items.length === 0 && playerOffer.gold === 0) {
      result += `• Nothing offered\n`
    } else {
      for (const item of playerOffer.items) {
        const itemData = this.getItemData(item.id)
        const itemName = itemData?.name || item.id
        result += `• ${itemName}${item.quantity > 1 ? ` x${item.quantity}` : ''}\n`
      }
      if (playerOffer.gold > 0) {
        result += `• Gold: ${playerOffer.gold}\n`
      }
    }

    // Show other player's offer
    result += `\n${otherPlayerName}'s offer:\n`
    if (otherOffer.items.length === 0 && otherOffer.gold === 0) {
      result += `• Nothing offered\n`
    } else {
      for (const item of otherOffer.items) {
        const itemData = this.getItemData(item.id)
        const itemName = itemData?.name || item.id
        result += `• ${itemName}${item.quantity > 1 ? ` x${item.quantity}` : ''}\n`
      }
      if (otherOffer.gold > 0) {
        result += `• Gold: ${otherOffer.gold}\n`
      }
    }

    // Show acceptance status
    result += `\nStatus:\n`
    result += `• ${player.name}: ${playerOffer.accepted ? 'Accepted' : 'Not accepted'}\n`
    result += `• ${otherPlayerName}: ${otherOffer.accepted ? 'Accepted' : 'Not accepted'}\n`

    if (playerOffer.accepted && otherOffer.accepted) {
      result += `\nTrade will complete automatically.`
    } else if (!playerOffer.accepted) {
      result += `\nType 'trade accept' when ready to complete the trade.`
    } else {
      result += `\nWaiting for ${otherPlayerName} to accept.`
    }

    return result
  }

  // Handle player disconnect
  handlePlayerDisconnect(playerName) {
    if (this.playerTrades.has(playerName)) {
      this.cancelTrade(playerName, 'Player disconnected')
    }
  }

  // Cancel trade if player is active (for movement/combat)
  cancelTradeIfActive(playerName, reason = 'Action cancelled trade') {
    if (this.playerTrades.has(playerName)) {
      this.cancelTrade(playerName, reason)
      return true
    }
    return false
  }

  // Helper methods
  getPlayerByName(playerName) {
    const targetName = playerName.toLowerCase()
    
    // Get live player list from session manager
    const players = this.sessionManager.getActivePlayers()
    const playerList = players instanceof Map ? 
      Array.from(players.values()) : 
      Object.values(players)
    
    return playerList.find(p => 
      p && p.name && p.name.toLowerCase() === targetName
    )
  }

  getItemData(itemId) {
    // This will be set by CommandManager when TradeManager is created
    return this.worldManager?.templateManager?.getItem(itemId)
  }

  sendToPlayer(playerName, message) {
    const socket = global.getPlayerSocket(playerName)
    if (socket) {
      socket.emit('output', message)
    }
  }

  notifyTradePlayers(trade, message) {
    for (const playerName of trade.players) {
      this.sendToPlayer(playerName, message)
    }
  }

  resetAcceptanceStatus(trade) {
    for (const playerName of trade.players) {
      trade.offers[playerName].accepted = false
    }
  }

  validateTradeCompletion(player1, player2, offer1, offer2) {
    // Simple validation - in a real implementation, you'd check inventory space
    // For now, assume unlimited inventory space
    return true
  }

  executeItemTransfer(player1, player2, offer1, offer2) {
    // Transfer items from player1 to player2
    for (const offeredItem of offer1.items) {
      player1.removeItem(offeredItem.id, offeredItem.quantity)
      player2.addItem(offeredItem.id, offeredItem.quantity)
    }

    // Transfer items from player2 to player1
    for (const offeredItem of offer2.items) {
      player2.removeItem(offeredItem.id, offeredItem.quantity)
      player1.addItem(offeredItem.id, offeredItem.quantity)
    }

    // Transfer gold
    if (offer1.gold > 0) {
      player1.gold -= offer1.gold
      player2.gold += offer1.gold
    }

    if (offer2.gold > 0) {
      player2.gold -= offer2.gold
      player1.gold += offer2.gold
    }
  }

  generateCompletionMessage(player1Name, player2Name, offer1, offer2) {
    const generateReceivedMessage = (playerName, offer) => {
      if (offer.items.length === 0 && offer.gold === 0) {
        return 'Nothing'
      }

      const parts = []
      for (const item of offer.items) {
        const itemData = this.getItemData(item.id)
        const itemName = itemData?.name || item.id
        parts.push(`${itemName}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
      }
      if (offer.gold > 0) {
        parts.push(`${offer.gold} gold`)
      }
      return parts.join(', ')
    }

    const player1Received = generateReceivedMessage(player2Name, offer2)
    const player2Received = generateReceivedMessage(player1Name, offer1)

    return {
      player1: `You received: ${player1Received}\nTrade completed!`,
      player2: `You received: ${player2Received}\nTrade completed!`
    }
  }

  // Set world manager reference (called by CommandManager)
  setWorldManager(worldManager) {
    this.worldManager = worldManager
  }
}

export default TradeManager