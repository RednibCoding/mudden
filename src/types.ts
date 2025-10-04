// Core TypeScript interfaces for Mudden MUD

import { Socket } from 'socket.io';

// ==================== Message Types ====================

export type MessageType = 
  | 'info'       // General information (look, inventory, help)
  | 'success'    // Positive actions (bought item, quest complete, level up)
  | 'error'      // Failed actions (can't afford, inventory full)
  | 'combat'     // Combat messages (damage dealt/taken)
  | 'say'        // Public chat (say command)
  | 'whisper'    // Private messages (whisper/reply)
  | 'npc'        // NPC dialogue
  | 'system'     // Server announcements (player joined/left, movement)
  | 'loot';      // Rewards (gold/xp gained, item found)

export interface GameMessage {
  type: MessageType;
  text: string;
  timestamp: number;
}

// ==================== Player ====================

export interface Player {
  id: string;
  username: string;                            // Lowercase for login/lookups
  displayName: string;                         // Capitalized for display
  passwordHash: string;
  location: string;
  level: number;
  xp: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  damage: number;
  defense: number;
  gold: number;
  deaths: number;                              // Death counter
  combats: number;                             // Combat counter
  inventory: Item[];
  equipped: {
    weapon: Item | null;
    armor: Item | null;
    shield: Item | null;
    accessory: Item | null;
  };
  questItems: { [id: string]: number };        // Temporary quest tracking
  materials: { [id: string]: number };         // Permanent crafting materials
  knownRecipes: string[];                      // Learned recipe IDs
  activeQuests: { [id: string]: QuestProgress };
  completed: string[];                         // Completed quest IDs
  lastHarvest: { [key: string]: number };      // Key = "locationId_materialId"
  lastWhisperFrom: string;                     // For reply system
  friends: string[];                           // Friend usernames
  socket?: Socket;                             // Runtime only (not saved)
}

export interface QuestProgress {
  questId: string;
  progress: number;
}

// ==================== Items ====================

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'equipment' | 'consumable' | 'recipe' | 'quest';
  slot?: 'weapon' | 'armor' | 'shield' | 'accessory';  // For equipment items
  value: number;
  damage?: number;
  defense?: number;
  health?: number;        // +HP bonus or healing amount
  mana?: number;          // +Mana bonus or restore amount
  manaCost?: number;      // For consumable scrolls
  usableIn?: 'any' | 'combat' | 'peaceful';  // Consumable usage restrictions
  destination?: string;   // For teleport scrolls
  teachesRecipe?: string; // For recipe items
}

// ==================== Equipment ====================

export interface EquippedItems {
  weapon: Item | null;
  armor: Item | null;
  shield: Item | null;
  accessory: Item | null;
}

// ==================== Enemies ====================

export interface Enemy {
  id: string;
  name: string;
  description: string;
  health: number;
  maxHealth: number;
  damage: number;
  defense: number;
  gold: number;
  xp: number;
  materialDrops?: {
    [materialId: string]: {
      chance: number;      // 0.0-1.0 drop probability
      amount: string;      // "min-max" range (e.g., "1-2")
    };
  };
  itemDrops?: {
    [itemId: string]: {
      chance: number;      // 0.0-1.0 drop probability
    };
  };
  fighters: string[];      // Usernames of players fighting this enemy
}

// ==================== Locations ====================

export interface Location {
  id: string;
  name: string;
  description: string;
  exits: { [direction: string]: string };  // direction -> locationId
  npcs?: NPC[];
  enemies?: Enemy[];
  items?: Item[];
  shop?: Shop;
  resources?: ResourceNode[];
}

// ==================== NPCs ====================

export interface NPC {
  id: string;
  name: string;
  dialogue: string;        // Default dialogue
  questDialogue?: string;  // Dialogue when player has active visit quest targeting this NPC
  quest?: string;          // Quest ID this NPC offers
  healer?: boolean;        // Can heal players for gold
  portals?: {
    [keyword: string]: {
      destination: string;
      cost: number;
    };
  };
}

// ==================== Quests ====================

export interface Quest {
  id: string;
  name: string;
  type: 'kill' | 'collect' | 'visit';
  target: string;          // Enemy ID (kill/collect) or NPC ID (visit)
  count: number;           // How many to kill/collect
  materialDrop?: string;   // Material ID to track for collect quests
  dialogue: string;        // Quest description
  completionDialogue: string; // What NPC says when quest is completed
  reward: {
    gold: number;
    xp: number;
    item?: string;         // Optional item reward
  };
  requiresQuest?: string;  // Optional prerequisite quest ID
  levelRequirement?: number; // Optional minimum level to accept quest
  npc?: string;            // NPC ID (populated by data loader from NPC.quest)
}

// ==================== Shops ====================

export interface Shop {
  id: string;
  name: string;
  items: string[];         // Item IDs available for purchase
}

// ==================== Materials ====================

export interface Material {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';  // Cosmetic only
}

// ==================== Resource Nodes ====================

export interface ResourceNode {
  materialId: string;      // ID of material from materials/ folder
  amount: string;          // "min-max" range (e.g., "1-3")
  cooldown: number;        // Milliseconds between harvests per player
  chance: number;          // 0.0-1.0 success probability
}

// ==================== Recipes ====================

export interface Recipe {
  id: string;
  name: string;
  result: string;                              // Item ID OR material ID to create
  resultType: 'item' | 'material';             // What type of result
  resultAmount?: number;                       // Amount of material created (default: 1)
  materials: { [materialId: string]: number }; // Material requirements
  requiredLevel: number;
}

// ==================== Configuration ====================

export interface Config {
  newPlayer: {
    startingLocation: string;
    startingLevel: number;
    startingGold: number;
    startingHealth: number;
    startingMana: number;
    startingDamage: number;
    startingDefense: number;
    startingEquipment: {
      weapon: string | null;
      armor: string | null;
      shield: string | null;
      accessory: string | null;
    };
    startingInventory: string[];
  };
  gameplay: {
    maxInventorySlots: number;
    fleeSuccessChance: number;
    enemyRespawnTime: number;
    deathGoldLossPct: number;
    deathRespawnLocation: string;
    damageVariance: number;
  };
  progression: {
    baseXpPerLevel: number;
    xpMultiplier: number;
    healthPerLevel: number;
    manaPerLevel: number;
    damagePerLevel: number;
    defensePerLevel: number;
  };
  economy: {
    shopBuyMultiplier: number;
    shopSellMultiplier: number;
    healerCostFactor: number;
  };
}

// ==================== Game Data ====================

export interface GameData {
  locations: Map<string, Location>;
  items: Map<string, Item>;
  enemies: Map<string, Enemy>;
  npcs: Map<string, NPC>;
  quests: Map<string, Quest>;
  shops: Map<string, Shop>;
  recipes: Map<string, Recipe>;
  materials: Map<string, Material>;
  config: Config;
}
