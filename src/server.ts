// Mudden MUD Server - Entry Point

import { Server } from 'socket.io';
import { createServer } from 'http';
import { loadGameData } from './data';
import { gameState, addPlayer, removePlayer } from './game';
import { createPlayer, authenticatePlayer, playerExists, savePlayer } from './player';
import { send, sendToAll } from './messaging';
import { Player } from './types';

const PORT = 3000;

async function startServer() {
  // Load game data
  gameState.gameData = await loadGameData();
  
  // Create HTTP server
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  console.log('\n🎮 Mudden MUD Server starting...\n');
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    let player: Player | null = null;
    
    // Login handler
    socket.on('login', async (data: { username: string; password: string }, callback) => {
      const { username, password } = data;
      
      // Validate input
      if (!username || !password) {
        callback({ success: false, message: 'Username and password required.' });
        return;
      }
      
      // Check if already logged in
      if (gameState.players.has(username)) {
        callback({ success: false, message: 'Player already logged in.' });
        return;
      }
      
      // Authenticate
      player = await authenticatePlayer(username, password);
      
      if (!player) {
        callback({ success: false, message: 'Invalid username or password.' });
        return;
      }
      
      // Attach socket and add to game
      player.socket = socket;
      addPlayer(player);
      
      console.log(`✓ ${username} logged in`);
      
      callback({ success: true, message: 'Login successful!' });
      
      // Welcome message
      send(player, '\n=================================', 'system');
      send(player, '   Welcome to Mudden MUD!', 'system');
      send(player, '=================================\n', 'system');
      
      // Announce to others
      sendToAll(`${username} has entered the realm.`, 'system');
      
      // Show current location
      handleCommand(player, 'look');
    });
    
    // Register handler
    socket.on('register', async (data: { username: string; password: string }, callback) => {
      const { username, password } = data;
      
      // Validate input
      if (!username || !password) {
        callback({ success: false, message: 'Username and password required.' });
        return;
      }
      
      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
        callback({ success: false, message: 'Username must be 3-16 alphanumeric characters.' });
        return;
      }
      
      // Check if exists
      if (playerExists(username)) {
        callback({ success: false, message: 'Username already taken.' });
        return;
      }
      
      // Create player
      player = await createPlayer(username, password);
      player.socket = socket;
      addPlayer(player);
      
      console.log(`✓ ${username} registered`);
      
      callback({ success: true, message: 'Registration successful!' });
      
      // Welcome message
      send(player, '\n=================================', 'system');
      send(player, '   Welcome to Mudden MUD!', 'system');
      send(player, '      Character Created!', 'system');
      send(player, '=================================\n', 'system');
      
      // Announce to others
      sendToAll(`${username} has entered the realm for the first time!`, 'system');
      
      // Show current location
      handleCommand(player, 'look');
    });
    
    // Command handler
    socket.on('command', (input: string) => {
      if (!player) {
        socket.emit('message', { type: 'error', text: 'Not logged in.', timestamp: Date.now() });
        return;
      }
      
      handleCommand(player, input);
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      if (player) {
        console.log(`✗ ${player.username} disconnected`);
        
        // Save player
        savePlayer(player);
        
        // Announce to others
        sendToAll(`${player.username} has left the realm.`, 'system');
        
        // Remove from game
        removePlayer(player.username);
      }
      
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
  
  // Start server
  httpServer.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Ready for connections!\n`);
  });
}

// Command handler (placeholder - will be expanded)
function handleCommand(player: Player, input: string): void {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return;
  }
  
  const [command, ...args] = trimmed.split(/\s+/);
  const cmd = command.toLowerCase();
  
  // Basic commands
  switch (cmd) {
    case 'look':
    case 'l':
      cmdLook(player);
      break;
      
    case 'say':
      if (args.length === 0) {
        send(player, 'Say what?', 'error');
      } else {
        const { say } = require('./messaging');
        say(player, args.join(' '));
      }
      break;
      
    case 'who':
      cmdWho(player);
      break;
      
    case 'help':
      cmdHelp(player);
      break;
      
    default:
      // If message doesn't start with a command, treat as "say"
      if (!cmd.startsWith('/')) {
        const { say } = require('./messaging');
        say(player, trimmed);
      } else {
        send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      }
  }
}

// Basic command implementations

function cmdLook(player: Player): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  send(player, `\n[${location.name}]`, 'info');
  send(player, location.description, 'info');
  
  // Exits
  const exits = Object.keys(location.exits);
  if (exits.length > 0) {
    send(player, '\nExits:', 'info');
    for (const [dir, dest] of Object.entries(location.exits)) {
      send(player, `  - ${dir}`, 'info');
    }
  }
  
  // Players in location
  const players = gameState.players;
  const playersHere = Array.from(players.values())
    .filter(p => p.location === player.location && p.id !== player.id);
  
  if (playersHere.length > 0) {
    send(player, '\nPlayers:', 'info');
    send(player, `  - ${playersHere.map(p => p.username).join(', ')}`, 'info');
  }
  
  send(player, '', 'info'); // Blank line
}

function cmdWho(player: Player): void {
  const onlinePlayers = Array.from(gameState.players.values())
    .filter(p => p.socket);
  
  send(player, '\n=== Online Players ===', 'info');
  
  if (onlinePlayers.length === 0) {
    send(player, 'No players online.', 'info');
  } else {
    onlinePlayers.forEach(p => {
      send(player, `  ${p.username} [Level ${p.level}]`, 'info');
    });
  }
  
  send(player, `\nTotal: ${onlinePlayers.length} player(s)\n`, 'info');
}

function cmdHelp(player: Player): void {
  send(player, '\n=== Mudden MUD Commands ===\n', 'info');
  send(player, 'Movement:', 'info');
  send(player, '  look (l)           - Look at your surroundings', 'info');
  send(player, '', 'info');
  send(player, 'Social:', 'info');
  send(player, '  say <message>      - Talk to everyone in the room', 'info');
  send(player, '  who                - List online players', 'info');
  send(player, '', 'info');
  send(player, 'Info:', 'info');
  send(player, '  help               - Show this help', 'info');
  send(player, '\nType any message to say it to the room!\n', 'info');
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
