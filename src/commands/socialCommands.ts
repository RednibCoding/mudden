/**
 * Social and communication commands
 */
import { Player } from '../types';
import { gameState, activePlayers } from '../gameState';
import { sendToPlayer, sendToLocation } from '../messaging';
import { savePlayer, playerExists } from '../auth';

/**
 * Handles saying a message to the current room
 */
export function handleSay(socket: any, player: Player, message: string): void {
  if (!message) {
    socket.emit('message', { type: 'system', data: 'Say what?' });
    return;
  }

  const text = `${player.username} says: ${message}`;
  sendToLocation(player.location, {
    type: 'message',
    data: { text, type: 'chat' }
  });
}

/**
 * Handles whispering to another player
 */
export function handleWhisper(socket: any, player: Player, target: string, message: string): void {
  if (!target || !message) {
    socket.emit('message', { type: 'system', data: 'Whisper to whom what?' });
    return;
  }

  let targetPlayer = null;
  let actualPlayerName = null;
  for (const [playerName, playerData] of gameState.players.entries()) {
    if (playerName.toLowerCase() === target.toLowerCase()) {
      targetPlayer = playerData;
      actualPlayerName = playerName;
      break;
    }
  }

  if (!targetPlayer) {
    socket.emit('message', { type: 'system', data: 'Player not found' });
    return;
  }

  targetPlayer.lastWhisperFrom = player.username;
  savePlayer(targetPlayer);

  sendToPlayer(actualPlayerName!, {
    type: 'message',
    data: { text: `${player.username} whispers: ${message}`, type: 'whisper' }
  });

  socket.emit('message', {
    type: 'message',
    data: { text: `You whisper to ${actualPlayerName}: ${message}`, type: 'whisper' }
  });
}

/**
 * Handles replying to the last whisper
 */
export function handleReply(socket: any, player: Player, message: string): void {
  if (!message) {
    socket.emit('message', { type: 'system', data: 'Reply with what?' });
    return;
  }

  if (!player.lastWhisperFrom) {
    socket.emit('message', { type: 'system', data: 'No one has whispered to you yet.' });
    return;
  }

  handleWhisper(socket, player, player.lastWhisperFrom, message);
}

/**
 * Handles friend management
 */
export function handleFriend(socket: any, player: Player, subcommand: string, target: string): void {
  if (!player.friends) {
    player.friends = [];
  }

  if (!subcommand) {
    if (player.friends.length === 0) {
      socket.emit('message', {
        type: 'message',
        data: { text: 'You have no friends in your friend list.', type: 'info' }
      });
      return;
    }

    const onlineFriends: string[] = [];
    const offlineFriends: string[] = [];

    player.friends.forEach(friendName => {
      const isOnline = Array.from(activePlayers.values()).some(
        username => username.toLowerCase() === friendName.toLowerCase()
      );
      const displayName = friendName.charAt(0).toUpperCase() + friendName.slice(1);
      if (isOnline) {
        onlineFriends.push(`- ${displayName} (Online)`);
      } else {
        offlineFriends.push(`- ${displayName} (Offline)`);
      }
    });

    const friendList = [...onlineFriends, ...offlineFriends].join('\n');
    socket.emit('message', {
      type: 'message',
      data: { text: `=== Friend List ===\n${friendList}`, type: 'info' }
    });
    return;
  }

  switch (subcommand.toLowerCase()) {
    case 'add':
      if (!target) {
        socket.emit('message', { type: 'system', data: 'Add whom to your friend list?' });
        return;
      }

      if (!playerExists(target)) {
        socket.emit('message', { type: 'system', data: 'Player not found.' });
        return;
      }

      if (target.toLowerCase() === player.username.toLowerCase()) {
        socket.emit('message', { type: 'system', data: 'You cannot add yourself as a friend.' });
        return;
      }

      if (player.friends.some(f => f.toLowerCase() === target.toLowerCase())) {
        socket.emit('message', { type: 'system', data: `${target} is already in your friend list.` });
        return;
      }

      player.friends.push(target);
      savePlayer(player);
      const displayNameAdd = target.charAt(0).toUpperCase() + target.slice(1);
      socket.emit('message', {
        type: 'message',
        data: { text: `${displayNameAdd} has been added to your friend list.`, type: 'success' }
      });

      const playerDisplayName = player.username.charAt(0).toUpperCase() + player.username.slice(1);
      sendToPlayer(target, {
        type: 'message',
        data: { text: `${playerDisplayName} added you as a friend.`, type: 'system' }
      });
      break;

    case 'remove':
    case 'delete':
      if (!target) {
        socket.emit('message', { type: 'system', data: 'Remove whom from your friend list?' });
        return;
      }

      const friendIndex = player.friends.findIndex(f => f.toLowerCase() === target.toLowerCase());
      if (friendIndex === -1) {
        socket.emit('message', { type: 'system', data: `${target} is not in your friend list.` });
        return;
      }

      const removedFriend = player.friends[friendIndex];
      player.friends.splice(friendIndex, 1);
      savePlayer(player);
      const displayNameRemove = removedFriend.charAt(0).toUpperCase() + removedFriend.slice(1);
      socket.emit('message', {
        type: 'message',
        data: { text: `${displayNameRemove} has been removed from your friend list.`, type: 'info' }
      });
      break;

    default:
      socket.emit('message', {
        type: 'system',
        data: 'Usage: friend [add|remove] <playername> or just "friend" to list friends.'
      });
  }
}

/**
 * Shows who is online
 */
export function handleWho(socket: any): void {
  const playerList = Array.from(gameState.players.keys()).join(', ');
  socket.emit('message', {
    type: 'message',
    data: { text: `=== Online Players ===\n${playerList}`, type: 'normal' }
  });
}
