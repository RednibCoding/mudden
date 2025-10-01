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
    const { playerManager, worldManager, templateManager, movementManager } = managers
    
    // Use movement manager to handle the complete move workflow
    const result = movementManager.processMovePlayer(
      this.playerId,
      this.direction.toLowerCase(),
      playerManager,
      worldManager,
      templateManager
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: result.errorCode,
        direction: result.direction
      }))
      return updates
    }

    // Create success update with processed room data
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.ROOM_STATE_CHANGED, {
      location: result.location,
      name: result.room.name,
      description: result.room.description,
      exits: Object.keys(result.room.exits),
      items: result.room.items || [],
      itemNames: result.itemNames,
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
    const { playerManager, worldManager, templateManager, movementManager } = managers
    
    // Use movement manager to handle the complete look workflow
    const result = movementManager.processLookCommand(
      this.playerId,
      this.target,
      this.targetType,
      playerManager,
      worldManager,
      templateManager
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        target: result.target
      }))
      return updates
    }

    // Create success update with processed room data
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.ROOM_STATE_CHANGED, {
      location: result.location,
      name: result.room.name,
      description: result.room.description,
      exits: Object.keys(result.room.exits),
      items: result.room.items || [],
      itemNames: result.itemNames,
      npcs: result.room.npcs || [],
      players: result.playersInRoom
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new LookCommand(data.playerId, data.target, data.targetType, data.commandId)
  }
}