// Typed messaging system for client-server communication

import { Player, MessageType, GameMessage } from './types';
import { gameState, getPlayersInLocation } from './game';

export function send(player: Player, text: string, type: MessageType = 'info'): void {
  if (!player.socket) {
    console.warn(`Cannot send message to ${player.username}: no socket`);
    return;
  }
  
  const message: GameMessage = {
    type,
    text,
    timestamp: Date.now()
  };
  
  player.socket.emit('message', message);
}

export function broadcast(
  locationId: string, 
  text: string, 
  type: MessageType = 'info',
  excludeId?: string
): void {
  const players = getPlayersInLocation(locationId)
    .filter(p => p.id !== excludeId);
  
  players.forEach(p => send(p, text, type));
}

export function whisper(from: Player, toUsername: string, message: string): void {
  const to = gameState.players.get(toUsername);
  
  if (!to || !to.socket) {
    send(from, 'Player not found or not online.', 'error');
    return;
  }
  
  send(to, `${from.username} whispers: ${message}`, 'whisper');
  send(from, `You whisper to ${to.username}: ${message}`, 'whisper');
  
  // Track for reply system
  to.lastWhisperFrom = from.username;
}

export function reply(player: Player, message: string): void {
  if (!player.lastWhisperFrom) {
    send(player, 'No one has whispered to you yet.', 'error');
    return;
  }
  
  const target = gameState.players.get(player.lastWhisperFrom);
  
  if (!target || !target.socket) {
    send(player, 'That player is no longer online.', 'error');
    return;
  }
  
  send(target, `${player.username} whispers: ${message}`, 'whisper');
  send(player, `You whisper to ${target.username}: ${message}`, 'whisper');
  
  // Allow them to reply back
  target.lastWhisperFrom = player.username;
}

export function sendToAll(text: string, type: MessageType = 'system'): void {
  gameState.players.forEach(p => {
    if (p.socket) {
      send(p, text, type);
    }
  });
}

export function say(player: Player, message: string): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  send(player, `You say: ${message}`, 'say');
  broadcast(player.location, `${player.username} says: ${message}`, 'say', player.id);
}
