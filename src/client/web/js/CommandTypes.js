/**
 * Client-side Command Type Constants - Mirror of server CommandTypes
 * These must be kept in sync with src/shared/CommandTypes.js
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
  INVENTORY: 104,
  
  // Equipment Commands (200-299)
  EQUIP_ITEM: 200,
  UNEQUIP_ITEM: 201,
  SHOW_EQUIPMENT: 202,
  
  // Social Commands (300-399)
  SAY: 300,
  TELL: 301,
  EMOTE: 302,
  TALK: 303,
  ASK: 304,
  WHO: 303,
  
  // Combat Commands (400-499)
  ATTACK: 400,
  CAST_SPELL: 401,
  
  // Trade Commands (500-599)
  TRADE_REQUEST: 500,
  TRADE_ADD_ITEM: 501,
  TRADE_ACCEPT: 502,
  TRADE_CANCEL: 503,
  
  // Info Commands (600-699)
  STATS: 600,
  HEALTH: 601,
  EQUIPMENT_DISPLAY: 602,
  EXAMINE: 603,
  
  // Quest Commands (700-799)
  QUEST_LIST: 700,
  QUEST_ACCEPT: 701,
  QUEST_COMPLETE: 702,
  QUEST_INFO: 703,
  
  // Friends Commands (800-899)
  FRIENDS_LIST: 800,
  FRIENDS_ADD: 801,
  FRIENDS_REMOVE: 802,
  FRIENDS_NOTE: 803,
  
  // System Commands (900-999)
  PING: 900,
  DISCONNECT: 901
}