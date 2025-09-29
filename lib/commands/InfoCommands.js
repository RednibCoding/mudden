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

    const target = args.join(' ').toLowerCase()
    
    // First check inventory items - need custom logic since inventory stores {id, quantity}
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
      let result = `\n=== ${itemTemplate.name} ===\n`
      result += `${itemTemplate.description}\n`
        
      if (itemTemplate.type) {
        result += `Type: ${itemTemplate.type}\n`
      }
      
      if (itemTemplate.stats) {
        result += `Stats:\n`
        for (const [stat, value] of Object.entries(itemTemplate.stats)) {
          result += `  ${stat}: ${value}\n`
        }
      }
      
      if (itemTemplate.effects) {
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
    
    // Check quest reward items if viewing quest info
    const questRewards = this.getCtxState(player, 'viewingQuestRewards')
    if (questRewards && questRewards.length > 0) {
      let bestRewardMatch = null
      let bestRewardScore = 0
      
      for (const itemId of questRewards) {
        const itemTemplate = this.gameWorld.getItem(itemId)
        if (itemTemplate) {
          const score = this.calculateMatchScore(itemTemplate.name, target)
          if (score > bestRewardScore && score >= 60) {
            bestRewardScore = score
            bestRewardMatch = itemTemplate
          }
        }
      }
      
      if (bestRewardMatch) {
        let result = `\n=== ${bestRewardMatch.name} (Quest Reward) ===\n`
        result += `${bestRewardMatch.description}\n`
          
        if (bestRewardMatch.type) {
          result += `Type: ${bestRewardMatch.type}\n`
        }
        
        if (bestRewardMatch.stats) {
          result += `Stats:\n`
          for (const [stat, value] of Object.entries(bestRewardMatch.stats)) {
            result += `  ${stat}: ${value}\n`
          }
        }
        
        if (bestRewardMatch.effects) {
          result += `Effects:\n`
          for (const [effect, value] of Object.entries(bestRewardMatch.effects)) {
            result += `  ${effect}: +${value}\n`
          }
        }
        
        if (bestRewardMatch.value) {
          result += `Value: ${bestRewardMatch.value} gold\n`
        }
        
        return result
      }
    }
    
    // Then check room items and NPCs
    const room = this.getCurrentRoom(player)
    if (room) {
      // Check room items
      if (room.items) {
        const roomItem = this.findBestMatch(room.items, target)
        if (roomItem) {
          let result = `\n=== ${roomItem.name} ===\n`
          result += `${roomItem.description}\n`
          return result
        }
      }
      
      // Check NPCs
      if (room.npcs) {
        const npc = this.findBestMatch(room.npcs, target)
        if (npc) {
          let result = `\n=== ${npc.name} ===\n`
          result += `${npc.description}\n`
          return result
        }
      }
    }
    
    return `You don't see "${args.join(' ')}" here.`
  }
  
  lookAtRoom(player) {
    const room = this.getCurrentRoom(player)
    if (!room) {
      return "You are in a void."
    }

    // Update quest progress for visit objectives when looking at room
    this.updateQuestProgress(player, OBJECTIVE_TYPES.VISIT, player.currentRoom)

    let result = `\n=== ${room.name} ===\n`
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

    // Show NPCs in room
    if (room.npcs && room.npcs.length > 0) {
      result += `\nPeople here:\n`
      room.npcs.forEach(npc => {
        result += `• ${npc.name}\n`
      })
    }

    // Show enemies in room
    if (room.enemies && room.enemies.length > 0) {
      result += `\nEnemies here:\n`
      room.enemies.forEach(enemy => {
        result += `• ${enemy.name}\n`
      })
    }

    // Show other players in room
    const otherPlayers = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    if (otherPlayers.length > 0) {
      result += `\nOther players here:\n`
      otherPlayers.forEach(p => {
        result += `• ${p.name}\n`
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
  tell [player] [message] - Send private message
  talk [npc]              - Talk to an NPC
  ask [npc] about [topic] - Ask NPC about a specific topic

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