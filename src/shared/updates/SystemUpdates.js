import { BaseUpdate } from './BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'

/**
 * Command error update - sent when a command fails validation or execution
 */
export class CommandErrorUpdate extends BaseUpdate {
  constructor(playerId, commandId, errorCode, errorData = {}) {
    super(UpdateTypes.COMMAND_ERROR, [playerId])
    this.commandId = commandId
    this.errorCode = errorCode
    this.errorData = errorData
  }
  
  getData() {
    return {
      commandId: this.commandId,
      errorCode: this.errorCode,
      errorData: this.errorData
    }
  }
}

/**
 * Server message update - sent for system messages
 */
export class ServerMessageUpdate extends BaseUpdate {
  constructor(affectedPlayers, messageType, messageData) {
    super(UpdateTypes.SERVER_MESSAGE, affectedPlayers)
    this.messageType = messageType
    this.messageData = messageData
  }
  
  getData() {
    return {
      messageType: this.messageType,
      messageData: this.messageData
    }
  }
}

/**
 * Template data update - sent to provide game template data to clients
 */
export class TemplateDataUpdate extends BaseUpdate {
  constructor(playerId, templateData) {
    super(UpdateTypes.TEMPLATE_DATA, [playerId])
    this.templateData = templateData
  }
  
  getData() {
    return {
      templates: this.templateData
    }
  }
}