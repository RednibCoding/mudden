/**
 * Update Type Constants - Used for client-server communication
 * Server sends these update types to inform clients of state changes
 */
export const UpdateTypes = {
  // Player Updates (1-99)
  PLAYER_MOVED: 1,
  PLAYER_STATS_CHANGED: 2,
  PLAYER_ENTERED_ROOM: 3,
  PLAYER_LEFT_ROOM: 4,
  
  // Inventory Updates (100-199)
  INVENTORY_CHANGED: 100,
  EQUIPMENT_CHANGED: 101,
  
  // World Updates (200-299)
  ROOM_STATE_CHANGED: 200,
  ITEM_SPAWNED: 201,
  ITEM_REMOVED: 202,
  
  // Combat Updates (300-399)
  DAMAGE_DEALT: 300,
  HEALTH_CHANGED: 301,
  COMBAT_STARTED: 302,
  COMBAT_ENDED: 303,
  
  // Social Updates (400-499)
  MESSAGE_RECEIVED: 400,
  PLAYER_SPOKE: 401,
  SOCIAL_MESSAGE: 402,
  
  // Error Updates (800-899)
  COMMAND_ERROR: 800,
  VALIDATION_ERROR: 801,
  PERMISSION_ERROR: 802,
  
  // System Updates (900-999)
  TICK_UPDATE: 900,
  SERVER_MESSAGE: 901,
  TEMPLATE_DATA: 902
}

/**
 * Helper function to validate update types
 */
export function isValidUpdateType(type) {
  return Object.values(UpdateTypes).includes(type)
}