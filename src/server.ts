// Mudden MUD Server - Entry Point

import { Server } from 'socket.io';
import { createServer } from 'http';
import { loadGameData } from './data';
import { gameState, addPlayer, removePlayer } from './game';
import { createPlayer, authenticatePlayer, playerExists, savePlayer } from './player';
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
      
      // Welcome message with game meta info
      const meta = gameState.gameData.config.gameMeta;
      const welcomeMsg = `\n${'='.repeat(50)}\n   ${meta.name} v${meta.version}\n${'='.repeat(50)}\n\n${meta.description}\n\n${meta.welcomeMessage}\n\n${meta.credits}\n${'='.repeat(50)}\n`;
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
      
      // Welcome message with game meta info
      const meta = gameState.gameData.config.gameMeta;
      const welcomeMsg = `\n${'='.repeat(50)}\n   ${meta.name} v${meta.version}\n   ✨ Character Created! ✨\n${'='.repeat(50)}\n\n${meta.description}\n\n${meta.welcomeMessage}\n\n${meta.credits}\n${'='.repeat(50)}\n`;
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
      
      handleCommand(player, input);
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      if (player) {
        console.log(`✗ ${player.username} disconnected`);
        
        // Save player
        savePlayer(player);
        
        // Announce to others
        sendToAll(`${player.displayName} has left the realm.`, 'system');
        
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
  const message = `
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

Info:
  help               - Show this help

Type any message to say it to the room!
`;
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

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
