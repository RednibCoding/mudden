// Mudden MUD Server - Entry Point

import { Server } from 'socket.io';
import { createServer } from 'http';
import { loadGameData } from './data';
import { gameState, addPlayer, removePlayer } from './game';
import { createPlayer, authenticatePlayer, playerExists, savePlayer, cleanupInactivePlayers, resetPlayer, deletePlayer } from './player';
import { send, sendToAll, whisper, reply } from './messaging';
import { move, look } from './movement';
import { attack, flee, isInCombat } from './combat';
import { say } from './messaging';
import { inventory, equipment, equip, unequip, drop, get, use, examine } from './items';
import { talk } from './npcs';
import { list, buy, sell } from './shops';
import { give } from './give';
import { showQuests } from './quests';
import { harvest, showRecipes, examineRecipe, craft } from './crafting';
import { handleFriendCommand } from './social';
import { Player } from './types';
import { calculateStats, generateMap } from './utils';
import * as packageJson from '../package.json';

const MUDDEN_VERSION = packageJson.version;

async function startServer() {
  // Load game data
  gameState.gameData = await loadGameData();
  
  // Cleanup inactive players if configured
  console.log('Checking for inactive players...');
  const deletedCount = await cleanupInactivePlayers(gameState.gameData.config);
  if (deletedCount > 0) {
    console.log(`✓ Deleted ${deletedCount} inactive player(s)\n`);
  } else if (gameState.gameData.config.server.autoDeleteInactivePlayers) {
    console.log('✓ No inactive players to delete\n');
  }
  
  // Get server config
  const serverConfig = gameState.gameData.config.server;
  const PORT = serverConfig.port;
  const HOST = serverConfig.host;
  
  // Create HTTP server
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: serverConfig.corsOrigin,
      methods: ['GET', 'POST']
    }
  });
  
  console.log(`\n🎮 Mudden Engine v${MUDDEN_VERSION} starting...\n`);
  
  // Rate limiting tracking (in-memory)
  const ipRegistrations = new Map<string, { count: number; timestamps: number[] }>();
  const ipLoginAttempts = new Map<string, { failedAttempts: number[]; blockedUntil?: number }>();
  const commandTimestamps = new Map<string, number[]>(); // Track command timestamps per username
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    let player: Player | null = null;
    
    // Get client IP address
    const clientIP = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() 
      || socket.handshake.address 
      || 'unknown';
    
    // Login handler
    socket.on('login', async (data: { username: string; password: string }, callback) => {
      const { username, password } = data;
      
      // Validate input
      if (!username || !password) {
        callback({ success: false, message: 'Username and password required.' });
        return;
      }
      
      // Check rate limiting if enabled
      const rateLimitConfig = gameState.gameData.config.server.rateLimit;
      if (rateLimitConfig.enabled) {
        const now = Date.now();
        const loginData = ipLoginAttempts.get(clientIP);
        
        // Check if IP is blocked
        if (loginData?.blockedUntil && loginData.blockedUntil > now) {
          const waitSeconds = Math.ceil((loginData.blockedUntil - now) / 1000);
          callback({ 
            success: false, 
            message: `Too many failed login attempts. Try again in ${waitSeconds} seconds.` 
          });
          return;
        }
      }
      
      // Check if already logged in
      if (gameState.players.has(username)) {
        callback({ success: false, message: 'Player already logged in.' });
        return;
      }
      
      // Authenticate
      player = await authenticatePlayer(username, password);
      
      if (!player) {
        // Track failed login attempt
        if (rateLimitConfig.enabled) {
          const now = Date.now();
          const loginData = ipLoginAttempts.get(clientIP) || { failedAttempts: [] };
          
          // Remove old attempts outside the window
          loginData.failedAttempts = loginData.failedAttempts.filter(
            timestamp => now - timestamp < rateLimitConfig.loginAttemptWindow * 1000
          );
          
          // Add this failed attempt
          loginData.failedAttempts.push(now);
          
          // Block if too many attempts
          if (loginData.failedAttempts.length >= rateLimitConfig.maxLoginAttempts) {
            loginData.blockedUntil = now + (rateLimitConfig.loginAttemptWindow * 1000);
            console.log(`⚠ IP ${clientIP} blocked for ${rateLimitConfig.loginAttemptWindow}s (too many failed logins)`);
          }
          
          ipLoginAttempts.set(clientIP, loginData);
        }
        
        callback({ success: false, message: 'Invalid username or password.' });
        return;
      }
      
      // Check if player is banned
      if (player.bannedUntil && player.bannedUntil > Date.now()) {
        const timeLeft = Math.ceil((player.bannedUntil - Date.now()) / 1000 / 60); // minutes
        const hours = Math.floor(timeLeft / 60);
        const minutes = timeLeft % 60;
        const timeStr = hours > 0 
          ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`
          : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        callback({ success: false, message: `Your account is banned. Time remaining: ${timeStr}` });
        return;
      }
      
      // Clear expired ban
      if (player.bannedUntil && player.bannedUntil <= Date.now()) {
        player.bannedUntil = undefined;
        await savePlayer(player);
      }
      
      // Clear failed attempts on successful login
      if (rateLimitConfig.enabled) {
        ipLoginAttempts.delete(clientIP);
      }
      
      // Attach socket and add to game
      player.socket = socket;
      addPlayer(player);
      
      console.log(`✓ ${username} logged in`);
      
      callback({ success: true, message: 'Login successful!' });
      
      // Welcome message with game meta info
      const meta = gameState.gameData.config.gameMeta;
      const welcomeMsg = `\n${'='.repeat(50)}\n   ${meta.name} v${meta.version}\n   Powered by Mudden Engine v${MUDDEN_VERSION}\n${'='.repeat(50)}\n\n${meta.description}\n\n${meta.welcomeMessage}\n\n${meta.credits}\n${'='.repeat(50)}\n`;
      send(player, welcomeMsg, 'system');
      
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
      
      // Check rate limiting if enabled
      const rateLimitConfig = gameState.gameData.config.server.rateLimit;
      if (rateLimitConfig.enabled) {
        const now = Date.now();
        const regData = ipRegistrations.get(clientIP) || { count: 0, timestamps: [] };
        
        // Remove timestamps outside the cooldown window
        regData.timestamps = regData.timestamps.filter(
          timestamp => now - timestamp < rateLimitConfig.accountCreationCooldown * 1000
        );
        
        // Check if we're still in cooldown from last registration
        if (regData.timestamps.length > 0) {
          const lastRegistration = Math.max(...regData.timestamps);
          const timeSinceLastReg = now - lastRegistration;
          const cooldownMs = rateLimitConfig.accountCreationCooldown * 1000;
          
          if (timeSinceLastReg < cooldownMs) {
            const waitSeconds = Math.ceil((cooldownMs - timeSinceLastReg) / 1000);
            callback({ 
              success: false, 
              message: `Please wait ${waitSeconds} seconds before creating another account.` 
            });
            return;
          }
        }
        
        // Check max accounts per IP
        if (regData.count >= rateLimitConfig.maxAccountsPerIP) {
          callback({ 
            success: false, 
            message: `Maximum number of accounts (${rateLimitConfig.maxAccountsPerIP}) reached for this connection.` 
          });
          console.log(`⚠ IP ${clientIP} blocked (max accounts reached: ${regData.count})`);
          return;
        }
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
      
      // Track successful registration for rate limiting
      if (rateLimitConfig.enabled) {
        const now = Date.now();
        const regData = ipRegistrations.get(clientIP) || { count: 0, timestamps: [] };
        regData.count++;
        regData.timestamps.push(now);
        ipRegistrations.set(clientIP, regData);
        console.log(`✓ ${username} registered (IP: ${clientIP}, total accounts: ${regData.count})`);
      } else {
        console.log(`✓ ${username} registered`);
      }
      
      callback({ success: true, message: 'Registration successful!' });
      
      // Welcome message with game meta info
      const meta = gameState.gameData.config.gameMeta;
      const welcomeMsg = `\n${'='.repeat(50)}\n   ${meta.name} v${meta.version}\n   Powered by Mudden Engine v${MUDDEN_VERSION}\n   ✨ Character Created! ✨\n${'='.repeat(50)}\n\n${meta.description}\n\n${meta.welcomeMessage}\n\n${meta.credits}\n${'='.repeat(50)}\n`;
      send(player, welcomeMsg, 'system');
      
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
      
      // Check command rate limiting if enabled
      const rateLimitConfig = gameState.gameData.config.server.rateLimit;
      if (rateLimitConfig.enabled) {
        const now = Date.now();
        const username = player.username;
        const timestamps = commandTimestamps.get(username) || [];
        
        // Remove timestamps older than 1 second
        const recentTimestamps = timestamps.filter(t => now - t < 1000);
        
        // Check if player exceeded burst limit
        if (recentTimestamps.length >= rateLimitConfig.commandBurstLimit) {
          send(player, 'You are sending commands too quickly. Please slow down.', 'error');
          console.log(`⚠ ${username} hit command rate limit (${recentTimestamps.length} commands/sec)`);
          return;
        }
        
        // Add current timestamp
        recentTimestamps.push(now);
        commandTimestamps.set(username, recentTimestamps);
      }
      
      handleCommand(player, input);
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      if (player) {
        console.log(`✗ ${player.username} disconnected`);
        
        // IMPORTANT: Always save from gameState.players, not the closure variable
        // This ensures we save the latest player data (e.g., after a reset)
        const currentPlayer = gameState.players.get(player.username);
        if (currentPlayer) {
          savePlayer(currentPlayer);
        }
        
        // Clean up command rate limiting
        commandTimestamps.delete(player.username);
        
        // Announce to others
        sendToAll(`${player.displayName} has left the realm.`, 'system');
        
        // Remove from game
        removePlayer(player.username);
      }
      
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
  
  // Start server
  httpServer.listen(PORT, HOST, () => {
    console.log(`✓ Server running on ${HOST}:${PORT}`);
    console.log(`✓ Ready for connections!\n`);
  });
  
  // Graceful shutdown handlers
  const shutdown = async () => {
    console.log('\n🛑 Server shutting down...');
    console.log('💾 Saving all player data...');
    
    // Save all online players
    let savedCount = 0;
    for (const player of gameState.players.values()) {
      try {
        await savePlayer(player);
        savedCount++;
      } catch (error) {
        console.error(`Failed to save player ${player.username}:`, error);
      }
    }
    
    console.log(`✓ Saved ${savedCount} player(s)`);
    console.log('👋 Goodbye!\n');
    process.exit(0);
  };
  
  // Handle shutdown signals
  process.on('SIGINT', shutdown);   // Ctrl+C
  process.on('SIGTERM', shutdown);  // Kill command
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
      
    case 'map':
      cmdMap(player);
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
      
    case 'materials':
    case 'mats':
    case 'm':
      cmdMaterials(player);
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
      
    case 'examine':
    case 'exam':
    case 'ex':
    case 'x':
      if (args.length === 0) {
        send(player, 'Examine what?', 'error');
      } else {
        const target = args.join(' ');
        // Try as recipe first (if player knows it)
        const recipeId = args.join('_').toLowerCase();
        if (player.knownRecipes.includes(recipeId)) {
          examineRecipe(player, recipeId);
        } else {
          // Fall back to item examination
          examine(player, target);
        }
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
      
    case 'whisper':
    case 'tell':
    case 'w':
      if (args.length < 2) {
        send(player, 'Whisper what? Usage: whisper <player> <message>', 'error');
      } else {
        const targetName = args[0];
        const message = args.slice(1).join(' ');
        whisper(player, targetName, message);
      }
      break;
      
    case 'reply':
    case 'r':
      if (args.length === 0) {
        send(player, 'Reply what?', 'error');
      } else {
        reply(player, args.join(' '));
      }
      break;
      
    case 'talk':
      if (args.length === 0) {
        send(player, 'Talk to who?', 'error');
      } else {
        talk(player, args.join(' '));
      }
      break;
      
    case 'give':
      if (args.length === 0) {
        send(player, 'Give what? Usage: give <player> <item> OR give <player> <amount> gold', 'error');
      } else {
        give(player, args);
      }
      break;
      
    case 'friend':
    case 'friends':
    case 'f':
      handleFriendCommand(player, args);
      break;
      
    case 'who':
      cmdWho(player);
      break;
      
    // Shop
    case 'list':
      list(player);
      break;
      
    case 'buy':
      if (args.length === 0) {
        send(player, 'Buy what?', 'error');
      } else {
        buy(player, args.join(' '));
      }
      break;
      
    case 'sell':
      if (args.length === 0) {
        send(player, 'Sell what?', 'error');
      } else {
        sell(player, args.join(' '));
      }
      break;
      
    // Quests
    case 'quests':
    case 'quest':
    case 'q':
      showQuests(player);
      break;
      
    // Crafting
    case 'harvest':
      if (args.length === 0) {
        harvest(player);
      } else {
        harvest(player, args.join(' '));
      }
      break;
      
    case 'recipes':
      showRecipes(player);
      break;
      
    case 'craft':
      if (args.length === 0) {
        send(player, 'Craft what? Usage: craft <recipe>', 'error');
      } else {
        craft(player, args.join('_').toLowerCase());
      }
      break;
      
    // Help
    case 'help':
      cmdHelp(player);
      break;
      
    // Logout
    case 'quit':
    case 'logout':
      cmdQuit(player);
      break;
      
    // Account Management
    case 'reset-account':
      if (args.length !== 2) {
        send(player, 'Usage: reset-account <accountname> <password>', 'error');
        send(player, 'WARNING: This will permanently reset your account to level 1!', 'error');
      } else {
        cmdResetAccount(player, args[0], args[1]);
      }
      break;
      
    case 'delete-account':
      if (args.length !== 2) {
        send(player, 'Usage: delete-account <accountname> <password>', 'error');
        send(player, 'WARNING: This will permanently delete your account!', 'error');
      } else {
        cmdDeleteAccount(player, args[0], args[1]);
      }
      break;
      
    // GM Commands
    case 'ban':
      if (!player.isGm) {
        send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      } else if (args.length !== 2) {
        send(player, 'Usage: ban <playername> <hours>', 'error');
      } else {
        cmdBan(player, args[0], parseFloat(args[1]));
      }
      break;
      
    case 'kick':
      if (!player.isGm) {
        send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      } else if (args.length !== 1) {
        send(player, 'Usage: kick <playername>', 'error');
      } else {
        cmdKick(player, args[0]);
      }
      break;
      
    case 'teleport':
      if (!player.isGm) {
        send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      } else if (args.length !== 2) {
        send(player, 'Usage: teleport <playername> <locationid>', 'error');
      } else {
        cmdTeleport(player, args[0], args[1]);
      }
      break;
      
    default:
      send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
      break;
      
  }
}

// Basic command implementations

function cmdMap(player: Player): void {
  const mapDisplay = generateMap(player);
  send(player, mapDisplay, 'info');
}

function cmdWho(player: Player): void {
  const onlinePlayers = Array.from(gameState.players.values())
    .filter(p => p.socket);
  
  let message = '\n=== Online Players ===\n';
  
  if (onlinePlayers.length === 0) {
    message += 'No players online.\n';
  } else {
    onlinePlayers.forEach(p => {
      message += `  ${p.displayName} [Level ${p.level}]\n`;
    });
  }
  
  message += `\nTotal: ${onlinePlayers.length} player(s)\n`;
  send(player, message, 'info');
}

function cmdMaterials(player: Player): void {
  let message = '\n=== Crafting Materials ===\n';
  
  const materialEntries = Object.entries(player.materials);
  
  if (materialEntries.length === 0) {
    message += 'You have no materials.\n';
  } else {
    materialEntries.forEach(([materialId, amount]) => {
      const material = gameState.gameData.materials.get(materialId);
      const name = material ? material.name : materialId;
      const rarity = material ? ` [${material.rarity}]` : '';
      message += `  ${amount}x ${name}${rarity}\n`;
    });
  }
  
  send(player, message, 'info');
}

function cmdHelp(player: Player): void {
  let message = `
=== Mudden MUD Commands ===

Movement:
  north (n), south (s), east (e), west (w), up (u), down (d)
  flee (fl)          - Escape from combat (random direction)

Combat:
  attack <target>    - Attack an enemy (shortcuts: kill, k)
  flee (fl)          - Attempt to escape combat

Items & Equipment:
  inventory (inv, i) - View your inventory
  equipment (eq)     - View equipped items
  materials (mats, m) - View your crafting materials
  examine <item>     - View detailed item info (exam, ex, x)
  equip <item>       - Equip an item (shortcuts: wear, wield)
  unequip <item>     - Unequip an item (shortcuts: remove)
  drop <item>        - Drop an item on the ground
  get <item>         - Pick up an item (shortcuts: take)
  use <item>         - Use a consumable item

Quests:
  quests (q)         - View active and completed quests
  talk <npc>         - Talk to NPCs to accept/complete quests

Crafting:
  harvest <material> - Harvest materials from resource nodes
  recipes            - View known recipes
  examine <recipe>   - View recipe details and requirements
  craft <recipe>     - Craft an item from a recipe

Shop:
  list               - View shop inventory
  buy <item>         - Buy an item from the shop
  sell <item>        - Sell an item to the shop

NPCs:
  talk <npc>         - Talk to an NPC (healers, portal masters, etc.)
  say <destination>  - When talking to portal master, teleport for gold

Information:
  look (l)           - Look at your surroundings
  map                - View a visual map of nearby locations
  stats              - View your character stats

Social:
  say <message>      - Talk to everyone in the room
  whisper <player> <message> - Send a private message (shortcuts: tell, w)
  reply <message>    - Reply to last whisper (shortcut: r)
  friend [list|add <name>|remove <name>] - Manage friends (shortcut: f)
  give <player> <item>       - Give an item to another player
  give <player> <amount> gold - Give gold to another player
  who                - List online players

Account:
  reset-account <accountname> <password> - Reset your character to level 1
  delete-account <accountname> <password> - Permanently delete your account

Info:
  help               - Show this help
  quit (logout)      - Save and disconnect from the game
`;

  // Add GM commands if player is a gamemaster
  if (player.isGm) {
    message += `
=== Gamemaster Commands ===
  ban <playername> <hours>        - Ban a player (hours can be decimal, e.g., 0.5)
  kick <playername>               - Kick a player from the game
  teleport <playername> <location> - Teleport a player to a location
`;
  }

  message += '\nType any message to say it to the room!\n';
  send(player, message, 'info');
}

function cmdStats(player: Player): void {
  // Calculate total stats with equipment bonuses
  const stats = calculateStats(player);
  
  let message = `\n=== Character Stats ===\nName:     ${player.displayName}\nLevel:    ${player.level}\nXP:       ${player.xp}\nGold:     ${player.gold}\nDeaths:   ${player.deaths}\nCombats:  ${player.combats}\n\n`;
  
  // Show current/max with equipment bonuses
  if (stats.equipmentHealth > 0) {
    message += `Health:   ${player.health}/${stats.maxHealth} (${player.maxHealth} + ${stats.equipmentHealth})\n`;
  } else {
    message += `Health:   ${player.health}/${player.maxHealth}\n`;
  }
  
  if (stats.equipmentMana > 0) {
    message += `Mana:     ${player.mana}/${stats.maxMana} (${player.maxMana} + ${stats.equipmentMana})\n`;
  } else {
    message += `Mana:     ${player.mana}/${player.maxMana}\n`;
  }
  
  // Show total with equipment bonuses
  if (stats.equipmentDamage > 0) {
    message += `Damage:   ${stats.damage} (${player.damage} + ${stats.equipmentDamage})\n`;
  } else {
    message += `Damage:   ${player.damage}\n`;
  }
  
  if (stats.equipmentDefense > 0) {
    message += `Defense:  ${stats.defense} (${player.defense} + ${stats.equipmentDefense})\n`;
  } else {
    message += `Defense:  ${player.defense}\n`;
  }
  
  send(player, message, 'info');
}

function cmdQuit(player: Player): void {
  send(player, 'Saving your progress and logging out...', 'system');
  
  // Save the player
  savePlayer(player);
  
  // Announce to others
  sendToAll(`${player.displayName} has left the realm.`, 'system');
  
  // Disconnect after a brief moment
  setTimeout(() => {
    if (player && player.socket) {
      player.socket.disconnect();
    }
  }, 1000);
}

async function cmdResetAccount(player: Player, accountName: string, password: string): Promise<void> {
  // Verify they're resetting their own account (case-insensitive)
  if (player.username.toLowerCase() !== accountName.toLowerCase()) {
    send(player, 'You can only reset your own account.', 'error');
    return;
  }
  
  send(player, 'Resetting your account... Please wait.', 'system');
  
  const result = await resetPlayer(accountName, password);
  
  if (result.success) {
    send(player, result.message, 'success');
    send(player, 'Your character has been reset to level 1. Disconnecting...', 'system');
    
    // Disconnect after showing message
    setTimeout(() => {
      if (player && player.socket) {
        player.socket.disconnect();
      }
    }, 2000);
  } else {
    send(player, result.message, 'error');
  }
}

async function cmdDeleteAccount(player: Player, accountName: string, password: string): Promise<void> {
  // Verify they're deleting their own account (case-insensitive)
  if (player.username.toLowerCase() !== accountName.toLowerCase()) {
    send(player, 'You can only delete your own account.', 'error');
    return;
  }
  
  send(player, 'Deleting your account permanently... Please wait.', 'system');
  
  // Announce to others before deleting
  sendToAll(`${player.displayName} has left the realm forever.`, 'system');
  
  const result = await deletePlayer(accountName, password);
  
  if (result.success) {
    send(player, result.message, 'success');
    send(player, 'Goodbye! Your account has been permanently deleted.', 'system');
    
    // Remove from game state and disconnect
    removePlayer(player.username);
    
    setTimeout(() => {
      if (player && player.socket) {
        player.socket.disconnect();
      }
    }, 2000);
  } else {
    send(player, result.message, 'error');
  }
}

// GM Commands

function cmdBan(gm: Player, targetName: string, hours: number): void {
  if (!gm.isGm) {
    send(gm, 'You do not have permission to use this command.', 'error');
    return;
  }
  
  // Validate hours
  if (isNaN(hours) || hours <= 0) {
    send(gm, 'Invalid hours. Must be a positive number (e.g., 0.5 for half an hour).', 'error');
    return;
  }
  
  // Find target player (case-insensitive, exact match)
  const target = Array.from(gameState.players.values()).find(
    p => p.username.toLowerCase() === targetName.toLowerCase()
  );
  
  if (!target) {
    send(gm, `Player "${targetName}" not found.`, 'error');
    return;
  }
  
  // Cannot ban other GMs
  if (target.isGm) {
    send(gm, 'You cannot ban another gamemaster.', 'error');
    return;
  }
  
  // Set ban expiration
  const banDurationMs = hours * 60 * 60 * 1000;
  target.bannedUntil = Date.now() + banDurationMs;
  
  // Save player with ban
  savePlayer(target);
  
  const hoursStr = hours === 1 ? '1 hour' : `${hours} hours`;
  send(gm, `${target.displayName} has been banned for ${hoursStr}.`, 'success');
  
  // Notify target and kick them
  if (target.socket) {
    send(target, `You have been banned by a gamemaster for ${hoursStr}.`, 'error');
    send(target, 'You will be disconnected now.', 'system');
    
    setTimeout(() => {
      if (target.socket) {
        target.socket.disconnect();
      }
    }, 2000);
  }
  
  console.log(`⚔ GM ${gm.username} banned ${target.username} for ${hours} hours`);
}

function cmdKick(gm: Player, targetName: string): void {
  if (!gm.isGm) {
    send(gm, 'You do not have permission to use this command.', 'error');
    return;
  }
  
  // Find target player (case-insensitive, exact match)
  const target = Array.from(gameState.players.values()).find(
    p => p.username.toLowerCase() === targetName.toLowerCase()
  );
  
  if (!target) {
    send(gm, `Player "${targetName}" not found.`, 'error');
    return;
  }
  
  // Cannot kick other GMs
  if (target.isGm) {
    send(gm, 'You cannot kick another gamemaster.', 'error');
    return;
  }
  
  // Cannot kick offline players
  if (!target.socket) {
    send(gm, `${target.displayName} is not currently online.`, 'error');
    return;
  }
  
  send(gm, `${target.displayName} has been kicked from the game.`, 'success');
  
  // Notify target and disconnect
  send(target, 'You have been kicked by a gamemaster.', 'error');
  send(target, 'You will be disconnected now.', 'system');
  
  setTimeout(() => {
    if (target.socket) {
      target.socket.disconnect();
    }
  }, 1000);
  
  console.log(`⚔ GM ${gm.username} kicked ${target.username}`);
}

function cmdTeleport(gm: Player, targetName: string, locationId: string): void {
  if (!gm.isGm) {
    send(gm, 'You do not have permission to use this command.', 'error');
    return;
  }
  
  // Find target player (case-insensitive, exact match)
  const target = Array.from(gameState.players.values()).find(
    p => p.username.toLowerCase() === targetName.toLowerCase()
  );
  
  if (!target) {
    send(gm, `Player "${targetName}" not found.`, 'error');
    return;
  }
  
  // Verify location exists
  const location = gameState.gameData.locations.get(locationId);
  if (!location) {
    send(gm, `Location "${locationId}" does not exist.`, 'error');
    return;
  }
  
  // Teleport
  const oldLocation = target.location;
  target.location = locationId;
  savePlayer(target);
  
  send(gm, `${target.displayName} has been teleported to ${location.name}.`, 'success');
  
  // Notify target
  if (target.socket) {
    send(target, `A gamemaster has teleported you to ${location.name}.`, 'system');
    handleCommand(target, 'look');
  }
  
  console.log(`⚔ GM ${gm.username} teleported ${target.username} from ${oldLocation} to ${locationId}`);
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
