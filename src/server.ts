/**
 * MiniMUD Server - Refactored and organized
 * Main entry point with clean separation of concerns
 */
import { Server } from 'socket.io';
import { createServer } from 'http';
import { GameState, Player, ClientMessage } from './types';
import { gameState, activePlayers } from './gameState';
import { loadGameData } from './dataLoader';
import { initMessaging, sendToLocation, sendToPlayer } from './messaging';
import { createPlayer, savePlayer, loadPlayer, validatePassword, playerExists, sanitizePlayerName } from './auth';
import { forEachEnemy, isPlayerInCombat } from './utils';
import { isEnemyInLocation } from './messaging';
import { routeCommand } from './commands/commandRouter';

const httpServer = createServer();
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize messaging system
initMessaging(io);

/**
 * Handles incoming client messages
 */
function handleClientMessage(socket: any, msg: ClientMessage): void {
  switch (msg.type) {
    case 'register':
      handleRegister(socket, msg.data);
      break;
    case 'login':
      handleLogin(socket, msg.data);
      break;
    case 'command':
      handleCommand(socket, msg.data);
      break;
  }
}

/**
 * Handles player registration
 */
function handleRegister(socket: any, data: { username: string; password: string }): void {
  const { username, password } = data;

  if (!password || password.length < 4) {
    socket.emit('message', {
      type: 'error',
      data: password ? 'Password must be at least 4 characters long' : 'Password required'
    });
    return;
  }

  const nameResult = sanitizePlayerName(username);
  if (!nameResult.isValid) {
    socket.emit('message', { type: 'error', data: nameResult.error });
    return;
  }

  const sanitizedName = nameResult.sanitized;

  if (playerExists(sanitizedName)) {
    socket.emit('message', { type: 'error', data: 'Username already exists' });
    return;
  }

  const player = createPlayer(sanitizedName, password, gameState.defaults);
  gameState.players.set(sanitizedName, player);
  activePlayers.set(socket.id, sanitizedName);

  socket.emit('message', { type: 'auth', data: { success: true, player } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${sanitizedName} has entered the realm.`, type: 'system' }
  }, sanitizedName);
}

/**
 * Handles player login
 */
function handleLogin(socket: any, data: { username: string; password: string }): void {
  const { username, password } = data;

  if (!password) {
    socket.emit('message', { type: 'error', data: 'Password required' });
    return;
  }

  const nameResult = sanitizePlayerName(username);
  if (!nameResult.isValid) {
    socket.emit('message', { type: 'error', data: 'Invalid username or password' });
    return;
  }

  const sanitizedName = nameResult.sanitized;
  const player = loadPlayer(sanitizedName);
  
  if (!player || !validatePassword(player, password)) {
    socket.emit('message', { type: 'error', data: 'Invalid username or password' });
    return;
  }

  // Handle existing session
  let existingSocketId: string | undefined;
  for (const [socketId, playerName] of activePlayers.entries()) {
    if (playerName === sanitizedName) {
      existingSocketId = socketId;
      break;
    }
  }

  if (existingSocketId) {
    const existingSocket = io.sockets.sockets.get(existingSocketId);
    if (existingSocket) {
      const existingPlayer = gameState.players.get(sanitizedName);
      if (existingPlayer) {
        handlePlayerDisconnect(existingSocket, existingPlayer, false);
      }
      existingSocket.emit('message', {
        type: 'error',
        data: 'You have been disconnected due to login from another location.'
      });
      existingSocket.disconnect(true);
    }
  }

  player.lastSeen = Date.now();
  gameState.players.set(sanitizedName, player);
  activePlayers.set(socket.id, sanitizedName);

  socket.emit('message', { type: 'auth', data: { success: true, player } });
  sendToLocation(player.location, {
    type: 'message',
    data: { text: `${sanitizedName} has returned.`, type: 'system' }
  }, sanitizedName);
}

/**
 * Handles commands from authenticated players
 */
function handleCommand(socket: any, data: { command: string }): void {
  const username = activePlayers.get(socket.id);
  if (!username) {
    socket.emit('message', { type: 'error', data: 'Not authenticated' });
    return;
  }

  const player = gameState.players.get(username);
  if (!player) {
    socket.emit('message', { type: 'error', data: 'Player not found' });
    return;
  }

  routeCommand(socket, player, data.command);
}

/**
 * Handles player disconnect
 */
function handlePlayerDisconnect(socket: any, player: Player, sendGoodbyeMessage: boolean = false): void {
  try {
    // Cancel trades
    if (player.activeTrade) {
      // Trade cancellation logic here
    }

    // Remove from combat
    forEachEnemy(enemy => {
      if (isEnemyInLocation(enemy, player.location)) {
        const fighterIndex = enemy.currentFighters.indexOf(player.username);
        if (fighterIndex > -1) {
          enemy.currentFighters.splice(fighterIndex, 1);
        }
      }
    });

    // Notify location
    const departureMessage = sendGoodbyeMessage
      ? `${player.username} has left the realm.`
      : `${player.username} has departed.`;

    sendToLocation(player.location, {
      type: 'message',
      data: { text: departureMessage, type: 'system' }
    }, player.username);

    if (sendGoodbyeMessage) {
      socket.emit('message', {
        type: 'message',
        data: { text: 'Thanks for playing Mudden! Goodbye!', type: 'success' }
      });
    }

    // Save and cleanup
    player.lastSeen = Date.now();
    savePlayer(player);
    gameState.players.delete(player.username);
    activePlayers.delete(socket.id);

  } catch (error) {
    console.error('Error in handlePlayerDisconnect:', error);
  }
}

/**
 * Handles quit command
 */
export function handleQuit(socket: any, player: Player): void {
  handlePlayerDisconnect(socket, player, true);
  setTimeout(() => {
    socket.emit('message', { type: 'success', data: 'logout_complete' });
  }, 1000);
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('message', (msg: ClientMessage) => {
    handleClientMessage(socket, msg);
  });

  socket.on('disconnect', () => {
    const username = activePlayers.get(socket.id);
    if (username) {
      const player = gameState.players.get(username);
      if (player) {
        handlePlayerDisconnect(socket, player, false);
      }
      console.log('Player disconnected:', username);
    }
  });
});

// Initialize and start server
loadGameData();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mudden server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  console.log('Saving all player data...');

  gameState.players.forEach((player, username) => {
    try {
      player.lastSeen = Date.now();
      savePlayer(player);
      console.log(`Saved ${username}`);
    } catch (error) {
      console.error(`Failed to save ${username}:`, error);
    }
  });

  console.log('All players saved. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.kill(process.pid, 'SIGINT');
});
