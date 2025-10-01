import BaseCommand from './BaseCommand.js'
import { OBJECTIVE_TYPES } from '../constants/QuestConstants.js'

class InfoCommands extends BaseCommand {
  getCommands() {
    return {
      // Information
      'stats': this.stats.bind(this),
      'health': this.health.bind(this),
      'help': this.help.bind(this),
      'commands': this.help.bind(this),
      'look': this.look.bind(this),
      'l': this.look.bind(this),
      'examine': this.look.bind(this),
      'ex': this.look.bind(this)
    }
  }

  stats(player) {
    let result = `\n=== ${player.name}'s Stats ===\n`
    result += `Level: ${player.level}\n`
    result += `Health: ${player.health}/${player.maxHealth}\n`
    
    // Calculate experience for next level using exponential progression
    const currentExp = player.experience || 0
    const nextLevelExp = player.getExpForLevel(player.level + 1)
    result += `Experience: ${currentExp}/${nextLevelExp}\n`
    
    result += `Location: ${this.getCurrentRoom(player)?.name || 'Unknown'}\n`
    
    // Show player stats (including equipment bonuses)
    result += this.formatPlayerStats(player)
    
    // Show equipped items
    if (player.equipment && Object.keys(player.equipment).length > 0) {
      result += `\nEquipped Items:\n`
      for (const [slot, itemId] of Object.entries(player.equipment)) {
        if (itemId) {
          const itemTemplate = this.worldManager.templateManager.getItem(itemId)
          const itemName = itemTemplate ? itemTemplate.name : itemId
          result += `  ${slot}: ${itemName}\n`
        } else {
          result += `  ${slot}: none\n`
        }
      }
    }
    
    return result
  }

  look(player, args) {
    // If no arguments, look at the room
    if (args.length === 0) {
      return this.lookAtRoom(player)
    }

    // Handle look player <name> or look p <name>
    if (args.length >= 2 && (args[0].toLowerCase() === 'player' || args[0].toLowerCase() === 'p')) {
      const playerName = args.slice(1).join(' ')
      return this.lookAtPlayer(player, playerName)
    }

    const target = args.join(' ').toLowerCase()
    
    // Try different look targets in priority order
    return this.lookAtEnemy(player, target) ||
           this.lookAtNPC(player, target) ||
           this.lookAtRoomItem(player, target) ||
           this.lookAtInventoryItem(player, target) ||
           `You don't see "${args.join(' ')}" here.`
  }

  // Focused look methods for better organization
  lookAtEnemy(player, target) {
    const room = this.getCurrentRoom(player)
    if (!room?.enemies) return null
    
    const enemy = this.findBestMatch(room.enemies, target)
    if (!enemy) return null
    
    return this.formatEnemyDisplay(player, enemy)
  }

  lookAtNPC(player, target) {
    const room = this.getCurrentRoom(player)
    if (!room?.npcs) return null
    
    const npc = this.findBestMatch(room.npcs, target)
    if (!npc) return null
    
    return this.formatNPCDisplay(npc)
  }

  lookAtRoomItem(player, target) {
    const room = this.getCurrentRoom(player)
    if (!room?.items) return null
    
    const roomItem = this.findBestMatch(room.items, target)
    if (!roomItem) return null
    
    return this.formatRoomItemDisplay(roomItem)
  }

  lookAtInventoryItem(player, target) {
    let bestMatch = null
    let bestScore = 0
    
    for (const inventoryItem of player.inventory) {
      const itemTemplate = this.worldManager.templateManager.getItem(inventoryItem.id)
      if (itemTemplate) {
        const score = this.calculateMatchScore(itemTemplate.name, target)
        if (score > bestScore && score >= 60) {
          bestScore = score
          bestMatch = { inventoryItem, itemTemplate }
        }
      }
    }
    
    if (!bestMatch) return null
    return this.formatInventoryItemDisplay(bestMatch.itemTemplate)
  }
  
  lookAtPlayer(player, playerName) {
    if (!playerName?.trim()) return "Usage: look player <name> or look p <name>"
    
    const playersInRoom = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    const targetPlayer = this.findBestMatch(playersInRoom.map(p => ({name: p.name, ...p})), playerName)
    
    if (!targetPlayer) {
      const formattedName = playerName.charAt(0).toUpperCase() + playerName.slice(1).toLowerCase()
      return `Player ${formattedName} is not in this room.`
    }
    
    return this.formatOtherPlayerDisplay(targetPlayer)
  }
  
  lookAtRoom(player) {
    const room = this.getCurrentRoom(player)
    if (!room) return "You are in a void."

    // Update quest progress for visit objectives when looking at room
    this.updateQuestProgress(player, OBJECTIVE_TYPES.VISIT, player.currentRoom)

    let result = `\n=== ${room.name} (Room) ===\n${room.description}\n`
    
    result += this.formatRoomExits(room)
    result += this.formatRoomItems(room)
    result += this.formatRoomPeople(player, room)
    result += this.formatRoomEnemies(player, room)

    return result
  }

  // Formatting utilities for consistent display
  formatEnemyDisplay(player, enemy) {
    let result = `\n=== ${enemy.name} (Enemy) ===\n`
    result += `${enemy.description}\n`
    
    // Health information
    const currentHealth = enemy.currentHealth !== undefined ? enemy.currentHealth : (enemy.stats?.health || enemy.health || 30)
    const maxHealth = enemy.maxHealth || enemy.stats?.health || 30
    result += `Health: ${currentHealth}/${maxHealth}\n`
    
    // Combat status
    result += this.formatEnemyCombatStatus(player, enemy)
    
    // Stats display
    result += this.formatEnemyStats(enemy)
    
    return result
  }

  formatEnemyCombatStatus(player, enemy) {
    const fighters = this.getEnemyFighters(player, enemy)
    return fighters.length > 0 ? `Combat Status: Fighting ${fighters.join(', ')}\n` : ''
  }

  formatEnemyStats(enemy) {
    if (!enemy.stats) return ''
    
    let result = ''
    if (enemy.stats.strength) result += `Strength: ${enemy.stats.strength}\n`
    if (enemy.stats.defense) result += `Defense: ${enemy.stats.defense}\n`
    
    return result
  }

  formatNPCDisplay(npc) {
    return `\n=== ${npc.name} (NPC) ===\n${npc.description}\n`
  }

  formatRoomItemDisplay(roomItem) {
    return `\n=== ${roomItem.name} (Room Item) ===\n${roomItem.description}\n`
  }

  formatInventoryItemDisplay(itemTemplate) {
    let result = `\n=== ${itemTemplate.name} (Inventory) ===\n`
    result += `${itemTemplate.description}\n`
    
    if (itemTemplate.type) result += `Type: ${itemTemplate.type}\n`
    
    result += this.formatItemStats(itemTemplate)
    result += this.formatItemEffects(itemTemplate)
    
    if (itemTemplate.value) result += `Value: ${itemTemplate.value} gold\n`
    
    return result
  }

  formatItemStats(itemTemplate) {
    if (!itemTemplate.stats || Object.keys(itemTemplate.stats).length === 0) return ''
    
    let result = `Stats:\n`
    for (const [stat, value] of Object.entries(itemTemplate.stats)) {
      result += `  ${stat}: ${value}\n`
    }
    return result
  }

  formatItemEffects(itemTemplate) {
    if (!itemTemplate.effects || Object.keys(itemTemplate.effects).length === 0) return ''
    
    let result = `Effects:\n`
    for (const [effect, value] of Object.entries(itemTemplate.effects)) {
      result += `  ${effect}: +${value}\n`
    }
    return result
  }

  formatPlayerStats(player, includeEquipmentBreakdown = true) {
    const totalStats = player.getTotalStats(this.worldManager)
    if (!totalStats) return ''
    
    let result = `\nStats:\n`
    
    const statNames = ['strength', 'defense', 'speed']
    for (const stat of statNames) {
      result += `  ${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${totalStats[stat] || 0}`
      
      if (includeEquipmentBreakdown && totalStats[stat] !== player.stats[stat]) {
        const equipmentBonus = totalStats[stat] - player.stats[stat]
        result += ` (${player.stats[stat]} + ${equipmentBonus} from equipment)`
      }
      
      result += `\n`
    }
    
    return result
  }

  // Room formatting utilities
  formatRoomExits(room) {
    return room.exits && Object.keys(room.exits).length > 0
      ? `\nExits: ${Object.keys(room.exits).join(', ')}\n`
      : ''
  }

  formatRoomItems(room) {
    if (!room.items || room.items.length === 0) return ''
    
    let result = `\nItems here:\n`
    room.items.forEach(item => result += `• ${item.name}\n`)
    return result
  }

  formatRoomPeople(player, room) {
    const otherPlayers = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    const hasNPCs = room.npcs && room.npcs.length > 0
    const hasPlayers = otherPlayers.length > 0
    
    if (!hasNPCs && !hasPlayers) return ''
    
    const peopleList = []
    if (hasNPCs) room.npcs.forEach(npc => peopleList.push(npc.name))
    if (hasPlayers) otherPlayers.forEach(p => peopleList.push(p.name))
    
    return `\nPeople here:\n• ${peopleList.join(', ')}\n`
  }

  formatRoomEnemies(player, room) {
    if (!room.enemies || room.enemies.length === 0) return ''
    
    let result = `\nEnemies here:\n`
    room.enemies.forEach(enemy => {
      result += `• ${enemy.name}${this.getEnemyStatusText(player, enemy)}\n`
    })
    return result
  }

  getEnemyStatusText(player, enemy) {
    const currentHealth = enemy.currentHealth !== undefined ? enemy.currentHealth : (enemy.stats?.health || enemy.health || 30)
    const maxHealth = enemy.maxHealth || enemy.stats?.health || 30
    const healthPercent = Math.floor((currentHealth / maxHealth) * 100)
    
    let status = this.getHealthStatusText(healthPercent)
    
    // Add combat status
    const fighters = this.getEnemyFighters(player, enemy)
    if (fighters.length > 0) {
      status += ` (fighting: ${fighters.join(', ')})`
    }
    
    return status
  }

  getHealthStatusText(healthPercent) {
    if (healthPercent <= 0) return ' (dead)'
    if (healthPercent < 25) return ' (critically wounded)'
    if (healthPercent < 50) return ' (badly wounded)'
    if (healthPercent < 75) return ' (wounded)'
    if (healthPercent < 100) return ' (slightly wounded)'
    return ''
  }

  getEnemyFighters(player, enemy) {
    if (!this.commandManager?.combatManager) return []
    
    const combatManager = this.commandManager.combatManager
    const fighters = []
    
    // Check all active combat sessions for this enemy in this room
    for (const [playerName, combat] of combatManager.activeCombats) {
      if (combat.areaId === player.currentArea && 
          combat.roomId === player.currentRoom &&
          combat.enemies.some(e => e.id === enemy.id)) {
        fighters.push(playerName)
      }
    }
    
    return fighters
  }

  formatOtherPlayerDisplay(targetPlayer) {
    let result = `\n=== ${targetPlayer.name}'s Stats ===\n`
    result += `Level: ${targetPlayer.level}\n`
    result += `Health: ${targetPlayer.health}/${targetPlayer.maxHealth}\n`
    
    // Show stats with equipment bonuses
    const totalStats = typeof targetPlayer.getTotalStats === 'function'
      ? targetPlayer.getTotalStats(this.worldManager)
      : targetPlayer.stats
    
    if (totalStats) {
      const playerForFormatting = {
        stats: targetPlayer.stats,
        getTotalStats: () => totalStats
      }
      result += this.formatPlayerStats(playerForFormatting)
    }
    
    // Show equipment and combat status
    result += this.formatPlayerEquipment(targetPlayer)
    if (targetPlayer.inCombat) result += `\nCombat Status: In Combat\n`
    
    return result
  }

  formatPlayerEquipment(player) {
    if (!player.equipment || Object.keys(player.equipment).length === 0) return ''
    
    let result = `\nEquipped Items:\n`
    for (const [slot, itemId] of Object.entries(player.equipment)) {
      const itemTemplate = itemId ? this.worldManager.templateManager.getItem(itemId) : null
      const itemName = itemTemplate ? itemTemplate.name : (itemId || 'none')
      result += `  ${slot}: ${itemName}\n`
    }
    return result
  }

  health(player) {
    const healthPercent = Math.floor((player.health / player.maxHealth) * 100)
    let status = 'excellent'
    
    if (healthPercent < 25) status = 'critical'
    else if (healthPercent < 50) status = 'poor'
    else if (healthPercent < 75) status = 'fair'
    else if (healthPercent < 100) status = 'good'
    
    return `Your health is ${status}. (${player.health}/${player.maxHealth})`
  }

  help(player, args) {
    return `
=== MUD Commands Help ===

MOVEMENT:
  look, l                 - Look around the current room
  look player <name> / look p <name> - Look at another player's stats
  go [direction]          - Move in a direction
  north, south, east, west - Move in cardinal directions
  n, s, e, w              - Short movement commands

INVENTORY:
  inventory, inv, i       - Show your inventory
  take, get [item]        - Pick up an item
  drop [item]             - Drop an item (coming soon)
  use [item]              - Use/consume an item
  equip, wear [item]      - Equip a weapon or armor
  unequip, remove [item]  - Unequip an item

COMBAT:
  attack [enemy]          - Start combat or attack
  defend                  - Reduce incoming damage
  flee                    - Try to escape combat

SOCIAL:
  say [message]           - Say something to everyone in room
  tell <player> <message> - Send private message
  reply <message> / r <message> - Reply to last private message
  talk [npc]              - Talk to an NPC
  ask [npc] about [topic] - Ask NPC about a specific topic
  homestone               - Set your homestone (respawn point)

FRIENDS:
  friends list / friends / f - Show your friends list
  friends add <player> / f add <player> - Add a player to your friends list
  friends remove <player> / f remove <player> - Remove a player from friends list
  friends note <player> <message> / f note <player> <message> - Add a note about a friend (max 50 chars)

TRADING:
  trade <player>          - Start a trade with another player
  trade show              - Display current trade status
  trade offer <item> [qty] - Add item to your trade offer
  trade offer gold <amount> - Add gold to your trade offer
  trade remove <item>     - Remove item from your trade offer
  trade accept            - Accept the current trade terms
  trade cancel            - Cancel the current trade

QUESTS:
  quest / q               - Show your quest journal (same as quest list)
  quest list              - Show your quest journal
  quest info [name]       - Show detailed quest information
  quest accept [name]     - Accept an available quest
  quest abandon [name]    - Abandon an active quest
  quest complete [name]   - Complete and turn in a finished quest
  quest look <item> / q l <item> - Examine quest reward items from active quests
  q [action]              - Short alias for quest commands

INFO:
  stats                   - Show your character stats
  health                  - Show current health
  help                    - Show this help

SYSTEM:
  quit, exit              - Leave the game
  logout                  - Logout and login with different character
  password <new>          - Change your password

TIPS:
  • Commands use fuzzy matching - you can use partial names!
  • Most commands have short aliases (i for inventory, l for look, etc.)
  • Try different variations if a command doesn't work
    `
  }
}

export default InfoCommands