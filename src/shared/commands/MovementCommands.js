import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

/**
 * Move command - handles player movement between rooms
 */
export class MoveCommand extends BaseCommand {
  constructor(playerId, direction, commandId = null) {
    super(CommandTypes.MOVE, playerId, commandId)
    this.direction = direction
  }
  
  validate() {
    super.validate()
    
    const validDirections = ['north', 'south', 'east', 'west', 'up', 'down']
    if (!this.direction || !validDirections.includes(this.direction.toLowerCase())) {
      throw new Error(`Invalid direction: ${this.direction}. Valid directions: ${validDirections.join(', ')}`)
    }
    
    return true
  }
  
  getPayload() {
    return {
      direction: this.direction.toLowerCase()
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager, worldManager, templateManager } = managers
    
    // Use manager to attempt movement
    const result = playerManager.tryMovePlayer(this.playerId, this.direction.toLowerCase(), worldManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: ErrorCodes.NO_EXIT,
        direction: this.direction.toLowerCase()
      }))
      return updates
    }

    // Create item names mapping for room display
    const itemNames = {}
    if (result.room.items) {
      result.room.items.forEach(item => {
        const template = templateManager.getItem(item.id)
        itemNames[item.id] = template?.name || item.id
      })
    }
    
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.ROOM_STATE_CHANGED, {
      location: result.location,
      name: result.room.name,
      description: result.room.description,
      exits: Object.keys(result.room.exits),
      items: result.room.items || [],
      itemNames: itemNames,
      npcs: result.room.npcs || [],
      players: result.playersInRoom
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new MoveCommand(data.playerId, data.direction, data.commandId)
  }
}

/**
 * Look command - examine room, items, players, etc.
 */
export class LookCommand extends BaseCommand {
  constructor(playerId, target = null, targetType = 'room', commandId = null) {
    super(CommandTypes.LOOK, playerId, commandId)
    this.target = target
    this.targetType = targetType // 'room', 'item', 'player', 'npc'
  }
  
  validate() {
    super.validate()
    
    const validTargetTypes = ['room', 'item', 'player', 'npc']
    if (!validTargetTypes.includes(this.targetType)) {
      throw new Error(`Invalid target type: ${this.targetType}`)
    }
    
    // If targetType is not 'room', target is required
    if (this.targetType !== 'room' && !this.target) {
      throw new Error(`Target is required for ${this.targetType} look`)
    }
    
    return true
  }
  
  getPayload() {
    return {
      target: this.target,
      targetType: this.targetType
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager, templateManager } = managers
    
    // Use manager to get room info
    const roomInfo = playerManager.getPlayerRoomInfo(this.playerId, managers.worldManager)
    
    if (!roomInfo) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { errorCode: ErrorCodes.PLAYER_NOT_FOUND }))
      return updates
    }

    // Create item names mapping for room display
    const itemNames = {}
    if (roomInfo.room.items) {
      roomInfo.room.items.forEach(item => {
        const template = templateManager.getItem(item.id)
        itemNames[item.id] = template?.name || item.id
      })
    }
    
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.ROOM_STATE_CHANGED, {
      location: roomInfo.location,
      name: roomInfo.room.name,
      description: roomInfo.room.description,
      exits: Object.keys(roomInfo.room.exits),
      items: roomInfo.room.items || [],
      itemNames: itemNames,
      npcs: roomInfo.room.npcs || [],
      players: roomInfo.playersInRoom
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new LookCommand(data.playerId, data.target, data.targetType, data.commandId)
  }
}