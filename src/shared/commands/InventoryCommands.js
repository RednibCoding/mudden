import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

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
    const { playerManager, inventoryManager, templateManager, worldManager } = managers
    
    // Verify player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Use inventory manager to handle the complete take workflow
    const result = inventoryManager.processTakeItem(
      this.playerId, 
      this.itemId, 
      this.quantity, 
      worldManager, 
      player.location
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        itemId: result.itemId,
        quantity: result.quantity
      }))
      return updates
    }

    // Create item names mapping for inventory display
    const itemNames = {}
    result.inventory.items.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    // Create success update
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_CHANGED, {
      action: result.action,
      itemId: result.itemId,
      quantity: result.quantity,
      inventory: result.inventory.items,
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
    const { playerManager, inventoryManager, templateManager, worldManager } = managers
    
    // Verify player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Use inventory manager to handle the complete drop workflow
    const result = inventoryManager.processDropItem(
      this.playerId, 
      this.itemId, 
      this.quantity || 1, 
      worldManager, 
      player.location
    )
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        itemId: result.itemId,
        quantity: result.quantity
      }))
      return updates
    }

    // Create item names mapping for inventory display
    const itemNames = {}
    result.inventory.items.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    // Create success update
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_CHANGED, {
      action: result.action,
      itemId: result.itemId,
      quantity: result.quantity,
      inventory: result.inventory.items,
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
    
    // Verify player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Use inventory manager to handle the complete use item workflow
    const result = inventoryManager.processUseItem(this.playerId, this.itemId, playerManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode,
        itemId: result.itemId
      }))
      return updates
    }

    // Create item names mapping for inventory display
    const itemNames = {}
    result.inventory.items.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    // Create success update with effects
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_CHANGED, {
      action: result.action,
      itemId: result.itemId,
      inventory: result.inventory.items,
      itemNames: itemNames,
      effects: result.effects,
      itemName: result.itemName
    }))

    // If there are health/mana effects, send player stats update
    if (result.effects && result.effects.length > 0) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.PLAYER_STATS_CHANGED, {
        health: player.health,
        maxHealth: player.maxHealth,
        mana: player.mana || 0,
        maxMana: player.maxMana || 100
      }))
    }

    return updates
  }
  
  static fromJSON(data) {
    return new UseItemCommand(data.playerId, data.itemId, data.commandId)
  }
}

/**
 * Inventory command - display player's inventory
 */
export class InventoryCommand extends BaseCommand {
  constructor(playerId, commandId = null) {
    super(CommandTypes.INVENTORY, playerId, commandId)
  }
  
  validate() {
    super.validate()
    return true
  }
  
  getPayload() {
    return {}
  }
  
  execute(managers) {
    const updates = []
    const { playerManager, inventoryManager, templateManager } = managers
    
    // Validate player exists
    const player = playerManager.getPlayer(this.playerId)
    if (!player) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: ErrorCodes.PLAYER_NOT_FOUND 
      }))
      return updates
    }

    // Get inventory display data
    const result = inventoryManager.processGetInventory(this.playerId, playerManager)
    
    if (!result.success) {
      updates.push(new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, { 
        errorCode: result.errorCode
      }))
      return updates
    }

    // Create item names mapping for display
    const itemNames = {}
    result.inventory.items.forEach(item => {
      const template = templateManager.getItem(item.id)
      itemNames[item.id] = template?.name || item.id
    })
    
    // Create inventory display update
    updates.push(new BaseUpdate(this.playerId, UpdateTypes.INVENTORY_DISPLAY, {
      inventory: result.inventory.items,
      itemNames: itemNames,
      freeSlots: result.freeSlots,
      totalSlots: result.totalSlots
    }))

    return updates
  }
  
  static fromJSON(data) {
    return new InventoryCommand(data.playerId, data.commandId)
  }
}