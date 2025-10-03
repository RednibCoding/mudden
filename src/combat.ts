// Combat system - Shared enemy combat (Diku pattern)

import { Player, Enemy } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';
import { savePlayer } from './player';

// Check if player is in combat
export function isInCombat(player: Player): boolean {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location || !location.enemies) {
    return false;
  }
  
  // Check if player is in any enemy's fighters list
  for (const enemy of location.enemies) {
    if (enemy.fighters.includes(player.username)) {
      return true;
    }
  }
  
  return false;
}

// Attack command
export function attack(player: Player, targetName: string): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  if (!location.enemies || location.enemies.length === 0) {
    send(player, 'There are no enemies here.', 'error');
    return;
  }
  
  // Find enemy by name (case-insensitive partial match)
  const enemyName = targetName.toLowerCase();
  const enemy = location.enemies.find(e => 
    e.name.toLowerCase().includes(enemyName) || 
    e.id.toLowerCase().includes(enemyName)
  );
  
  if (!enemy) {
    send(player, `You don't see "${targetName}" here.`, 'error');
    return;
  }
  
  // Add player to fighters list if not already fighting
  if (!enemy.fighters.includes(player.username)) {
    enemy.fighters.push(player.username);
    broadcast(player.location, `${player.username} attacks ${enemy.name}!`, 'combat');
  }
  
  // Calculate player damage (base + weapon + accessory)
  const weaponDamage = player.equipped.weapon?.damage || 0;
  const accessoryDamage = player.equipped.accessory?.damage || 0;
  const totalDamage = player.damage + weaponDamage + accessoryDamage;
  
  // Calculate damage dealt (after enemy defense)
  const damageDealt = Math.max(1, totalDamage - enemy.defense);
  enemy.health -= damageDealt;
  
  send(player, `You hit ${enemy.name} for ${damageDealt} damage.`, 'combat');
  broadcast(player.location, `${player.username} hits ${enemy.name} for ${damageDealt} damage.`, 'combat', player.id);
  
  // Check if enemy died
  if (enemy.health <= 0) {
    handleEnemyDeath(player, enemy, location.id);
    return;
  }
  
  // Enemy attacks back
  enemyAttack(player, enemy);
}

// Enemy attacks player
function enemyAttack(player: Player, enemy: Enemy): void {
  // Calculate player defense (base + armor + shield + accessory)
  const armorDefense = player.equipped.armor?.defense || 0;
  const shieldDefense = player.equipped.shield?.defense || 0;
  const accessoryDefense = player.equipped.accessory?.defense || 0;
  const totalDefense = player.defense + armorDefense + shieldDefense + accessoryDefense;
  
  // Calculate damage taken (after player defense)
  const damageTaken = Math.max(1, enemy.damage - totalDefense);
  player.health -= damageTaken;
  
  send(player, `${enemy.name} hits you for ${damageTaken} damage.`, 'combat');
  broadcast(player.location, `${enemy.name} hits ${player.username} for ${damageTaken} damage.`, 'combat', player.id);
  
  // Check if player died
  if (player.health <= 0) {
    handlePlayerDeath(player);
  }
}

// Handle enemy death
function handleEnemyDeath(player: Player, enemy: Enemy, locationId: string): void {
  const location = gameState.gameData.locations.get(locationId);
  
  if (!location || !location.enemies) {
    return;
  }
  
  // Calculate rewards (split among all fighters)
  const numFighters = enemy.fighters.length;
  const goldEach = Math.floor(enemy.gold / numFighters);
  const xpEach = Math.floor(enemy.xp / numFighters);
  
  // Distribute rewards to all fighters
  enemy.fighters.forEach(username => {
    const fighter = gameState.players.get(username);
    if (!fighter) return;
    
    fighter.gold += goldEach;
    fighter.xp += xpEach;
    
    send(fighter, `You gained ${goldEach}g and ${xpEach}xp!`, 'loot');
    
    // Material drops (each fighter rolls independently)
    if (enemy.materialDrops) {
      for (const [materialId, drop] of Object.entries(enemy.materialDrops)) {
        if (Math.random() <= drop.chance) {
          const [min, max] = drop.amount.split('-').map(Number);
          const amount = Math.floor(Math.random() * (max - min + 1)) + min;
          const material = gameState.gameData.materials.get(materialId);
          
          if (material) {
            fighter.materials[materialId] = (fighter.materials[materialId] || 0) + amount;
            send(fighter, `You obtain ${amount}x ${material.name}!`, 'loot');
          }
        }
      }
    }
    
    // Check for level up
    checkLevel(fighter);
    
    // Save player
    savePlayer(fighter);
  });
  
  // Announce death
  broadcast(locationId, `${enemy.name} dies!`, 'combat');
  
  // Remove enemy from location
  const index = location.enemies.indexOf(enemy);
  if (index > -1) {
    location.enemies.splice(index, 1);
  }
  
  // Schedule respawn
  const respawnTime = gameState.gameData.config.gameplay.enemyRespawnTime;
  setTimeout(() => {
    respawnEnemy(locationId, enemy.id);
  }, respawnTime);
}

// Respawn enemy
function respawnEnemy(locationId: string, enemyId: string): void {
  const location = gameState.gameData.locations.get(locationId);
  const enemyTemplate = gameState.gameData.enemies.get(enemyId);
  
  if (!location || !enemyTemplate) {
    return;
  }
  
  // Create fresh enemy instance
  const newEnemy: Enemy = {
    ...enemyTemplate,
    health: enemyTemplate.maxHealth,
    fighters: []
  };
  
  // Add to location
  if (!location.enemies) {
    location.enemies = [];
  }
  
  location.enemies.push(newEnemy);
  
  // Announce respawn to players in location
  broadcast(locationId, `${newEnemy.name} appears!`, 'system');
}

// Handle player death
function handlePlayerDeath(player: Player): void {
  const config = gameState.gameData.config;
  const oldLocation = player.location;
  
  // Calculate gold loss
  const goldLost = Math.floor(player.gold * config.gameplay.deathGoldLossPct);
  player.gold -= goldLost;
  
  // Remove from all enemy fighters lists in current location
  const location = gameState.gameData.locations.get(oldLocation);
  if (location && location.enemies) {
    for (const enemy of location.enemies) {
      const index = enemy.fighters.indexOf(player.username);
      if (index > -1) {
        enemy.fighters.splice(index, 1);
      }
    }
  }
  
  // Restore health and mana
  player.health = player.maxHealth;
  player.mana = player.maxMana;
  
  // Respawn at configured location
  player.location = config.gameplay.deathRespawnLocation;
  
  // Announce death
  send(player, `\nYou died! Lost ${goldLost} gold.`, 'error');
  broadcast(oldLocation, `${player.username} has died!`, 'system', player.id);
  
  // Announce respawn
  broadcast(player.location, `${player.username} has respawned here.`, 'system', player.id);
  
  // Save player
  savePlayer(player);
  
  // Show respawn location
  const { look } = require('./movement');
  look(player);
}

// Check for level up
export function checkLevel(player: Player): void {
  const config = gameState.gameData.config;
  const xpNeeded = getXpNeeded(player.level + 1, config);
  
  if (player.xp >= xpNeeded) {
    player.level++;
    player.xp -= xpNeeded; // Carry over excess XP
    
    // Stat increases per level
    player.maxHealth += config.progression.healthPerLevel;
    player.maxMana += config.progression.manaPerLevel;
    player.damage += config.progression.damagePerLevel;
    player.defense += config.progression.defensePerLevel;
    
    // Full restore on level up
    player.health = player.maxHealth;
    player.mana = player.maxMana;
    
    send(player, `\nLevel up! You are now level ${player.level}.`, 'success');
    send(player, `+${config.progression.healthPerLevel} HP, +${config.progression.manaPerLevel} Mana, +${config.progression.damagePerLevel} Damage, +${config.progression.defensePerLevel} Defense`, 'success');
    broadcast(player.location, `${player.username} has reached level ${player.level}!`, 'system', player.id);
    
    // Save player
    savePlayer(player);
  }
}

// Calculate XP needed for next level
function getXpNeeded(level: number, config: any): number {
  const base = config.progression.baseXpPerLevel;
  const mult = config.progression.xpMultiplier;
  return Math.floor(base * Math.pow(mult, level - 1));
}

// Flee command (combat only)
export function flee(player: Player): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // Check if player is in combat
  if (!isInCombat(player)) {
    send(player, "You're not fighting anything!", 'error');
    return;
  }
  
  // Success chance from config
  const fleeChance = gameState.gameData.config.gameplay.fleeSuccessChance;
  if (Math.random() > fleeChance) {
    send(player, 'You failed to flee!', 'error');
    return;
  }
  
  // Remove from all enemy fighter lists
  if (location.enemies) {
    for (const enemy of location.enemies) {
      const index = enemy.fighters.indexOf(player.username);
      if (index > -1) {
        enemy.fighters.splice(index, 1);
      }
    }
  }
  
  // Pick random exit
  const exits = Object.keys(location.exits);
  if (exits.length === 0) {
    send(player, "There's nowhere to flee to!", 'error');
    return;
  }
  
  const randomExit = exits[Math.floor(Math.random() * exits.length)];
  const destination = location.exits[randomExit];
  
  // Flee!
  const oldLocation = player.location;
  player.location = destination;
  
  send(player, `You flee ${randomExit}!`, 'success');
  broadcast(oldLocation, `${player.username} flees ${randomExit}!`, 'system', player.id);
  broadcast(destination, `${player.username} arrives in a hurry!`, 'system', player.id);
  
  // Auto-look at new location
  const { look } = require('./movement');
  look(player);
}
