import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

/**
 * Take it      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { errorCode: ErrorCodes.PLAYER_NOT_FOUND }))
      return updates
    }

    // Check if player has the item
    if (!inventoryManager.hasItem(this.playerId, this.itemId, 1)) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.ITEM_NOT_IN_INVENTORY,
        itemId: this.itemId
      }))
      return updates
    }

    const itemTemplate = templateManager.getItem(this.itemId)
    if (!itemTemplate) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.ITEM_NOT_FOUND,
        itemId: this.itemId
      }))p items from room
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
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { errorCode: ErrorCodes.PLAYER_NOT_FOUND }))
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
        errorCode: result.errorCode || ErrorCodes.UNKNOWN_ERROR,
        itemId: this.itemId,
        quantity: this.quantity
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
      action: 'take',
      itemId: this.itemId,
      quantity: this.quantity,
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
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { errorCode: ErrorCodes.PLAYER_NOT_FOUND }))
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
        errorCode: ErrorCodes.ITEM_NOT_IN_INVENTORY,
        itemId: this.itemId,
        quantity: this.quantity || 1
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
      action: 'drop',
      itemId: this.itemId,
      quantity: this.quantity || 1,
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
 * Use item command - use consumable items
 */
export class UseItemCommand extends BaseCommand {
  constructor(playerId, itemId, commandId = null) {
    super(CommandTypes.USE_ITEM, playerId, commandId)
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
    const { playerManager, inventoryManager, templateManager } = managers
    const player = playerManager.getPlayer(this.playerId)
    
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { errorCode: ErrorCodes.PLAYER_NOT_FOUND }))
      return updates
    }
  }
}