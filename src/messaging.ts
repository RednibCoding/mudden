/**
 * Messaging utilities for sending messages to players and locations
 */
import { Server } from 'socket.io';
import { gameState, activePlayers } from './gameState';
import { ServerMessage, Enemy } from './types';

let io: Server;

/**
 * Initializes the messaging system with the Socket.IO server
 */
export function initMessaging(socketServer: Server): void {
  io = socketServer;
}

/**
 * Sends a message to a specific player by username
 */
export function sendToPlayer(username: string, message: ServerMessage): void {
  const socketId = Array.from(activePlayers.entries())
    .find(([_, user]) => user.toLowerCase() === username.toLowerCase())?.[0];
  
  if (socketId) {
    io.to(socketId).emit('message', message);
  }
}

/**
 * Sends a message to all players in a specific location
 */
export function sendToLocation(locationId: string, message: ServerMessage, except?: string): void {
  try {
    activePlayers.forEach((username, socketId) => {
      if (username !== except) {
        const player = gameState.players.get(username);
        if (player && player.location === locationId) {
          io.to(socketId).emit('message', message);
        }
      }
    });
  } catch (error) {
    console.error('Error in sendToLocation:', error);
  }
}

/**
 * Sends a message to all connected players
 */
export function sendGlobal(message: ServerMessage, except?: string): void {
  activePlayers.forEach((username, socketId) => {
    if (username !== except) {
      io.to(socketId).emit('message', message);
    }
  });
}

/**
 * Sends a message to all locations where an enemy is present
 */
export function sendToEnemyLocations(enemy: Enemy, message: ServerMessage, excludePlayer?: string): void {
  const locationId = getEnemyLocation(enemy);
  if (locationId) {
    sendToLocation(locationId, message, excludePlayer);
  }
}

/**
 * Gets the location ID where an enemy is currently located
 */
export function getEnemyLocation(targetEnemy: Enemy): string | null {
  for (const [locationId, location] of gameState.locations) {
    if (location.enemies.includes(targetEnemy)) {
      return locationId;
    }
  }
  return null;
}

/**
 * Checks if an enemy is in a specific location
 */
export function isEnemyInLocation(enemy: Enemy, locationId: string): boolean {
  const location = gameState.locations.get(locationId);
  return location ? location.enemies.includes(enemy) : false;
}

/**
 * Gets a socket by socket ID (for trade commands)
 */
export function getSocket(socketId: string): any | null {
  return io.sockets.sockets.get(socketId) || null;
}
