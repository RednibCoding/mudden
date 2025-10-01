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
  SHOW_INVENTORY: 104,
  
  // Equipment Commands (200-299)
  EQUIP_ITEM: 200,
  UNEQUIP_ITEM: 201,
  SHOW_EQUIPMENT: 202,
  
  // Social Commands (300-399)
  SAY: 300,
  TELL: 301,
  EMOTE: 302,
  WHO: 303,
  
  // Combat Commands (400-499)
  ATTACK: 400,
  CAST_SPELL: 401,
  FLEE: 402,
  DEFEND: 403,
  
  // Quest Commands (500-599)
  ACCEPT_QUEST: 500,
  COMPLETE_QUEST: 501,
  ABANDON_QUEST: 502,
  SHOW_QUESTS: 503,
  
  // Trade Commands (600-699)
  TRADE_REQUEST: 600,
  TRADE_ACCEPT: 601,
  TRADE_DECLINE: 602,
  TRADE_ADD_ITEM: 603,
  TRADE_REMOVE_ITEM: 604,
  TRADE_CONFIRM: 605,
  
  // Admin Commands (700-799)
  KICK_PLAYER: 700,
  BAN_PLAYER: 701,
  MUTE_PLAYER: 702,
  TELEPORT: 703,
  SPAWN_ITEM: 704,
  
  // System Commands (800-899)
  PING: 800,
  QUIT: 801,
  HELP: 802,
  TIME: 803,
  SAVE: 804
}