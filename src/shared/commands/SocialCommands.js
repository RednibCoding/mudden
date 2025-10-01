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
    const { playerManager, socialManager } = managers
    
    // Use social manager to handle the say logic
    const result = socialManager.broadcastSay(this.playerId, this.message, playerManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode 
      }))
      return updates
    }

    // Create updates for all players who should receive the message
    for (const messageData of result.messageData) {
      updates.push(new BaseUpdate(messageData.playerId, UpdateTypes.SOCIAL_MESSAGE, {
        type: messageData.type,
        message: messageData.message,
        speaker: messageData.speaker
      }))
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
    const { playerManager, socialManager } = managers
    
    // Use social manager to handle the tell logic
    const result = socialManager.sendTell(this.playerId, this.targetPlayer, this.message, playerManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        targetPlayer: result.targetPlayer
      }))
      return updates
    }

    // Create updates for both sender and recipient
    for (const messageData of result.messageData) {
      updates.push(new BaseUpdate(messageData.playerId, UpdateTypes.SOCIAL_MESSAGE, {
        type: messageData.type,
        message: messageData.message,
        sender: messageData.sender,
        recipient: messageData.recipient
      }))
    }

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
    const { playerManager, socialManager } = managers
    
    // Use social manager to handle the emote logic
    const result = socialManager.broadcastEmote(this.playerId, this.action, playerManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode 
      }))
      return updates
    }

    // Create updates for all players in the room
    for (const messageData of result.messageData) {
      updates.push(new BaseUpdate(messageData.playerId, UpdateTypes.SOCIAL_MESSAGE, {
        type: messageData.type,
        action: messageData.action,
        actor: messageData.actor
      }))
    }

    return updates
  }
  
  static fromJSON(data) {
    return new EmoteCommand(data.playerId, data.action, data.commandId)
  }
}

/**
 * Talk command - initiate conversation with an NPC
 */
export class TalkCommand extends BaseCommand {
  constructor(playerId, npcId, commandId = null) {
    super(CommandTypes.TALK, playerId, commandId)
    this.npcId = npcId
  }
  
  validate() {
    super.validate()
    
    if (!this.npcId || typeof this.npcId !== 'string') {
      throw new Error('npcId is required and must be a string')
    }
    
    return true
  }
  
  getPayload() {
    return {
      npcId: this.npcId
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager, socialManager, worldManager, templateManager } = managers
    
    // Use social manager to handle NPC conversation
    const result = socialManager.processTalkToNpc(
      this.playerId, 
      this.npcId, 
      playerManager, 
      worldManager, 
      templateManager
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        npcId: this.npcId
      }))
      return updates
    }

    // Send NPC dialogue response
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.NPC_DIALOGUE, {
      npcName: result.npcName,
      message: result.message,
      availableTopics: result.availableTopics || []
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new TalkCommand(data.playerId, data.npcId, data.commandId)
  }
}

/**
 * Ask command - ask an NPC about a specific topic
 */
export class AskCommand extends BaseCommand {
  constructor(playerId, npcId, topic, commandId = null) {
    super(CommandTypes.ASK, playerId, commandId)
    this.npcId = npcId
    this.topic = topic
  }
  
  validate() {
    super.validate()
    
    if (!this.npcId || typeof this.npcId !== 'string') {
      throw new Error('npcId is required and must be a string')
    }
    
    if (!this.topic || typeof this.topic !== 'string') {
      throw new Error('topic is required and must be a string')
    }
    
    return true
  }
  
  getPayload() {
    return {
      npcId: this.npcId,
      topic: this.topic
    }
  }
  
  execute(managers) {
    const updates = []
    const { playerManager, socialManager, worldManager, templateManager } = managers
    
    // Use social manager to handle NPC topic conversation
    const result = socialManager.processAskNpc(
      this.playerId, 
      this.npcId, 
      this.topic,
      playerManager, 
      worldManager, 
      templateManager
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        npcId: this.npcId,
        topic: this.topic
      }))
      return updates
    }

    // Send NPC response
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.NPC_RESPONSE, {
      npcName: result.npcName,
      topic: result.topic,
      message: result.message
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new AskCommand(data.playerId, data.npcId, data.topic, data.commandId)
  }
}