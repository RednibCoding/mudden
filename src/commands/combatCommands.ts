/**
 * Combat-related commands (attack, examine)
 */
import { Player } from '../types';
import { gameState } from '../gameState';
import { isEnemyVisibleToPlayer, calculatePlayerDamage, calculatePlayerDefense, calculatePlayerPower } from '../utils';
import { handleAttackEnemy, handlePvPAttack } from '../combatSystem';

/**
 * Handles attack command - routes to enemy or PvP combat
 */
export function handleAttackCommand(socket: any, player: Player, targetName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'error', data: 'Location not found' });
    return;
  }

  // Check for player target first
  const targetPlayer = Array.from(gameState.players.values()).find(p =>
    p.username.toLowerCase().includes(targetName.toLowerCase()) &&
    p.location === player.location &&
    p.username !== player.username
  );

  if (targetPlayer) {
    if (!location.pvpAllowed) {
      socket.emit('message', {
        type: 'message',
        data: { text: 'PvP combat is not allowed in this area.', type: 'system' }
      });
      return;
    }
    handlePvPAttack(socket, player, targetPlayer);
    return;
  }

  // Find enemy
  const enemy = location.enemies.find(enemy =>
    enemy && enemy.name.toLowerCase().includes(targetName.toLowerCase()) &&
    isEnemyVisibleToPlayer(enemy, player, player.location)
  );

  if (!enemy) {
    socket.emit('message', {
      type: 'message',
      data: { text: `There is no ${targetName} here to attack.`, type: 'system' }
    });
    return;
  }

  handleAttackEnemy(socket, player, enemy);
}

/**
 * Handles examine command - examines items, players, or enemies
 */
export function handleExamineCommand(socket: any, player: Player, targetName: string): void {
  const searchName = targetName.toLowerCase();

  // Check for other players
  const otherPlayer = Array.from(gameState.players.values()).find(p =>
    p.username.toLowerCase().includes(searchName) &&
    p.location === player.location &&
    p.username !== player.username
  );

  if (otherPlayer) {
    examinePlayer(socket, player, otherPlayer);
    return;
  }

  // Check for enemies
  const location = gameState.locations.get(player.location);
  if (location) {
    const enemy = location.enemies.find(e =>
      e.name.toLowerCase().includes(searchName) &&
      e.health > 0 &&
      isEnemyVisibleToPlayer(e, player, player.location)
    );

    if (enemy) {
      examineEnemy(socket, player, enemy);
      return;
    }
  }

  // Check inventory
  const inventoryItem = player.inventory.find(item =>
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName
  );

  if (inventoryItem) {
    examineItem(socket, inventoryItem, false);
    return;
  }

  // Check equipped items
  const equipped = player.equipment;
  const equippedItems = [equipped.weapon, equipped.shield, equipped.armor].filter(Boolean);
  const equippedItem = equippedItems.find(item =>
    item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)
  );

  if (equippedItem) {
    examineItem(socket, equippedItem, true);
    return;
  }

  socket.emit('message', {
    type: 'message',
    data: { text: `You don't see '${targetName}' here.`, type: 'system' }
  });
}

/**
 * Examines a player
 */
function examinePlayer(socket: any, examiner: Player, target: Player): void {
  const myPower = calculatePlayerPower(examiner);
  const theirPower = calculatePlayerPower(target);
  const powerDiff = myPower - theirPower;

  let difficulty: string;
  if (powerDiff > 50) difficulty = 'trivial';
  else if (powerDiff > 25) difficulty = 'easy';
  else if (powerDiff > 0) difficulty = 'moderate';
  else if (powerDiff > -25) difficulty = 'challenging';
  else if (powerDiff > -50) difficulty = 'hard';
  else if (powerDiff > -100) difficulty = 'deadly';
  else difficulty = 'impossible';

  let text = `You examine ${target.username}...\n\n`;
  text += `Level ${target.level} adventurer\n`;
  text += `PvP Record: ${target.pvpWins || 0}W - ${target.pvpLosses || 0}L\n\n`;

  text += `Equipment:\n`;
  if (target.equipment.weapon) text += `  Weapon: ${target.equipment.weapon.name}\n`;
  if (target.equipment.armor) text += `  Armor: ${target.equipment.armor.name}\n`;
  if (target.equipment.shield) text += `  Shield: ${target.equipment.shield.name}\n`;
  if (!target.equipment.weapon && !target.equipment.armor && !target.equipment.shield) {
    text += `  None\n`;
  }

  text += `\nThis opponent appears to be ${difficulty}.`;

  socket.emit('message', { type: 'message', data: { text, type: 'info' } });
}

/**
 * Examines an enemy
 */
function examineEnemy(socket: any, player: Player, enemy: any): void {
  const playerTotalPower = calculatePlayerPower(player);
  const enemyPower = enemy.health + enemy.damage + enemy.defense;
  const powerDiff = playerTotalPower - enemyPower;

  let difficulty: string;
  if (powerDiff > 50) difficulty = 'trivial';
  else if (powerDiff > 25) difficulty = 'easy';
  else if (powerDiff > 0) difficulty = 'moderate';
  else if (powerDiff > -25) difficulty = 'challenging';
  else if (powerDiff > -50) difficulty = 'hard';
  else if (powerDiff > -100) difficulty = 'deadly';
  else difficulty = 'impossible';

  const text = `You consider ${enemy.name}... this enemy appears to be ${difficulty}.`;

  socket.emit('message', { type: 'message', data: { text, type: 'info' } });
}

/**
 * Examines an item
 */
function examineItem(socket: any, item: any, equipped: boolean): void {
  let text = `=== ${item.name}${equipped ? ' (equipped)' : ''} ===\n`;
  text += `${item.description}\n\n`;
  text += `Type: ${item.type}\n`;
  text += `Value: ${item.value} gold\n`;

  if (item.stats) {
    text += `\nStats:\n`;
    if (item.stats.damage) text += `  Damage: ${item.stats.damage}\n`;
    if (item.stats.defense) text += `  Defense: ${item.stats.defense}\n`;
    if (item.stats.health) text += `  Health: ${item.stats.health}\n`;
  }

  socket.emit('message', { type: 'message', data: { text, type: 'normal' } });
}
