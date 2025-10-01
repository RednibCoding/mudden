import BaseCommand from './BaseCommand.js'
import { OBJECTIVE_TYPES } from '../constants/QuestConstants.js'

class MovementCommands extends BaseCommand {
  getCommands() {
    return {
      // Movement
      'go': this.go.bind(this),
      'north': (player, args) => this.go(player, ['north']),
      'south': (player, args) => this.go(player, ['south']),
      'east': (player, args) => this.go(player, ['east']),
      'west': (player, args) => this.go(player, ['west']),
      'n': (player, args) => this.go(player, ['north']),
      's': (player, args) => this.go(player, ['south']),
      'e': (player, args) => this.go(player, ['east']),
      'w': (player, args) => this.go(player, ['west'])
    }
  }

  getRoomDescription(player) {
    const room = this.getCurrentRoom(player)
    if (!room) {
      return "You are in a void."
    }

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
        result += `• ${npc.name}`
      })
    }

    // Show other players in room
    const otherPlayers = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    if (otherPlayers.length > 0) {
      otherPlayers.forEach(p => {
        result += `, ${p.name}`
      })
      result += `\n`
    } else {
      result += `\n`
    }

    // Show enemies in room
    if (room.enemies && room.enemies.length > 0) {
      result += `\nEnemies here:\n`
      room.enemies.forEach(enemy => {
        result += `• ${enemy.name}\n`
      })
    }

    return result
  }

  go(player, args) {
    if (args.length === 0) {
      return "Go where?"
    }

    const direction = args[0].toLowerCase()
    const currentRoom = this.getCurrentRoom(player)
    
    if (!currentRoom.exits || !currentRoom.exits[direction]) {
      return `You can't go ${direction} from here.`
    }

    const exitDestination = currentRoom.exits[direction]
    
    // Parse "area.room" format
    const [targetArea, targetRoom] = exitDestination.split('.')
    const targetRoomData = this.worldManager.getRoom(targetArea, targetRoom)
    
    if (!targetRoomData) {
      return "That exit leads nowhere!"
    }

    // Check if player is in combat
    if (player.inCombat || this.combatSessions[player.name]) {
      return "You can't leave while in combat! Use 'flee' to escape."
    }

    const previousArea = player.currentArea
    const previousRoom = player.currentRoom

    player.currentArea = targetArea
    player.currentRoom = targetRoom
    
    // Handle trade cleanup on movement
    if (this.commandManager) {
      this.commandManager.handlePlayerActionCleanup(player.name, 'moved')
    }
    
    // Update quest progress for visit objectives
    this.updateQuestProgress(player, OBJECTIVE_TYPES.VISIT, targetRoom)
    
    player.save()
    
    // Check for unused enemy instances in the previous room
    if (this.commandManager) {
      const combatCommands = this.commandManager.getCommandInstance('CombatCommands')
      if (combatCommands) {
        // Use a small delay to ensure player state is updated
        setTimeout(() => {
          // Get all enemies in the previous room and clean up unused instances
          const area = this.worldManager.templateManager.getArea(previousArea)
          if (area && area.rooms[previousRoom] && area.rooms[previousRoom].enemies) {
            area.rooms[previousRoom].enemies.forEach(enemyConfig => {
              if (typeof enemyConfig === 'object' && enemyConfig.id) {
                combatCommands.cleanupUnusedEnemyInstance(previousArea, previousRoom, enemyConfig.id)
              }
            })
          }
        }, 100)
      }
    }
    
    return `You go ${direction}.\n\n${this.getRoomDescription(player)}`
  }
}

export default MovementCommands