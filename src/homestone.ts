/**
 * Homestone system for binding and teleportation
 */
import { Player } from './types';
import { gameState } from './gameState';
import { sendToPlayer, sendToLocation } from './messaging';
import { savePlayer } from './auth';
import { isPlayerInCombat } from './utils';

/**
 * Binds player's homestone to current location
 */
export function handleHomestoneBind(socket: any, player: Player): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'error', data: 'Location not found' });
    return;
  }

  if (!location.homestone) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'You cannot bind your homestone at this location.', type: 'system' }
    });
    return;
  }

  player.homestoneLocation = player.location;
  savePlayer(player);

  socket.emit('message', {
    type: 'message',
    data: { text: `You bind your homestone to ${location.name}. You will respawn here if you die.`, type: 'info' }
  });

  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${player.username} binds their homestone here.`, type: 'system' }
  }, player.username);
}

/**
 * Shows player's current homestone location
 */
export function handleHomestoneWhere(socket: any, player: Player): void {
  const homestoneLocation = gameState.locations.get(player.homestoneLocation);
  if (!homestoneLocation) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'Your homestone location could not be found. It may have been removed.', type: 'error' }
    });
    return;
  }

  socket.emit('message', {
    type: 'message',
    data: { text: `Your homestone is bound to: ${homestoneLocation.name}`, type: 'info' }
  });
}

/**
 * Teleports player to their homestone location
 */
export function handleHomestoneRecall(socket: any, player: Player, onSuccess?: () => void): void {
  if (isPlayerInCombat(player)) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'You cannot use your homestone while in combat!', type: 'system' }
    });
    return;
  }

  const homestoneLocation = gameState.locations.get(player.homestoneLocation);
  if (!homestoneLocation) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'Your homestone location could not be found. It may have been removed.', type: 'error' }
    });
    return;
  }

  if (player.location === player.homestoneLocation) {
    socket.emit('message', {
      type: 'message',
      data: { text: 'You are already at your homestone location.', type: 'system' }
    });
    return;
  }

  const oldLocation = player.location;

  player.location = player.homestoneLocation;
  savePlayer(player);

  sendToLocation(oldLocation, {
    type: 'message',
    data: { text: `${player.username} disappears in a swirl of magical energy.`, type: 'info' }
  }, player.username);

  socket.emit('message', {
    type: 'message',
    data: { text: `You focus on your homestone and feel the world shift around you...`, type: 'info' }
  });

  sendToLocation(player.homestoneLocation, {
    type: 'message',
    data: { text: `${player.username} appears in a swirl of magical energy.`, type: 'info' }
  }, player.username);

  if (onSuccess) {
    setTimeout(() => onSuccess(), 1000);
  }
}
