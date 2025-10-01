/**
 * Command Type Constants - Used for fast integer switching instead of string matching
 * Organized by category with ranges for easy expansion
 */
export const CommandTypes = {
  // Movement Commands (1-99)
  MOVE: 1,
  LOOK: 2,
  
  // Inventory Commands (100-199)  
  TAKE_ITEM: 100,
  DROP_ITEM: 101,
  USE_ITEM: 102,
  GIVE_ITEM: 103,
  
  // Equipment Commands (200-299)
  EQUIP_ITEM: 200,
  UNEQUIP_ITEM: 201,
  
  // Social Commands (300-399)
  SAY: 300,
  TELL: 301,
  EMOTE: 302,
  
  // Combat Commands (400-499)
  ATTACK: 400,
  CAST_SPELL: 401,
  
  // Trade Commands (500-599)
  TRADE_REQUEST: 500,
  TRADE_ADD_ITEM: 501,
  TRADE_ACCEPT: 502,
  TRADE_CANCEL: 503,
  
  // System Commands (900-999)
  PING: 900,
  DISCONNECT: 901
}

/**
 * Helper function to validate command types
 */
export function isValidCommandType(type) {
  return Object.values(CommandTypes).includes(type)
}