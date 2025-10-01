import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'

/**
 * Equip item command - equip items to equipment slots
 */
export class EquipItemCommand extends BaseCommand {
  constructor(playerId, itemId, commandId = null) {
    super(CommandTypes.EQUIP_ITEM, playerId, commandId)
    this.itemId = itemId
  }
  
  validate() {
    super.validate()
    
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId
    }
  }
  
  static fromJSON(data) {
    return new EquipItemCommand(data.playerId, data.itemId, data.commandId)
  }
}

/**
 * Unequip item command - remove items from equipment slots
 */
export class UnequipItemCommand extends BaseCommand {
  constructor(playerId, slot, commandId = null) {
    super(CommandTypes.UNEQUIP_ITEM, playerId, commandId)
    this.slot = slot
  }
  
  validate() {
    super.validate()
    
    const validSlots = ['main_hand', 'off_hand', 'chest', 'legs', 'head', 'feet', 'hands', 'bag']
    if (!this.slot || !validSlots.includes(this.slot)) {
      throw new Error(`Invalid equipment slot: ${this.slot}. Valid slots: ${validSlots.join(', ')}`)
    }
    
    return true
  }
  
  getPayload() {
    return {
      slot: this.slot
    }
  }
  
  static fromJSON(data) {
    return new UnequipItemCommand(data.playerId, data.slot, data.commandId)
  }
}