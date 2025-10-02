/**
 * Movement and navigation system
 */
import { Player } from './types';
import { gameState } from './gameState';
import { sendToLocation } from './messaging';
import { savePlayer } from './auth';
import { forEachEnemy, isPlayerInCombat } from './utils';
import { isEnemyInLocation } from './messaging';

/**
 * Handles player movement in a direction
 */
export function handlePlayerMove(
  socket: any,
  player: Player,
  direction: string,
  onSuccess?: () => void
): boolean {
  const currentLocation = gameState.locations.get(player.location);
  if (!currentLocation) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return false;
  }

  const exit = currentLocation.exits[direction.toLowerCase()];
  if (!exit) {
    socket.emit('message', {
      type: 'message',
      data: { text: `You cannot go ${direction} from here.`, type: 'system' }
    });
    return false;
  }

  const newLocation = gameState.locations.get(exit);
  if (!newLocation) {
    socket.emit('message', { type: 'error', data: 'Destination not found' });
    return false;
  }

  const oldLocation = player.location;

  // Cancel trades when moving
  cancelPlayerTrades(socket, player);

  // Move player
  player.location = exit;
  player.inPvPCombat = false;

  gameState.players.set(player.username, player);

  // Notify old location
  sendToLocation(oldLocation, {
    type: 'message',
    data: { text: `${player.username} leaves ${direction}.`, type: 'system' }
  }, player.username);

  // Notify new location
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} arrives.`, type: 'system' }
  }, player.username);

  if (onSuccess) {
    onSuccess();
  }

  return true;
}

/**
 * Cancels any active trades when a player moves
 */
function cancelPlayerTrades(socket: any, player: Player): void {
  if (player.activeTrade) {
    // Will be implemented with trade system
    // handleTradeCancel(socket, player);
    socket.emit('message', {
      type: 'message',
      data: { text: 'Trade cancelled (you moved to a different room).', type: 'info' }
    });
  }

  // Check for trades with this player
  gameState.players.forEach((otherPlayer, username) => {
    if (otherPlayer.activeTrade &&
        otherPlayer.activeTrade.with.toLowerCase() === player.username.toLowerCase()) {
      // Trade will be cancelled in trade system
    }
  });
}

/**
 * Handles player fleeing from combat
 */
export function handleFlee(socket: any, player: Player): boolean {
  const currentLocation = gameState.locations.get(player.location);
  if (!currentLocation) {
    socket.emit('message', { type: 'error', data: 'Invalid location!' });
    return false;
  }

  if (!isPlayerInCombat(player)) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'You are not in combat.', type: 'status' }
    });
    return false;
  }

  const fleeChance = Math.random();
  if (fleeChance <= gameState.defaults.combat.fleeSuccessChance) {
    // Remove from enemy combat
    forEachEnemy(enemy => {
      if (isEnemyInLocation(enemy, player.location)) {
        const fighterIndex = enemy.currentFighters.indexOf(player.username);
        if (fighterIndex > -1) {
          enemy.currentFighters.splice(fighterIndex, 1);
        }
      }
    });

    // Move to random exit
    const exits = Object.keys(currentLocation.exits);
    if (exits.length > 0) {
      const randomExit = exits[Math.floor(Math.random() * exits.length)];
      const oldLocation = player.location;
      player.location = currentLocation.exits[randomExit];

      player.inPvPCombat = false;

      sendToLocation(oldLocation, {
        type: 'message',
        data: { text: `${player.username} flees ${randomExit}!`, type: 'system' }
      });

      sendToLocation(player.location, {
        type: 'message',
        data: { text: `${player.username} arrives, fleeing from combat!`, type: 'system' }
      }, player.username);

      savePlayer(player);
      return true;
    } else {
      socket.emit('message', {
        type: 'error',
        data: 'There is nowhere to flee to!'
      });
      return false;
    }
  } else {
    sendToLocation(player.location, {
      type: 'message',
      data: { text: `${player.username} tries to flee but fails!`, type: 'system' }
    });
    return false;
  }
}
