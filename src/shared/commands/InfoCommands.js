import { BaseCommand } from './BaseCommand.js'
import { CommandTypes } from '../CommandTypes.js'
import { BaseUpdate } from '../BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'
import { ErrorCodes } from '../ErrorCodes.js'

/**
 * Stats command - show player statistics
 */
export class StatsCommand extends BaseCommand {
  constructor(playerId, commandId = null) {
    super(CommandTypes.STATS, playerId, commandId)
  }
  
  static fromJSON(data) {  
    return new StatsCommand(data.playerId, data.commandId)
  }
  
  execute(managers) {
    const { playerManager, infoManager } = managers
    
    const result = infoManager.processGetStats(this.playerId, playerManager)
    
    if (!result.success) {
      return [new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: result.errorCode
      })]
    }

    return [new BaseUpdate(this.playerId, UpdateTypes.PLAYER_STATS, {
      stats: result.data
    })]
  }
}

/**
 * Health command - show player health
 */
export class HealthCommand extends BaseCommand {
  constructor(playerId, commandId = null) {
    super(CommandTypes.HEALTH, playerId, commandId)
  }
  
  static fromJSON(data) {
    return new HealthCommand(data.playerId, data.commandId)
  }
  
  execute(managers) {
    const { playerManager, infoManager } = managers
    
    const result = infoManager.processGetHealth(this.playerId, playerManager)
    
    if (!result.success) {
      return [new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: result.errorCode
      })]
    }

    return [new BaseUpdate(this.playerId, UpdateTypes.PLAYER_HEALTH, {
      health: result.data
    })]
  }
}

/**
 * Equipment command - show equipped items
 */
export class EquipmentDisplayCommand extends BaseCommand {
  constructor(playerId, commandId = null) {
    super(CommandTypes.EQUIPMENT_DISPLAY, playerId, commandId)
  }
  
  static fromJSON(data) {
    return new EquipmentDisplayCommand(data.playerId, data.commandId)
  }
  
  execute(managers) {
    const { playerManager, infoManager, templateManager } = managers
    
    const result = infoManager.processGetEquipment(this.playerId, playerManager, templateManager)
    
    if (!result.success) {
      return [new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: result.errorCode
      })]
    }

    return [new BaseUpdate(this.playerId, UpdateTypes.EQUIPMENT_DISPLAY, {
      equipment: result.data.equipment
    })]
  }
}



/**
 * Examine command - detailed look at something (alias for look with target)
 */
export class ExamineCommand extends BaseCommand {
  constructor(playerId, target, commandId = null) {
    super(CommandTypes.EXAMINE, playerId, commandId)
    this.target = target
  }
  
  static fromJSON(data) {
    return new ExamineCommand(data.playerId, data.target, data.commandId)
  }
  
  validate() {
    super.validate()
    
    if (!this.target || typeof this.target !== 'string') {
      throw new Error('target is required for examine command')
    }
    
    return true
  }
  
  getPayload() {
    return {
      target: this.target
    }
  }
  
  execute(managers) {
    const { playerManager, worldManager, templateManager, infoManager } = managers
    
    const result = infoManager.processLook(
      this.playerId, 
      this.target, 
      playerManager, 
      worldManager, 
      templateManager
    )
    
    if (!result.success) {
      return [new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
        errorCode: result.errorCode,
        target: this.target
      })]
    }

    if (result.action === 'look_room') {
      return [new BaseUpdate(this.playerId, UpdateTypes.ROOM_INFO, {
        room: result.data
      })]
    } else if (result.action === 'look_item') {
      return [new BaseUpdate(this.playerId, UpdateTypes.ITEM_INFO, {
        item: result.data
      })]
    }
    
    return [new BaseUpdate(this.playerId, UpdateTypes.COMMAND_ERROR, {
      errorCode: ErrorCodes.UNKNOWN_ERROR
    })]
  }
}