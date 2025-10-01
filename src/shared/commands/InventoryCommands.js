import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'

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
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, templateManager } = managers
    
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Player not found' }))
      return updates
    }

    // Use manager service method
    const result = inventoryManager.tryTakeItem(
      this.playerId, 
      this.itemId, 
      this.quantity, 
      managers.worldManager, 
      player.location
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        message: result.message 
      }))
      return updates
    }

    // Create item names mapping for inventory display
    const itemNames = {}
    const currentItems = result.inventory ? result.inventory.items : []
    currentItems.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    const itemTemplate = templateManager.getItem(this.itemId)
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_CHANGED, {
      message: `You take ${this.quantity} ${itemTemplate?.name || this.itemId}.`,
      inventory: currentItems,
      itemNames: itemNames
    }))

    return updates
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
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, templateManager } = managers
    
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Player not found' }))
      return updates
    }

    // Use manager service method
    const result = inventoryManager.tryDropItem(
      this.playerId, 
      this.itemId, 
      this.quantity || 1, 
      managers.worldManager, 
      player.location
    )
    
    if (!result.success) {
      const itemTemplate = templateManager.getItem(this.itemId)
      const itemName = itemTemplate?.name || this.itemId
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        message: result.message.replace(this.itemId, itemName)
      }))
      return updates
    }

    // Create item names mapping for inventory display
    const itemNames = {}
    const currentItems = result.inventory ? result.inventory.items : []
    currentItems.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    const itemTemplate = templateManager.getItem(this.itemId)
    const itemName = itemTemplate?.name || this.itemId
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_CHANGED, {
      message: `You drop ${this.quantity || 1} ${itemName}.`,
      inventory: currentItems,
      itemNames: itemNames
    }))
    
    return updates
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
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, templateManager } = managers
    const player = playerManager.getPlayer(this.playerId)
    
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { message: 'Player not found' }))
      return updates
    }

    // Check if player has the item
    if (!inventoryManager.hasItem(this.playerId, this.itemId, 1)) {
      const itemTemplate = templateManager.getItem(this.itemId)
      const itemName = itemTemplate?.name || this.itemId
      updates.push(new BaseUpdate(this.playerId, 'INVENTORY_UPDATE', { 
        message: `You don't have ${itemName} to use.` 
      }))
      return updates
    }

    const itemTemplate = templateManager.getItem(this.itemId)
    if (!itemTemplate) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        message: 'Unknown item' 
      }))
      return updates
    }

    // For now, just a placeholder - item usage logic would go here
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.SERVER_MESSAGE, {
      message: `You use ${itemTemplate.name || this.itemId}.`
    }))
    
    return updates
  }
  
  static fromJSON(data) {
    return new UseItemCommand(data.playerId, data.itemId, data.targetId, data.commandId)
  }
}