// Social system - Friend management

import { Player } from './types';
import { send } from './messaging';
import { gameState } from './game';

export function addFriend(player: Player, username: string): void {
  // Can't befriend yourself
  if (username.toLowerCase() === player.username.toLowerCase()) {
    send(player, "You can't befriend yourself!", 'error');
    return;
  }
  
  // Check if already friends
  if (player.friends.includes(username)) {
    send(player, `${username} is already your friend.`, 'error');
    return;
  }
  
  // Check if player exists (must be online for now)
  const target = gameState.players.get(username);
  if (!target) {
    send(player, 'Player not found. They must be online to add as friend.', 'error');
    return;
  }
  
  // Add friend
  player.friends.push(username);
  send(player, `You are now friends with ${username}.`, 'success');
  send(target, `${player.displayName} has added you as a friend.`, 'info');
}

export function removeFriend(player: Player, username: string): void {
  // Check if they are friends
  const index = player.friends.indexOf(username);
  if (index === -1) {
    send(player, `${username} is not your friend.`, 'error');
    return;
  }
  
  // Remove friend
  player.friends.splice(index, 1);
  send(player, `${username} has been removed from your friends list.`, 'success');
}

export function listFriends(player: Player): void {
  if (player.friends.length === 0) {
    send(player, 'You have no friends yet. Use "friend add <name>" to add friends.', 'info');
    return;
  }
  
  let message = '\n=== Friends ===\n';
  
  player.friends.forEach(username => {
    const friend = gameState.players.get(username);
    if (friend && friend.socket) {
      // Online: use their displayName
      message += `  ${friend.displayName} [Online]\n`;
    } else {
      // Offline: capitalize the username
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      message += `  ${displayName} [Offline]\n`;
    }
  });
  
  message += `\nTotal: ${player.friends.length} friend(s)\n`;
  send(player, message, 'info');
}

export function handleFriendCommand(player: Player, args: string[]): void {
  if (args.length === 0) {
    // No args = list friends
    listFriends(player);
    return;
  }
  
  const subcommand = args[0].toLowerCase();
  const username = args[1];
  
  switch (subcommand) {
    case 'add':
      if (!username) {
        send(player, 'Add who? Usage: friend add <name>', 'error');
        return;
      }
      addFriend(player, username);
      break;
      
    case 'remove':
    case 'delete':
      if (!username) {
        send(player, 'Remove who? Usage: friend remove <name>', 'error');
        return;
      }
      removeFriend(player, username);
      break;
      
    case 'list':
      listFriends(player);
      break;
      
    default:
      send(player, 'Usage: friend [list|add <name>|remove <name>]', 'error');
      break;
  }
}
