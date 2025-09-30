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
    const totalStats = player.getTotalStats(this.gameWorld)
    if (totalStats) {
      result += `\nStats:\n`
      result += `  Strength: ${totalStats.strength || 0}`
      if (totalStats.strength !== player.stats.strength) {
        result += ` (${player.stats.strength} + ${totalStats.strength - player.stats.strength} from equipment)`
      }
      result += `\n`
      result += `  Defense: ${totalStats.defense || 0}`
      if (totalStats.defense !== player.stats.defense) {
        result += ` (${player.stats.defense} + ${totalStats.defense - player.stats.defense} from equipment)`
      }
      result += `\n`
      result += `  Speed: ${totalStats.speed || 0}`
      if (totalStats.speed !== player.stats.speed) {
        result += ` (${player.stats.speed} + ${totalStats.speed - player.stats.speed} from equipment)`
      }
      result += `\n`
    }
    
    // Show equipped items
    if (player.equipment && Object.keys(player.equipment).length > 0) {
      result += `\nEquipped Items:\n`
      for (const [slot, itemId] of Object.entries(player.equipment)) {
        if (itemId) {
          const itemTemplate = this.gameWorld.getItem(itemId)
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
    
    // First check room content (enemies, NPCs, items) before inventory
    const room = this.getCurrentRoom(player)
    if (room) {
      // Check enemies first (most likely what player wants to examine)
      if (room.enemies) {
        const enemy = this.findBestMatch(room.enemies, target)
        if (enemy) {
          let result = `\n=== ${enemy.name} (Enemy) ===\n`
          result += `${enemy.description}\n`
          
          // Show current health from shared instance (or template if no shared instance)
          const currentHealth = enemy.currentHealth !== undefined ? enemy.currentHealth : (enemy.stats?.health || enemy.health || 30)
          const maxHealth = enemy.maxHealth || enemy.stats?.health || 30
          
          result += `Health: ${currentHealth}/${maxHealth}\n`
          
          // Check if enemy is currently in combat
          if (this.commandManager) {
            const combatCommands = this.commandManager.getCommandInstance('CombatCommands')
            if (combatCommands) {
              const combatStatus = combatCommands.getEnemyCombatStatus(
                player.currentArea, 
                player.currentRoom, 
                enemy.id
              )
              
              if (combatStatus.inCombat) {
                result += `Combat Status: Fighting ${combatStatus.player}\n`
              }
            }
          }
          
          // Show enemy stats for tactical information
          if (enemy.stats) {
            if (enemy.stats.strength) {
              result += `Strength: ${enemy.stats.strength}\n`
            }
            if (enemy.stats.defense) {
              result += `Defense: ${enemy.stats.defense}\n`
            }
          }
          
          return result
        }
      }
      
      // Check NPCs
      if (room.npcs) {
        const npc = this.findBestMatch(room.npcs, target)
        if (npc) {
          let result = `\n=== ${npc.name} (NPC) ===\n`
          result += `${npc.description}\n`
          return result
        }
      }
      
      // Check room items
      if (room.items) {
        const roomItem = this.findBestMatch(room.items, target)
        if (roomItem) {
          let result = `\n=== ${roomItem.name} (Room Item) ===\n`
          result += `${roomItem.description}\n`
          return result
        }
      }
    }
    
    // Then check inventory items - need custom logic since inventory stores {id, quantity}
    let bestInventoryMatch = null
    let bestInventoryScore = 0
    
    for (const inventoryItem of player.inventory) {
      const itemTemplate = this.gameWorld.getItem(inventoryItem.id)
      if (itemTemplate) {
        const score = this.calculateMatchScore(itemTemplate.name, target)
        if (score > bestInventoryScore && score >= 60) {
          bestInventoryScore = score
          bestInventoryMatch = { inventoryItem, itemTemplate }
        }
      }
    }
    
    if (bestInventoryMatch) {
      const { itemTemplate } = bestInventoryMatch
      let result = `\n=== ${itemTemplate.name} (Inventory) ===\n`
      result += `${itemTemplate.description}\n`
        
      if (itemTemplate.type) {
        result += `Type: ${itemTemplate.type}\n`
      }
      
      if (itemTemplate.stats && Object.keys(itemTemplate.stats).length > 0) {
        result += `Stats:\n`
        for (const [stat, value] of Object.entries(itemTemplate.stats)) {
          result += `  ${stat}: ${value}\n`
        }
      }
      
      if (itemTemplate.effects && Object.keys(itemTemplate.effects).length > 0) {
        result += `Effects:\n`
        for (const [effect, value] of Object.entries(itemTemplate.effects)) {
          result += `  ${effect}: +${value}\n`
        }
      }
      
      if (itemTemplate.value) {
        result += `Value: ${itemTemplate.value} gold\n`
      }
      
      return result
    }
    

    

    
    return `You don't see "${args.join(' ')}" here.`
  }
  
  lookAtPlayer(player, playerName) {
    if (!playerName || playerName.trim() === '') {
      return "Usage: look player <name> or look p <name>"
    }
    
    // Find player in the same room
    const playersInRoom = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    const targetPlayer = this.findBestMatch(playersInRoom.map(p => ({name: p.name, ...p})), playerName)
    
    if (!targetPlayer) {
      // Format name with proper case for error message
      const formattedName = playerName.charAt(0).toUpperCase() + playerName.slice(1).toLowerCase()
      return `Player ${formattedName} is not in this room.`
    }
    
    // Show player stats (similar to stats command but for other players)
    let result = `\n=== ${targetPlayer.name}'s Stats ===\n`
    result += `Level: ${targetPlayer.level}\n`
    result += `Health: ${targetPlayer.health}/${targetPlayer.maxHealth}\n`
    
    // Show player stats (including equipment bonuses)
    let totalStats = null
    if (typeof targetPlayer.getTotalStats === 'function') {
      totalStats = targetPlayer.getTotalStats(this.gameWorld)
    } else {
      // Fallback to base stats if method doesn't exist
      totalStats = targetPlayer.stats
    }
    
    if (totalStats) {
      result += `\nStats:\n`
      result += `  Strength: ${totalStats.strength || 0}`
      if (totalStats.strength !== targetPlayer.stats.strength) {
        result += ` (${targetPlayer.stats.strength} + ${totalStats.strength - targetPlayer.stats.strength} from equipment)`
      }
      result += `\n`
      result += `  Defense: ${totalStats.defense || 0}`
      if (totalStats.defense !== targetPlayer.stats.defense) {
        result += ` (${targetPlayer.stats.defense} + ${totalStats.defense - targetPlayer.stats.defense} from equipment)`
      }
      result += `\n`
      result += `  Speed: ${totalStats.speed || 0}`
      if (totalStats.speed !== targetPlayer.stats.speed) {
        result += ` (${targetPlayer.stats.speed} + ${totalStats.speed - targetPlayer.stats.speed} from equipment)`
      }
      result += `\n`
    }
    
    // Show equipped items
    if (targetPlayer.equipment && Object.keys(targetPlayer.equipment).length > 0) {
      result += `\nEquipped Items:\n`
      for (const [slot, itemId] of Object.entries(targetPlayer.equipment)) {
        if (itemId) {
          const itemTemplate = this.gameWorld.getItem(itemId)
          const itemName = itemTemplate ? itemTemplate.name : itemId
          result += `  ${slot}: ${itemName}\n`
        } else {
          result += `  ${slot}: none\n`
        }
      }
    }
    
    // Show combat status if in combat
    if (targetPlayer.inCombat) {
      result += `\nCombat Status: In Combat\n`
    }
    
    return result
  }
  
  lookAtRoom(player) {
    const room = this.getCurrentRoom(player)
    if (!room) {
      return "You are in a void."
    }

    // Update quest progress for visit objectives when looking at room
    this.updateQuestProgress(player, OBJECTIVE_TYPES.VISIT, player.currentRoom)

    let result = `\n=== ${room.name} (Room) ===\n`
    result += `${room.description}\n`

    // Show exits
    if (room.exits && Object.keys(room.exits).length > 0) {
      result += `\nExits: ${Object.keys(room.exits).join(', ')}\n`
    }

    // Show items in room
    if (room.items && room.items.length > 0) {
      result += `\nItems here:\n`
      room.items.forEach(item => {
        result += `• ${item.name}\n`
      })
    }

    // Show people in room (NPCs and players combined)
    const otherPlayers = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    
    const hasNPCs = room.npcs && room.npcs.length > 0
    const hasPlayers = otherPlayers.length > 0
    
    if (hasNPCs || hasPlayers) {
      result += `\nPeople here:\n`
      
      const peopleList = []
      
      // Add NPCs first
      if (hasNPCs) {
        room.npcs.forEach(npc => {
          peopleList.push(npc.name)
        })
      }
      
      // Add players after NPCs
      if (hasPlayers) {
        otherPlayers.forEach(p => {
          peopleList.push(p.name)
        })
      }
      
      result += `• ${peopleList.join(', ')}\n`
    }

    // Show enemies in room
    if (room.enemies && room.enemies.length > 0) {
      result += `\nEnemies here:\n`
      room.enemies.forEach(enemy => {
        const currentHealth = enemy.currentHealth !== undefined ? enemy.currentHealth : (enemy.stats?.health || enemy.health || 30)
        const maxHealth = enemy.maxHealth || enemy.stats?.health || 30
        const healthPercent = Math.floor((currentHealth / maxHealth) * 100)
        
        let healthStatus = ''
        if (healthPercent <= 0) {
          healthStatus = ' (dead)'
        } else if (healthPercent < 25) {
          healthStatus = ' (critically wounded)'
        } else if (healthPercent < 50) {
          healthStatus = ' (badly wounded)'
        } else if (healthPercent < 75) {
          healthStatus = ' (wounded)'
        } else if (healthPercent < 100) {
          healthStatus = ' (slightly wounded)'
        }
        
        // Check if anyone is fighting this enemy
        if (this.commandManager) {
          const combatCommands = this.commandManager.getCommandInstance('CombatCommands')
          if (combatCommands) {
            const fightersInRoom = []
            // Check all combat sessions for this enemy
            for (const [playerName, combatSession] of Object.entries(combatCommands.combatSessions)) {
              if (combatSession.defender.type === 'enemy' && 
                  combatSession.defender.enemyId === enemy.id &&
                  combatSession.attacker.data.currentArea === player.currentArea &&
                  combatSession.attacker.data.currentRoom === player.currentRoom) {
                fightersInRoom.push(playerName)
              }
            }
            
            if (fightersInRoom.length > 0) {
              healthStatus += ` (fighting: ${fightersInRoom.join(', ')})`
            }
          }
        }
        
        result += `• ${enemy.name}${healthStatus}\n`
      })
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

QUESTS:
  quest list              - Show your quest journal
  quest info [name]       - Show detailed quest information
  quest accept [name]     - Accept an available quest
  quest abandon [name]    - Abandon an active quest
  quest complete [name]   - Complete and turn in a finished quest
  q [action]              - Short alias for quest commands

INFO:
  stats                   - Show your character stats
  health                  - Show current health
  help                    - Show this help

SYSTEM:
  save                    - Save your character
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