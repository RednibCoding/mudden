/**
 * Centralized game state management
 */
import { GameState, Player } from './types';

export const gameState: GameState = {
  players: new Map(),
  enemies: new Map(),
  locations: new Map(),
  items: new Map(),
  npcs: new Map(),
  quests: new Map(),
  shops: new Map(),
  defaults: {
    player: {
      startingLocation: "town_square",
      startingHealth: 100,
      startingMaxHealth: 100,
      startingLevel: 1,
      startingExperience: 0,
      startingGold: 50,
      baseDamage: 5,
      baseDefense: 3,
      maxInventorySlots: 16
    },
    combat: {
      playerDeathHealthThreshold: 1,
      enemyCounterAttackDelayMs: 2000,
      combatRoundDelayMs: 4000,
      fleeSuccessChance: 0.7
    },
    pvp: {
      goldLootPercentage: 0.03,
      baseExperience: 50,
      experienceByDifficulty: {
        trivial: 10,
        easy: 25,
        moderate: 50,
        challenging: 75,
        hard: 100,
        deadly: 150,
        impossible: 200
      }
    },
    levelUp: {
      healthGainPerLevel: 10,
      damageGainPerLevel: 2,
      defenseGainPerLevel: 1,
      fullHealOnLevelUp: true,
      baseExperiencePerLevel: 100,
      experienceMultiplier: 1.5,
      maxLevel: 20
    },
    items: {
      useCooldownMs: 1000
    }
  }
};

/** Maps socket IDs to usernames for active connections */
export const activePlayers = new Map<string, string>();

/**
 * Gets a player by username (case-insensitive)
 */
export function getPlayer(username: string): Player | undefined {
  for (const [playerName, player] of gameState.players.entries()) {
    if (playerName.toLowerCase() === username.toLowerCase()) {
      return player;
    }
  }
  return undefined;
}

/**
 * Gets the socket ID for a given username
 */
export function getSocketId(username: string): string | undefined {
  for (const [socketId, user] of activePlayers.entries()) {
    if (user.toLowerCase() === username.toLowerCase()) {
      return socketId;
    }
  }
  return undefined;
}
