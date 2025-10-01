import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'

/**
 * Take item command - pick up items from room
 */
export class TakeItemCommand extends BaseCommand {
  constructor(playerId, itemId, quantity = 1, commandId = null) {
    super(CommandTypes.TAKE_ITEM, playerId, commandId)
    this.itemId = itemId
    this.quantity = quantity
  }
  
  validate() {
    super.validate()
    
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    
    if (!Number.isInteger(this.quantity) || this.quantity < 1) {
      throw new Error('quantity must be a positive integer')
    }
    
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId,
      quantity: this.quantity
    }
  }
  
  static fromJSON(data) {
    return new TakeItemCommand(data.playerId, data.itemId, data.quantity, data.commandId)
  }
}

/**
 * Drop item command - drop items from inventory
 */
export class DropItemCommand extends BaseCommand {
  constructor(playerId, itemId, quantity = 1, commandId = null) {
    super(CommandTypes.DROP_ITEM, playerId, commandId)
    this.itemId = itemId
    this.quantity = quantity
  }
  
  validate() {
    super.validate()
    
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    
    if (!Number.isInteger(this.quantity) || this.quantity < 1) {
      throw new Error('quantity must be a positive integer')
    }
    
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId,
      quantity: this.quantity
    }
  }
  
  static fromJSON(data) {
    return new DropItemCommand(data.playerId, data.itemId, data.quantity, data.commandId)
  }
}

/**
 * Use item command - activate consumable items
 */
export class UseItemCommand extends BaseCommand {
  constructor(playerId, itemId, targetId = null, commandId = null) {
    super(CommandTypes.USE_ITEM, playerId, commandId)
    this.itemId = itemId
    this.targetId = targetId // Optional target (for items used on others)
  }
  
  validate() {
    super.validate()
    
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    
    // targetId is optional but if provided must be string
    if (this.targetId && typeof this.targetId !== 'string') {
      throw new Error('targetId must be a string if provided')
    }
    
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId,
      targetId: this.targetId
    }
  }
  
  static fromJSON(data) {
    return new UseItemCommand(data.playerId, data.itemId, data.targetId, data.commandId)
  }
}