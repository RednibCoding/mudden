import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'

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
    const { playerManager, inventoryManager, equipmentManager, templateManager } = managers
    const player = playerManager.getPlayer(this.playerId)
    
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Player not found' }))
      return updates
    }

    // Check if player has the item
    if (!inventoryManager.hasItem(this.playerId, this.itemId, 1)) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
        message: 'Item not found in inventory' 
      }))
      return updates
    }

    const itemTemplate = templateManager.getItem(this.itemId)
    if (!itemTemplate) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Unknown item template' }))
      return updates
    }

    // Check if item is equippable
    if (!itemTemplate.equipment) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
        message: 'This item cannot be equipped' 
      }))
      return updates
    }

    const slot = itemTemplate.equipment.slot
    if (!slot) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
        message: 'Invalid equipment slot' 
      }))
      return updates
    }

    // Try to equip the item
    const equipResult = equipmentManager.equipItem(this.playerId, this.itemId, slot)
    if (equipResult.success) {
      // Remove from inventory
      inventoryManager.removeItem(this.playerId, this.itemId, 1)
      
      // If there was a previously equipped item, add it back to inventory
      if (equipResult.previousItem) {
        inventoryManager.addItem(this.playerId, equipResult.previousItem, 1)
      }
      
      const equipment = equipmentManager.getPlayerEquipment(this.playerId)
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, {
        message: `You equip ${itemTemplate.name || this.itemId}.`,
        equipment: equipment
      }))
    } else {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
        message: equipResult.message || 'Failed to equip item' 
      }))
    }

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
    const { playerManager, inventoryManager, equipmentManager, templateManager } = managers
    const player = playerManager.getPlayer(this.playerId)
    
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Player not found' }))
      return updates
    }

    const unequipResult = equipmentManager.unequipItem(this.playerId, this.slot)
    if (unequipResult.success) {
      // Add unequipped item back to inventory
      if (unequipResult.itemId) {
        const canAdd = inventoryManager.canAddItem(this.playerId, unequipResult.itemId, 1)
        if (canAdd) {
          inventoryManager.addItem(this.playerId, unequipResult.itemId, 1)
          
          const itemTemplate = templateManager.getItem(unequipResult.itemId)
          const equipment = equipmentManager.getPlayerEquipment(this.playerId)
          
          updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, {
            message: `You unequip ${itemTemplate?.name || unequipResult.itemId}.`,
            equipment: equipment
          }))
        } else {
          updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
            message: 'No inventory space to unequip item' 
          }))
        }
      } else {
        updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
          message: 'Nothing equipped in that slot' 
        }))
      }
    } else {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_CHANGED, { 
        message: unequipResult.message || 'Failed to unequip item' 
      }))
    }

    return updates
  }
  
  static fromJSON(data) {
    return new UnequipItemCommand(data.playerId, data.slot, data.commandId)
  }
}