// Mudden MUD Server - Entry Point

import { Server } from 'socket.io';
import { createServer } from 'http';
import { loadGameData } from './data';
import { gameState, addPlayer, removePlayer } from './game';
import { createPlayer, authenticatePlayer, playerExists, savePlayer } from './player';
import { send, sendToAll } from './messaging';
import { move, look } from './movement';
import { attack, flee, isInCombat } from './combat';
import { say } from './messaging';
import { inventory, equipment, equip, unequip, drop, get, use } from './items';
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
      
    case 'flee':
    case 'fl':
      flee(player);
      break;
      
    // Combat
    case 'attack':
    case 'kill':
    case 'k':
      if (args.length === 0) {
        send(player, 'Attack what?', 'error');
      } else {
        attack(player, args.join(' '));
      }
      break;
      
    // Information
    case 'look':
    case 'l':
      look(player);
      break;
      
    case 'stats':
    case 'score':
      cmdStats(player);
      break;
      
    // Items & Equipment
    case 'inventory':
    case 'inv':
    case 'i':
      inventory(player);
      break;
      
    case 'equipment':
    case 'eq':
      equipment(player);
      break;
      
    case 'equip':
    case 'wear':
    case 'wield':
      if (args.length === 0) {
        send(player, 'Equip what?', 'error');
      } else {
        equip(player, args.join(' '));
      }
      break;
      
    case 'unequip':
    case 'remove':
      if (args.length === 0) {
        send(player, 'Unequip what?', 'error');
      } else {
        unequip(player, args.join(' '));
      }
      break;
      
    case 'drop':
      if (args.length === 0) {
        send(player, 'Drop what?', 'error');
      } else {
        drop(player, args.join(' '));
      }
      break;
      
    case 'get':
    case 'take':
      if (args.length === 0) {
        send(player, 'Get what?', 'error');
      } else {
        get(player, args.join(' '));
      }
      break;
      
    case 'use':
      if (args.length === 0) {
        send(player, 'Use what?', 'error');
      } else {
        use(player, args.join(' '));
      }
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
  send(player, '  north (n), south (s), east (e), west (w), up (u), down (d)', 'info');
  send(player, '  flee (fl)          - Escape from combat (random direction)', 'info');
  send(player, '', 'info');
  send(player, 'Combat:', 'info');
  send(player, '  attack <target>    - Attack an enemy (shortcuts: kill, k)', 'info');
  send(player, '  flee (fl)          - Attempt to escape combat', 'info');
  send(player, '', 'info');
  send(player, 'Items & Equipment:', 'info');
  send(player, '  inventory (inv, i) - View your inventory', 'info');
  send(player, '  equipment (eq)     - View equipped items', 'info');
  send(player, '  equip <item>       - Equip an item (shortcuts: wear, wield)', 'info');
  send(player, '  unequip <item>     - Unequip an item (shortcuts: remove)', 'info');
  send(player, '  drop <item>        - Drop an item on the ground', 'info');
  send(player, '  get <item>         - Pick up an item (shortcuts: take)', 'info');
  send(player, '  use <item>         - Use a consumable item', 'info');
  send(player, '', 'info');
  send(player, 'Information:', 'info');
  send(player, '  look (l)           - Look at your surroundings', 'info');
  send(player, '  stats              - View your character stats', 'info');
  send(player, '', 'info');
  send(player, 'Social:', 'info');
  send(player, '  say <message>      - Talk to everyone in the room', 'info');
  send(player, '  who                - List online players', 'info');
  send(player, '', 'info');
  send(player, 'Info:', 'info');
  send(player, '  help               - Show this help', 'info');
  send(player, '\nType any message to say it to the room!\n', 'info');
}

function cmdStats(player: Player): void {
  send(player, '\n=== Character Stats ===', 'info');
  send(player, `Name:     ${player.username}`, 'info');
  send(player, `Level:    ${player.level}`, 'info');
  send(player, `XP:       ${player.xp}`, 'info');
  send(player, `Gold:     ${player.gold}`, 'info');
  send(player, '', 'info');
  send(player, `Health:   ${player.health}/${player.maxHealth}`, 'info');
  send(player, `Mana:     ${player.mana}/${player.maxMana}`, 'info');
  send(player, `Damage:   ${player.damage}`, 'info');
  send(player, `Defense:  ${player.defense}`, 'info');
  send(player, '', 'info');
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
