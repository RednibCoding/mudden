class BaseCommand {
  constructor(gameWorld, players, combatSessions, io, commandManager = null) {
    this.gameWorld = gameWorld
    this.players = players
    this.combatSessions = combatSessions
    this.io = io
    this.commandManager = commandManager
  }
  
  // Helper method to send message to a specific player
  sendToPlayer(playerName, message) {
    if (global.getPlayerSocket) {
      const socket = global.getPlayerSocket(playerName)
      if (socket) {
        socket.emit('output', message)
      }
    }
  }
  
  // Helper method to send message to all players in a specific area/room
  sendToRoom(areaId, roomId, message, excludePlayer = null) {
    for (const [socketId, player] of this.players) {
      if (player && 
          player.currentArea === areaId && 
          player.currentRoom === roomId &&
          player.name !== excludePlayer) {
        const socket = this.getPlayerSocket(player.name)
        if (socket) {
          socket.emit('output', message)
        }
      }
    }
  }

  // Helper method to send message to specific players only
  sendToPlayers(playerNames, message) {
    for (const playerName of playerNames) {
      const socket = this.getPlayerSocket(playerName)
      if (socket) {
        socket.emit('output', message)
      }
    }
  }

  // Helper method to get player socket
  getPlayerSocket(playerName) {
    if (global.getPlayerSocket) {
      return global.getPlayerSocket(playerName)
    }
    return null
  }

  // Fuzzy matching utility functions
  calculateMatchScore(target, search) {
    const targetLower = target.toLowerCase()
    const searchLower = search.toLowerCase()
    
    // Exact match gets highest score
    if (targetLower === searchLower) return 100
    
    // Check if target contains the search term
    if (targetLower.includes(searchLower)) return 80
    
    // Check if target starts with search term
    if (targetLower.startsWith(searchLower)) return 90
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(targetLower, searchLower)
    const maxLength = Math.max(targetLower.length, searchLower.length)
    const similarity = 1 - (distance / maxLength)
    
    // Only consider it a match if similarity is above threshold
    return similarity > 0.6 ? similarity * 70 : 0
  }

  levenshteinDistance(str1, str2) {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  findBestMatch(items, searchTerm) {
    let bestMatch = null
    let bestScore = 0
    
    for (const item of items) {
      const score = this.calculateMatchScore(item.name, searchTerm)
      if (score > bestScore) {
        bestScore = score
        bestMatch = item
      }
    }
    
    return bestMatch
  }

  // Helper method to find players by name (case-insensitive)
  findPlayerByName(name) {
    const targetName = name.toLowerCase()
    
    // Handle both Map and Object structures for players
    const playerList = this.players instanceof Map ? 
      Array.from(this.players.values()) : 
      Object.values(this.players)
    
    return playerList.find(p => 
      p && p.name && p.name.toLowerCase() === targetName
    )
  }

  // Helper method to get current room
  getCurrentRoom(player) {
    return this.gameWorld.getRoom(player.currentArea, player.currentRoom, player)
  }

  // Helper method to get players in same room
  getPlayersInRoom(areaId, roomId, excludePlayer = null) {
    // Handle both Map and Object structures for players
    const playerList = this.players instanceof Map ? 
      Array.from(this.players.values()) : 
      Object.values(this.players)
    
    return playerList.filter(p => 
      p.currentArea === areaId && p.currentRoom === roomId && p !== excludePlayer
    )
  }

  // Helper method to get players in same area
  getPlayersInArea(areaId, excludePlayer = null) {
    const playerList = this.players instanceof Map ? 
      Array.from(this.players.values()) : 
      Object.values(this.players)
    
    return playerList.filter(p => 
      p.currentArea === areaId && p !== excludePlayer
    )
  }

  // Helper method to get all players
  getAllPlayers(excludePlayer = null) {
    const playerList = this.players instanceof Map ? 
      Array.from(this.players.values()) : 
      Object.values(this.players)
    
    return playerList.filter(p => p !== excludePlayer)
  }

  // Quest progression helper (delegates to QuestCommands)
  updateQuestProgress(player, type, target, quantity = 1) {
    // Find QuestCommands instance
    const questSystem = this.gameWorld.questSystem
    if (questSystem) {
      return questSystem.updateQuestProgress(player, type, target, quantity)
    }
    return false
  }


}

export default BaseCommand