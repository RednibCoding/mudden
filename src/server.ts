// Mudden MUD Server - Entry Point

import { Server } from 'socket.io';
import { createServer } from 'http';
import { loadGameData } from './data';
import { gameState, addPlayer, removePlayer } from './game';
import { createPlayer, authenticatePlayer, playerExists, savePlayer } from './player';
import { send, sendToAll, say } from './messaging';
import { move, look } from './movement';
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
  
  switch (cmd) {
    // Movement
    case 'north':
    case 'n':
      move(player, 'north');
      break;
      
    case 'south':
    case 's':
      move(player, 'south');
      break;
      
    case 'east':
    case 'e':
      move(player, 'east');
      break;
      
    case 'west':
    case 'w':
      move(player, 'west');
      break;
      
    case 'up':
    case 'u':
      move(player, 'up');
      break;
      
    case 'down':
    case 'd':
      move(player, 'down');
      break;
      
    // Information
    case 'look':
    case 'l':
      look(player);
      break;
      
    // Social
    case 'say':
      if (args.length === 0) {
        send(player, 'Say what?', 'error');
      } else {
        say(player, args.join(' '));
      }
      break;
      
    case 'who':
      cmdWho(player);
      break;
      
    // Help
    case 'help':
      cmdHelp(player);
      break;
      
    default:
      // If message doesn't start with a command, treat as "say"
      if (!cmd.startsWith('/')) {
        say(player, trimmed);
      } else {
        send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      }
  }
}

// Basic command implementations

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
  send(player, '  north, south, east, west, up, down (n/s/e/w/u/d)', 'info');
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
