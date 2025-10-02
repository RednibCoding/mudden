// Core game types and interfaces
export interface Player {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  level: number;
  experience: number;
  gold: number;
  health: number;
  maxHealth: number;
  damage: number; // base damage stat (increases on level-up)
  defense: number; // base defense stat (increases on level-up)
  location: string;
  homestoneLocation: string;
  inventory: Item[];
  equipment: Equipment;
  activeQuests: { [questId: string]: number }; // questId -> progress
  completedQuests: string[];
  oneTimeEnemiesDefeated: string[]; // locationId.enemyId format for one-time enemies defeated
  oneTimeItemsPickedUp: string[]; // locationId.itemId format for one-time ground items picked up
  friends: string[]; // list of friend usernames
  lastWhisperFrom: string; // username of last person who sent a whisper
  lastItemUse: number; // timestamp of last item use for cooldown
  lastSeen: number;
  activeTrade?: TradeWindow; // current trade session
  inPvPCombat?: boolean; // true when engaged in player vs player combat
  pvpWins?: number; // total PvP victories
  pvpLosses?: number; // total PvP defeats
}

export interface TradeWindow {
  with: string;
  myItems: Item[];
  myGold: number;
  theirItems: Item[];
  theirGold: number;
  myReady: boolean;
  theirReady: boolean;
  initiatedBy: string;
  timestamp: number;
  pending?: boolean; // true if waiting for acceptance
}

export interface Equipment {
  weapon?: Item;
  shield?: Item;
  armor?: Item;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'shield' | 'armor' | 'consumable';
  value: number;
  stats?: {
    damage?: number;
    defense?: number;
    health?: number;
  };
  effect?: {
    type: 'heal' | 'damage' | 'teleport';
    amount?: number;        // for heal/damage
    location?: string;      // for teleport
    usableIn: 'always' | 'combat' | 'non-combat';
  };
  description: string;
}

export interface EnemyDrop {
  itemId: string;
  dropChance: number;
}

export interface Enemy {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  damage: number;
  defense: number;
  gold: number;
  experience: number;
  drops: EnemyDrop[];
  respawnTime: number;
  currentFighters: string[];
  lastKilled?: number;
  // Location-specific properties
  prerequisiteActiveQuests?: string[];
  prerequisiteCompletedQuests?: string[];
  oneTime?: boolean;
}

export interface GroundItem {
  itemId: string; // Reference to item in items.json
  respawnTime?: number; // If set, item respawns after pickup (in ms)
  lastPickedUp?: number; // Timestamp when last picked up (for respawn tracking)
  prerequisiteActiveQuests?: string[]; // Only visible if player has these quests active
  prerequisiteCompletedQuests?: string[]; // Only visible if player completed these quests
  oneTime?: boolean; // If true, only appears once per player (never respawns after pickup)
  droppedAt?: number; // Timestamp when dropped by a player (for expiration tracking)
}

export interface LocationEnemy {
  enemyId: string; // Reference to enemy in enemies.json
  prerequisiteActiveQuests?: string[]; // Only spawn if player has these quests active
  prerequisiteCompletedQuests?: string[]; // Only spawn if player completed these quests
  oneTime?: boolean; // If true, only spawns once per player (never respawns after defeat)
}

export interface Location {
  id: string;
  name: string;
  description: string;
  exits: { [direction: string]: string };
  enemies: Enemy[]; // At runtime, contains Enemy instances (loaded from LocationEnemy objects)
  npcs: string[];
  shop?: string; // Shop ID if this location has a shop
  groundItems?: GroundItem[]; // Predefined items on the ground (from locations.json)
  droppedItems?: GroundItem[]; // Items dropped by players (runtime only)
  homestone?: boolean; // Whether this location is a homestone binding point
  pvpAllowed?: boolean; // Whether PvP combat is allowed in this location (default: false)
}

export interface NPC {
  id: string;
  name: string;
  description: string;
  dialogue: string[];
  quests: string[];
  locations: string[]; // Populated automatically during loading
  healer?: boolean; // If true, heals player to full health when talked to
}

export interface Quest {
  id: string;
  name: string;
  type: 'kill' | 'visit' | 'collect';
  target: string;
  amount: number;
  levelRequirement: number;
  prerequisiteQuests: string[];
  giver: string;
  turnInNPC: string;
  questDialogue: string;
  killCompleteMessage?: string; // Only used for kill quests when all enemies are killed
  rewardDialogue: string;
  reward: {
    gold: number;
    experience: number;
    items?: string[];
  };
}

export interface Shop {
  id: string;
  name: string;
  items: string[];
  margin: number; // Buy price multiplier (e.g., 1.2 = 20% markup)
}

export interface Defaults {
  player: {
    startingLocation: string;
    startingHealth: number;
    startingMaxHealth: number;
    startingLevel: number;
    startingExperience: number;
    startingGold: number;
    baseDamage: number;
    baseDefense: number;
    maxInventorySlots: number;
  };
  combat: {
    playerDeathHealthThreshold: number;
    enemyCounterAttackDelayMs: number;
    combatRoundDelayMs: number;
    fleeSuccessChance: number;
  };
  pvp: {
    goldLootPercentage: number;
    baseExperience: number;
    experienceByDifficulty: {
      trivial: number;
      easy: number;
      moderate: number;
      challenging: number;
      hard: number;
      deadly: number;
      impossible: number;
    };
  };
  levelUp: {
    healthGainPerLevel: number;
    damageGainPerLevel: number;
    defenseGainPerLevel: number;
    fullHealOnLevelUp: boolean;
    baseExperiencePerLevel: number;
    experienceMultiplier: number;
    maxLevel: number;
  };
  items: {
    useCooldownMs: number; // Global cooldown for using consumable items
  };
  droppedItems?: {
    maxDroppedItemsPerLocation: number; // Maximum number of dropped items per location
    droppedItemLifetimeMs: number; // How long dropped items exist before despawning
  };
}

export interface GameState {
  players: Map<string, Player>;
  enemies: Map<string, Enemy>;
  locations: Map<string, Location>;
  items: Map<string, Item>;
  npcs: Map<string, NPC>;
  quests: Map<string, Quest>;
  shops: Map<string, Shop>;
  defaults: Defaults;
}

export interface ClientMessage {
  type: 'login' | 'register' | 'command';
  data: any;
}

export interface ServerMessage {
  type: 'auth' | 'message' | 'update' | 'error';
  data: any;
}