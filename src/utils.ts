/**
 * Utility functions for common operations
 */
import { Player, Enemy, Item, Location, GroundItem } from './types';
import { gameState } from './gameState';

/**
 * Checks if a player meets quest prerequisites
 */
export function meetsQuestPrerequisites(
  player: Player,
  prerequisiteActiveQuests?: string[],
  prerequisiteCompletedQuests?: string[]
): boolean {
  if (prerequisiteActiveQuests && prerequisiteActiveQuests.length > 0) {
    const hasAllActiveQuests = prerequisiteActiveQuests.every(questId =>
      player.activeQuests.hasOwnProperty(questId)
    );
    if (!hasAllActiveQuests) return false;
  }

  if (prerequisiteCompletedQuests && prerequisiteCompletedQuests.length > 0) {
    const hasAllCompletedQuests = prerequisiteCompletedQuests.every(questId =>
      player.completedQuests.includes(questId)
    );
    if (!hasAllCompletedQuests) return false;
  }

  return true;
}

/**
 * Checks if an enemy should be visible to a player
 */
export function isEnemyVisibleToPlayer(enemy: Enemy, player: Player, locationId: string): boolean {
  if (enemy.oneTime) {
    const oneTimeKey = `${locationId}.${enemy.id}`;
    if (player.oneTimeEnemiesDefeated.includes(oneTimeKey)) {
      return false;
    }
  }

  if (!meetsQuestPrerequisites(player, enemy.prerequisiteActiveQuests, enemy.prerequisiteCompletedQuests)) {
    return false;
  }

  return true;
}

/**
 * Checks if a ground item should be visible to a player
 */
export function isGroundItemVisibleToPlayer(groundItem: GroundItem, player: Player, locationId: string): boolean {
  if (groundItem.oneTime) {
    const oneTimeKey = `${locationId}.${groundItem.itemId}`;
    if (player.oneTimeItemsPickedUp.includes(oneTimeKey)) {
      return false;
    }
  }

  if (groundItem.lastPickedUp && groundItem.respawnTime) {
    const timeSincePickup = Date.now() - groundItem.lastPickedUp;
    if (timeSincePickup < groundItem.respawnTime) {
      return false;
    }
  }

  if (!meetsQuestPrerequisites(player, groundItem.prerequisiteActiveQuests, groundItem.prerequisiteCompletedQuests)) {
    return false;
  }

  return true;
}

/**
 * Checks if a player is currently in combat (enemy or PvP)
 */
export function isPlayerInCombat(player: Player): boolean {
  if (player.inPvPCombat) return true;

  const location = gameState.locations.get(player.location);
  if (!location) return false;

  return location.enemies.some(enemy =>
    enemy.currentFighters && enemy.currentFighters.includes(player.username)
  );
}

/**
 * Finds the enemy a player is currently fighting
 */
export function findEnemyPlayerIsFighting(player: Player): Enemy | null {
  const location = gameState.locations.get(player.location);
  if (!location) return null;

  return location.enemies.find(enemy =>
    enemy.currentFighters && enemy.currentFighters.includes(player.username)
  ) || null;
}

/**
 * Iterates over all enemies in all locations
 */
export function forEachEnemy(callback: (enemy: Enemy) => void): void {
  gameState.locations.forEach(location => {
    location.enemies.forEach(callback);
  });
}

/**
 * Calculates total damage for a player including equipment bonuses
 */
export function calculatePlayerDamage(player: Player): number {
  let totalDamage = player.damage;
  if (player.equipment.weapon) {
    totalDamage += player.equipment.weapon.stats?.damage || 0;
  }
  return totalDamage;
}

/**
 * Calculates total defense for a player including equipment bonuses
 */
export function calculatePlayerDefense(player: Player): number {
  let totalDefense = player.defense;
  if (player.equipment.armor) {
    totalDefense += player.equipment.armor.stats?.defense || 0;
  }
  if (player.equipment.shield) {
    totalDefense += player.equipment.shield.stats?.defense || 0;
  }
  return totalDefense;
}

/**
 * Calculates total power for a player (health + damage + defense)
 */
export function calculatePlayerPower(player: Player): number {
  return player.health + calculatePlayerDamage(player) + calculatePlayerDefense(player);
}

/**
 * Randomizes a value within ±33% range
 */
export function randomizeValue(baseValue: number): number {
  if (baseValue <= 0) return 0;
  
  const minValue = Math.max(1, Math.floor(baseValue - baseValue / 3));
  const maxValue = Math.floor(baseValue + baseValue / 3);
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

/**
 * Cleans up expired dropped items from a location
 */
export function cleanupExpiredDroppedItems(location: Location): void {
  if (!location.droppedItems) return;

  const lifetime = gameState.defaults.droppedItems?.droppedItemLifetimeMs || 300000;
  const now = Date.now();

  location.droppedItems = location.droppedItems.filter(gi => {
    return (now - gi.droppedAt!) < lifetime;
  });
}

/**
 * Calculates XP required for a specific level
 */
export function calculateXPForLevel(level: number): number {
  const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
  const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
  
  let totalXP = 0;
  for (let i = 1; i <= level; i++) {
    totalXP += Math.floor(baseXP * Math.pow(multiplier, i - 1));
  }
  return totalXP;
}

/**
 * Checks if a player should level up and returns the new level
 */
export function checkLevelUp(player: Player): number {
  const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
  let newLevel = player.level;

  while (newLevel < maxLevel) {
    const xpNeeded = calculateXPForLevel(newLevel);
    if (player.experience >= xpNeeded) {
      newLevel++;
    } else {
      break;
    }
  }

  return newLevel;
}

/**
 * Applies level up bonuses to a player
 */
export function applyLevelUp(player: Player, newLevel: number): void {
  const levelsGained = newLevel - player.level;
  player.level = newLevel;
  player.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
  player.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
  player.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
  
  if (gameState.defaults.levelUp.fullHealOnLevelUp) {
    player.health = player.maxHealth;
  }
}

/**
 * Finds an item by partial name in a list
 */
export function findItemByName(items: Item[], searchName: string): Item | undefined {
  const search = searchName.toLowerCase();
  return items.find(item =>
    item.name.toLowerCase().includes(search) || item.id.toLowerCase() === search
  );
}
