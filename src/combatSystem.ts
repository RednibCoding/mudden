/**
 * Combat system for enemy and PvP combat
 */
import { Player, Enemy } from './types';
import { gameState, activePlayers } from './gameState';
import { sendToPlayer, sendToLocation, sendToEnemyLocations, getEnemyLocation, isEnemyInLocation } from './messaging';
import { savePlayer } from './auth';
import {
  calculatePlayerDamage,
  calculatePlayerDefense,
  calculatePlayerPower,
  randomizeValue,
  checkLevelUp,
  applyLevelUp,
  isEnemyVisibleToPlayer
} from './utils';
import { updateQuestProgress } from './questSystem';

/**
 * Handles enemy death, rewards distribution, and respawn
 */
export function handleEnemyDeath(socket: any, player: Player, enemy: Enemy): void {
  const location = gameState.locations.get(player.location);
  if (!location) return;

  sendToEnemyLocations(enemy, {
    type: 'message',
    data: { text: `${enemy.name} has been defeated!`, type: 'combat-death' }
  });

  const fighters = enemy.currentFighters || [];

  if (fighters.length > 0) {
    const baseGold = enemy.gold || 0;
    const randomGold = randomizeValue(baseGold);
    const goldPerFighter = Math.floor(randomGold / fighters.length);

    const baseExp = enemy.experience || 0;
    const expPerFighter = baseExp > 0 ? Math.max(1, Math.floor(baseExp / fighters.length)) : 0;

    fighters.forEach(fighterName => {
      const fighter = gameState.players.get(fighterName);
      if (fighter) {
        fighter.gold += goldPerFighter;
        fighter.experience += expPerFighter;

        const newLevel = checkLevelUp(fighter);
        if (newLevel > fighter.level) {
          applyLevelUp(fighter, newLevel);
          sendToPlayer(fighterName, {
            type: 'message',
            data: { text: `You gained a level! You are now level ${newLevel}.`, type: 'success' }
          });
        }

        const rewards = [];
        if (goldPerFighter > 0) rewards.push(`${goldPerFighter} gold`);
        if (expPerFighter > 0) rewards.push(`${expPerFighter} experience`);

        if (rewards.length > 0) {
          sendToPlayer(fighterName, {
            type: 'message',
            data: { text: `You gained ${rewards.join(' and ')}!`, type: 'success' }
          });
        }

        updateQuestProgress(fighter, 'kill', enemy.id, fighterName);

        if (enemy.oneTime) {
          const enemyLocationId = getEnemyLocation(enemy);
          if (enemyLocationId) {
            const oneTimeKey = `${enemyLocationId}.${enemy.id}`;
            if (!fighter.oneTimeEnemiesDefeated.includes(oneTimeKey)) {
              fighter.oneTimeEnemiesDefeated.push(oneTimeKey);
            }
          }
        }

        savePlayer(fighter);
      }
    });

    distributeItemDrops(enemy, fighters);
  }

  const enemyIndex = location.enemies.indexOf(enemy);
  if (enemyIndex > -1) {
    location.enemies.splice(enemyIndex, 1);
  }

  if (!enemy.oneTime) {
    setTimeout(() => {
      const enemyTemplate = gameState.enemies.get(enemy.id);
      if (enemyTemplate && location) {
        const newEnemy: Enemy = {
          ...enemyTemplate,
          health: enemyTemplate.maxHealth,
          currentFighters: []
        };
        location.enemies.push(newEnemy);

        sendToLocation(player.location, {
          type: 'message',
          data: { text: `${newEnemy.name} appears!`, type: 'system' }
        });
      }
    }, enemy.respawnTime || 60000);
  }
}

/**
 * Distributes item drops from an enemy to fighters
 */
function distributeItemDrops(enemy: Enemy, fighters: string[]): void {
  if (!enemy.drops || enemy.drops.length === 0) return;

  enemy.drops.forEach(drop => {
    if (Math.random() <= drop.dropChance) {
      const item = gameState.items.get(drop.itemId);
      if (item) {
        const randomFighter = fighters[Math.floor(Math.random() * fighters.length)];
        const fighter = gameState.players.get(randomFighter);
        if (fighter) {
          const maxSlots = gameState.defaults.player.maxInventorySlots;
          if (fighter.inventory.length < maxSlots) {
            fighter.inventory.push({ ...item });
            sendToPlayer(randomFighter, {
              type: 'message',
              data: { text: `You found: ${item.name}!`, type: 'success' }
            });
            sendToEnemyLocations(enemy, {
              type: 'message',
              data: { text: `${randomFighter} found ${item.name}!`, type: 'system' }
            }, randomFighter);
            savePlayer(fighter);
          }
        }
      }
    }
  });
}

/**
 * Handles player attacking an enemy
 */
export function handleAttackEnemy(socket: any, player: Player, enemy: Enemy): void {
  if (enemy.health <= 0) {
    socket.emit('message', {
      type: 'message',
      data: { text: `The ${enemy.name} is already dead.`, type: 'system' }
    });
    return;
  }

  if (!enemy.currentFighters.includes(player.username)) {
    enemy.currentFighters.push(player.username);
  }

  const totalDamage = calculatePlayerDamage(player);
  const randomDamage = randomizeValue(totalDamage);
  const actualDamage = Math.max(1, randomDamage - (enemy.defense || 0));
  
  enemy.health -= actualDamage;

  const healthDisplay = enemy.health <= 0 ? '(dead)' : `(${enemy.health}/${enemy.maxHealth})`;
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} hits ${enemy.name} for ${actualDamage} damage! ${healthDisplay}`, type: 'player-combat' }
  });

  if (enemy.health <= 0) {
    handleEnemyDeath(socket, player, enemy);
  } else {
    scheduleEnemyCounterAttack(socket, player, enemy);
  }
}

/**
 * Schedules an enemy counter-attack
 */
function scheduleEnemyCounterAttack(socket: any, player: Player, enemy: Enemy): void {
  setTimeout(() => {
    if (enemy.health > 0 && enemy.currentFighters.length > 0) {
      const targetName = enemy.currentFighters[Math.floor(Math.random() * enemy.currentFighters.length)];
      const target = gameState.players.get(targetName);

      if (target && isEnemyInLocation(enemy, target.location)) {
        const enemyDamage = randomizeValue(enemy.damage || 0);
        const defense = calculatePlayerDefense(target);
        const actualDamage = Math.max(1, enemyDamage - defense);
        
        target.health -= actualDamage;

        const targetHealthDisplay = target.health <= 0 ? '(dead)' : `(${target.health}/${target.maxHealth})`;
        sendToEnemyLocations(enemy, {
          type: 'message',
          data: { text: `${enemy.name} hits ${target.username} for ${actualDamage} damage! ${targetHealthDisplay}`, type: 'enemy-combat' }
        });

        if (target.health <= 0) {
          handlePlayerDeath(socket, target, enemy);
        }
      }
    }
  }, gameState.defaults.combat.enemyCounterAttackDelayMs);

  setTimeout(() => {
    if (enemy.health > 0 && player.health > gameState.defaults.combat.playerDeathHealthThreshold &&
        isEnemyInLocation(enemy, player.location)) {
      if (enemy.currentFighters.includes(player.username)) {
        handleAttackEnemy(socket, player, enemy);
      }
    }
  }, gameState.defaults.combat.combatRoundDelayMs);
}

/**
 * Handles player death from enemy combat
 */
function handlePlayerDeath(socket: any, player: Player, enemy: Enemy): void {
  const oldLocation = player.location;

  const fighterIndex = enemy.currentFighters.indexOf(player.username);
  if (fighterIndex > -1) {
    enemy.currentFighters.splice(fighterIndex, 1);
  }

  sendToLocation(oldLocation, {
    type: 'message',
    data: { text: `${player.username} has been slain and vanishes in a flash of light!`, type: 'combat-death' }
  }, player.username);

  sendToPlayer(player.username, {
    type: 'message',
    data: { text: 'You have died! You awaken at your homestone, fully healed.', type: 'system' }
  });

  setTimeout(() => {
    player.health = player.maxHealth;
    player.location = player.homestoneLocation;

    sendToLocation(player.homestoneLocation, {
      type: 'message',
      data: { text: `${player.username} materializes in a flash of light, looking shaken.`, type: 'system' }
    }, player.username);

    const targetSocket = Array.from(activePlayers.entries())
      .find(([_, user]) => user === player.username)?.[0];
    if (targetSocket) {
      const sock = (socket as any).server.sockets.sockets.get(targetSocket);
      if (sock) {
        // Player will need to look around manually after respawn
      }
    }

    savePlayer(player);
  }, 1000);
}

/**
 * Handles PvP combat between two players
 */
export function handlePvPAttack(socket: any, attacker: Player, defender: Player): void {
  attacker.inPvPCombat = true;
  defender.inPvPCombat = true;

  const attackerDamage = calculatePlayerDamage(attacker);
  const randomDamage = randomizeValue(attackerDamage);
  const defenderDefense = calculatePlayerDefense(defender);
  const actualDamage = Math.max(1, randomDamage - defenderDefense);

  defender.health -= actualDamage;

  const healthDisplay = defender.health <= 0 ? '(dead)' : `(${defender.health}/${defender.maxHealth})`;
  sendToLocation(attacker.location, {
    type: 'message',
    data: { text: `${attacker.username} hits ${defender.username} for ${actualDamage} damage! ${healthDisplay}`, type: 'pvp-combat' }
  });

  if (defender.health <= 0) {
    handlePvPVictory(attacker, defender);
  } else {
    schedulePvPCounterAttack(socket, attacker, defender);
  }
}

/**
 * Handles PvP victory
 */
function handlePvPVictory(winner: Player, loser: Player): void {
  const powerDiff = calculatePlayerPower(winner) - calculatePlayerPower(loser);
  const expGain = calculatePvPExperience(powerDiff);
  const goldLooted = Math.floor(loser.gold * gameState.defaults.pvp.goldLootPercentage);

  loser.gold -= goldLooted;
  winner.gold += goldLooted;
  winner.experience += expGain;

  winner.pvpWins = (winner.pvpWins || 0) + 1;
  loser.pvpLosses = (loser.pvpLosses || 0) + 1;

  sendToLocation(winner.location, {
    type: 'message',
    data: { text: `${loser.username} has been defeated by ${winner.username}!`, type: 'player-death' }
  });

  sendToPlayer(winner.username, {
    type: 'message',
    data: { text: `You defeated ${loser.username}! You gain ${expGain} experience and loot ${goldLooted} gold!`, type: 'success' }
  });

  sendToPlayer(loser.username, {
    type: 'message',
    data: { text: `You have been defeated! You lost ${goldLooted} gold.`, type: 'death' }
  });

  winner.inPvPCombat = false;
  loser.inPvPCombat = false;

  const newLevel = checkLevelUp(winner);
  if (newLevel > winner.level) {
    applyLevelUp(winner, newLevel);
    sendToPlayer(winner.username, {
      type: 'message',
      data: { text: `Congratulations! You are now level ${winner.level}!`, type: 'success' }
    });
  }

  setTimeout(() => {
    loser.health = loser.maxHealth;
    const respawnLocation = loser.homestoneLocation || gameState.defaults.player.startingLocation;
    loser.location = respawnLocation;

    sendToPlayer(loser.username, {
      type: 'message',
      data: { text: `You respawn at ${gameState.locations.get(respawnLocation)?.name || respawnLocation}.`, type: 'system' }
    });

    sendToLocation(respawnLocation, {
      type: 'message',
      data: { text: `${loser.username} appears.`, type: 'system' }
    }, loser.username);

    savePlayer(loser);
  }, 1000);

  savePlayer(winner);
}

/**
 * Schedules PvP counter-attack
 */
function schedulePvPCounterAttack(socket: any, attacker: Player, defender: Player): void {
  setTimeout(() => {
    if (defender.health > 0) {
      const defenderDamage = calculatePlayerDamage(defender);
      const counterDamage = randomizeValue(defenderDamage);
      const attackerDefense = calculatePlayerDefense(attacker);
      const actualDamage = Math.max(1, counterDamage - attackerDefense);

      attacker.health -= actualDamage;

      const attackerHealthDisplay = attacker.health <= 0 ? '(dead)' : `(${attacker.health}/${attacker.maxHealth})`;
      sendToLocation(attacker.location, {
        type: 'message',
        data: { text: `${defender.username} hits ${attacker.username} for ${actualDamage} damage! ${attackerHealthDisplay}`, type: 'pvp-combat' }
      });

      if (attacker.health <= 0) {
        handlePvPVictory(defender, attacker);
      } else {
        savePlayer(attacker);
        savePlayer(defender);
      }
    }
  }, gameState.defaults.combat.enemyCounterAttackDelayMs);

  setTimeout(() => {
    if (attacker.health > gameState.defaults.combat.playerDeathHealthThreshold &&
        defender.health > gameState.defaults.combat.playerDeathHealthThreshold &&
        attacker.location === defender.location &&
        attacker.inPvPCombat && defender.inPvPCombat) {
      handlePvPAttack(socket, attacker, defender);
    }
  }, gameState.defaults.combat.combatRoundDelayMs);
}

/**
 * Calculates PvP experience based on power difference
 */
function calculatePvPExperience(powerDiff: number): number {
  const pvpConfig = gameState.defaults.pvp;
  
  if (powerDiff > 50) return pvpConfig.experienceByDifficulty.trivial;
  if (powerDiff > 25) return pvpConfig.experienceByDifficulty.easy;
  if (powerDiff > 0) return pvpConfig.experienceByDifficulty.moderate;
  if (powerDiff > -25) return pvpConfig.experienceByDifficulty.challenging;
  if (powerDiff > -50) return pvpConfig.experienceByDifficulty.hard;
  if (powerDiff > -100) return pvpConfig.experienceByDifficulty.deadly;
  return pvpConfig.experienceByDifficulty.impossible;
}
