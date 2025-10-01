import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

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
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, equipmentManager } = managers
    
    // Verify player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Use equipment manager to handle the complete equip workflow
    const result = equipmentManager.processEquipItem(this.playerId, this.itemId, inventoryManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        itemId: result.itemId,
        context: result.context
      }))
      return updates
    }

    // Create success update with equipment data
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, {
      action: result.action,
      itemId: result.itemId,
      slot: result.slot,
      equipment: result.equipment,
      unequippedItem: result.unequippedItem
    }))

    return updates
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
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, equipmentManager } = managers
    
    // Verify player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Use equipment manager to handle the complete unequip workflow
    const result = equipmentManager.processUnequipItem(this.playerId, this.slot, inventoryManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        slot: result.slot
      }))
      return updates
    }

    // Create success update with equipment data
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, {
      action: result.action,
      itemId: result.itemId,
      slot: result.slot,
      equipment: result.equipment
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new UnequipItemCommand(data.playerId, data.slot, data.commandId)
  }
}