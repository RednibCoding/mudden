import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

/**
 * Say command - broadcast message to all players in current room
 */
export class SayCommand extends BaseCommand {
  constructor(playerId, message, commandId = null) {
    super(CommandTypes.SAY, playerId, commandId)
    this.message = message
  }
  
  validate() {
    super.validate()
    
    if (!this.message || typeof this.message !== 'string') {
      throw new Error('message is required and must be a string')
    }
    
    if (this.message.trim().length === 0) {
      throw new Error('message cannot be empty')
    }
    
    return true
  }
  
  getPayload() {
    return {
      message: this.message
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager } = managers
    
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Get all players in the same room
    const playersInRoom = playerManager.getPlayersInRoom(player.location)
    
    // Send the message to all players in the room
    for (const roomPlayer of playersInRoom) {
      if (roomPlayer.id === this.playerId) {
        // Send confirmation to the speaker
        updates.push(new BaseUpdate(roomPlayer.id, UpdateTypes.SOCIAL_MESSAGE, {
          type: 'say_self',
          message: this.message,
          speaker: player.name
        }))
      } else {
        // Send message to other players
        updates.push(new BaseUpdate(roomPlayer.id, UpdateTypes.SOCIAL_MESSAGE, {
          type: 'say_other',
          message: this.message,
          speaker: player.name
        }))
      }
    }

    return updates
  }
  
  static fromJSON(data) {
    return new SayCommand(data.playerId, data.message, data.commandId)
  }
}

/**
 * Tell command - send private message to specific player
 */
export class TellCommand extends BaseCommand {
  constructor(playerId, targetPlayer, message, commandId = null) {
    super(CommandTypes.TELL, playerId, commandId)
    this.targetPlayer = targetPlayer
    this.message = message
  }
  
  validate() {
    super.validate()
    
    if (!this.targetPlayer || typeof this.targetPlayer !== 'string') {
      throw new Error('targetPlayer is required and must be a string')
    }
    
    if (!this.message || typeof this.message !== 'string') {
      throw new Error('message is required and must be a string')
    }
    
    if (this.message.trim().length === 0) {
      throw new Error('message cannot be empty')
    }
    
    return true
  }
  
  getPayload() {
    return {
      targetPlayer: this.targetPlayer,
      message: this.message
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager } = managers
    
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Find target player by name
    const targetPlayer = playerManager.getPlayerByName(this.targetPlayer)
    if (!targetPlayer) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND,
        targetPlayer: this.targetPlayer
      }))
      return updates
    }

    // Send message to target player
    updates.push(new BaseUpdate(targetPlayer.id, UpdateTypes.SOCIAL_MESSAGE, {
      type: 'tell_received',
      message: this.message,
      sender: player.name
    }))

    // Send confirmation to sender
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.SOCIAL_MESSAGE, {
      type: 'tell_sent',
      message: this.message,
      recipient: targetPlayer.name
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new TellCommand(data.playerId, data.targetPlayer, data.message, data.commandId)
  }
}

/**
 * Emote command - perform an action/emote visible to all players in room
 */
export class EmoteCommand extends BaseCommand {
  constructor(playerId, action, commandId = null) {
    super(CommandTypes.EMOTE, playerId, commandId)
    this.action = action
  }
  
  validate() {
    super.validate()
    
    if (!this.action || typeof this.action !== 'string') {
      throw new Error('action is required and must be a string')
    }
    
    if (this.action.trim().length === 0) {
      throw new Error('action cannot be empty')
    }
    
    return true
  }
  
  getPayload() {
    return {
      action: this.action
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager } = managers
    
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Get all players in the same room
    const playersInRoom = playerManager.getPlayersInRoom(player.location)
    
    // Send the emote to all players in the room
    for (const roomPlayer of playersInRoom) {
      updates.push(new BaseUpdate(roomPlayer.id, UpdateTypes.SOCIAL_MESSAGE, {
        type: 'emote',
        action: this.action,
        actor: player.name
      }))
    }

    return updates
  }
  
  static fromJSON(data) {
    return new EmoteCommand(data.playerId, data.action, data.commandId)
  }
}