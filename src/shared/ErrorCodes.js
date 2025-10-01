/**
 * Error Code Constants - Standardized error codes for client-server communication
 * Client uses these codes to display appropriate error messages in any language
 */
export const ErrorCodes = {
  // General Errors (1-99)
  UNKNOWN_ERROR: 1,
  INVALID_COMMAND: 2,
  PLAYER_NOT_FOUND: 3,
  INSUFFICIENT_PERMISSIONS: 4,
  COMMAND_VALIDATION_FAILED: 5,
  
  // Movement Errors (100-199)
  NO_EXIT: 100,
  EXIT_BLOCKED: 101,
  INSUFFICIENT_LEVEL: 102,
  ALREADY_IN_ROOM: 103,
  
  // Inventory Errors (200-299)
  ITEM_NOT_FOUND: 200,
  ITEM_NOT_IN_INVENTORY: 201,
  INVENTORY_FULL: 202,
  INSUFFICIENT_QUANTITY: 203,
  ITEM_NOT_TAKEABLE: 204,
  ITEM_TOO_HEAVY: 205,
  
  // Equipment Errors (300-399)
  ITEM_NOT_EQUIPPABLE: 300,
  WRONG_EQUIPMENT_SLOT: 301,
  SLOT_ALREADY_OCCUPIED: 302,
  ITEM_NOT_EQUIPPED: 303,
  CANNOT_UNEQUIP_BAG: 304,
  INSUFFICIENT_LEVEL_FOR_ITEM: 305,
  
  // Combat Errors (400-499)
  TARGET_NOT_FOUND: 400,
  ALREADY_IN_COMBAT: 401,
  TARGET_DEAD: 402,
  NOT_IN_COMBAT: 403,
  INSUFFICIENT_MANA: 404,
  SPELL_NOT_FOUND: 405,
  
  // Social Errors (500-599)
  PLAYER_OFFLINE: 500,
  PLAYER_BLOCKED: 501,
  INVALID_MESSAGE: 502,
  MESSAGE_TOO_LONG: 503,
  
  // Trade Errors (600-699)
  ALREADY_IN_TRADE: 600,
  NOT_IN_TRADE: 601,
  TRADE_PARTNER_NOT_FOUND: 602,
  INSUFFICIENT_GOLD: 603,
  TRADE_CANCELLED: 604,
  
  // Quest Errors (700-799)
  QUEST_NOT_FOUND: 700,
  QUEST_ALREADY_COMPLETED: 701,
  QUEST_REQUIREMENTS_NOT_MET: 702,
  QUEST_ALREADY_ACTIVE: 703
}

/**
 * Helper function to validate error codes
 */
export function isValidErrorCode(code) {
  return Object.values(ErrorCodes).includes(code)
}