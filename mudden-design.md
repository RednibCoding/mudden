# Simple MUD Design Document

## 🎯 Design Philosophy

**Goal**: Create a simple, extensible, JSON-driven MUD that can be built and modified quickly while maintaining the rich content system.

**Core Principles**:
- **Simplicity First** - Minimal code, maximum functionality
- **JSON-Driven Content** - All game data in easily editable JSON files
- **File-Based Persistence** - No database complexity, just JSON saves
- **Real-Time Experience** - WebSocket-based communication
- **Zero Build Process** - Run with `node server.js`

## 🏗️ Architecture Overview

### Technology Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **Storage**: File system (JSON files)
- **Communication**: WebSockets for real-time interaction
- **Dependencies**: Minimal (express, socket.io only)

### File Structure
```
mudden/
├── server.js              # Main server file (~280 lines)
├── lib/
│   ├── Player.js          # Player class and file operations
│   ├── GameWorld.js       # World state and content loading
│   ├── CommandManager.js  # Command orchestration and processing
│   ├── CtxStateManager.js # Contextual state management with automatic cleanup
│   └── commands/          # Modular command system
│       ├── BaseCommand.js      # Shared command utilities
│       ├── MovementCommands.js # Movement and navigation
│       ├── InventoryCommands.js# Inventory and item management
│       ├── CombatCommands.js   # Combat and fighting
│       ├── SocialCommands.js   # Communication and chat
│       ├── InfoCommands.js     # Help and information
│       ├── SystemCommands.js   # Admin and system commands
│       └── README.md           # Command documentation
├── public/
│   ├── index.html         # Simple web interface
│   ├── style.css          # Comfortable gray terminal styling
│   └── client.js          # Client-side game logic
├── persist/               # Player save files and persistent data
├── templates/             # Game content templates (JSON files)
│   ├── players/           # Player save files (auto-generated)
│   ├── areas/             # Area definitions with rooms
│   ├── items/             # Item definitions with stats
│   ├── npcs/              # NPC definitions and dialogues
│   └── enemies.json       # Enemy definitions and stats
└── package.json           # Minimal dependencies
```

## 📊 Data Architecture

### Player Data Structure
```javascript
{
  "name": "Adventurer",
  "passwordHash": "hashed_password_with_salt",
  "health": 100,
  "maxHealth": 100,
  "level": 1,
  "experience": 0,
  "gold": 50,
  "currentArea": "town_area",
  "currentRoom": "town_square",
  "inventory": [
    { "id": "healing_potion", "quantity": 2 }
  ],
  "equipment": {
    "main_hand": "wooden_stick",
    "off_hand": null,
    "chest": null,
    "legs": null,
    "head": null,
    "feet": null,
    "hands": null
  },
  "stats": {
    "strength": 10,
    "defense": 5,
    "speed": 8
  },
  "quests": [],
  "inCombat": false,
  "homestone": { "area": "town_area", "room": "inn" },
  "takenOnetimeItems": [],  // Track onetime items taken
  "defeatedOnetimeEnemies": [],  // Track onetime enemies defeated
  "recoveryTimer": null,  // Health recovery system timer
  "lastSaved": "2025-09-28T20:42:00.000Z"
}
```

### Game World Structure
**Current JSON file organization**:
- `templates/areas/` - Area definitions with rooms (organized by area folders)
- `templates/items/` - Individual item JSON files (filename = item ID)
- `templates/enemies/` - Individual enemy JSON files (filename = enemy ID)
- `templates/npcs/` - Individual NPC JSON files (filename = NPC ID)
- `templates/quests/` - Individual quest JSON files (filename = quest ID)
- `persist/players/` - Player save files (auto-generated)

### Combat State (In-Memory)
```javascript
{
  "playerId": "Adventurer",
  "enemy": {
    "id": "wolf",
    "name": "Forest Wolf",
    "health": 30,
    "maxHealth": 30,
    "stats": { /* from enemy template */ }
  },
  "turn": "player", // "player" | "enemy"
  "turnNumber": 1,
  "playerDefending": false
}
```

## 🎮 Game Flow Design

### Connection Flow
1. Player opens web page
2. Enters character name (simple prompt)
3. If existing character: enters password for authentication
4. If new character: creates password (hashed with PBKDF2 + salt)
5. Server loads/creates player file with duplicate login prevention
6. Player enters game world with health recovery system active
7. All commands via WebSocket communication with real-time updates

### Command Processing Flow
```
User Input → Client → WebSocket → Server → Process Command → Update Game State → Save Player → Send Response → Client Updates UI
```

### Core Game Loop
1. **Input**: Player types command
2. **Parse**: Split command into action + target
3. **Validate**: Check if action is valid in current context
4. **Execute**: Perform game action (move, attack, take, etc.)
5. **Update**: Modify player/world state
6. **Save**: Write player data to JSON file
7. **Respond**: Send result back to client
8. **Broadcast**: Update all connected players if needed

## 🕹️ Core Systems

### 1. Movement System
- Parse direction commands (north, south, east, west, go [direction])
- Load room data from JSON files
- Update player location
- Display room description and contents

### 2. Inventory System
- File-based item storage in player JSON
- Item pickup/drop mechanics
- Equipment system with slots
- Item usage (consumables, etc.)

### 3. Combat System
- Turn-based combat with real-time updates
- Health recovery system (2% max health every 5 seconds when out of combat)
- Player actions: attack, defend, flee, auto-attack
- Enemy damage using [min, max] arrays for consistent randomization
- Individual item drop chances with quantity ranges [min, max]
- Experience and gold rewards with enhanced loot generation
- Onetime enemy tracking to prevent re-spawning
- State persisted in player file after combat

### 4. Content Loading
- Dynamic loading of areas/rooms from JSON
- Item template system
- Enemy template system
- NPC dialogue system

### 5. Social System
- Player-to-player communication
- NPC interactions
- Simple quest system

### 6. Contextual State Management
- CtxStateManager handles temporary states that persist across specific command contexts
- States registered with exception commands that should NOT clear the state
- Automatic cleanup on command execution unless command is in exception list
- Scalable architecture prevents manual state cleanup in every command

### 7. Health Recovery System
- Automatic health regeneration when out of combat
- 2% of max health restored every 5 seconds
- Real-time client updates with gameState synchronization
- Stops during combat, resumes after combat ends
- Proper cleanup on player disconnect

### 8. Enhanced Security
- PBKDF2 password hashing with salt
- Duplicate login prevention system
- Session management with automatic cleanup
- Input validation and sanitization

## 🔧 Implementation Details

### Server Architecture
```javascript
// Main server components
class SimpleServer {
  constructor() {
    this.gameWorld = new GameWorld()       // Loads all JSON content
    this.commandManager = new CommandManager() // Handles all commands
    this.activePlayers = new Map()         // Connected players
    this.combatSessions = new Map()        // Active combat states
    this.connectedSockets = new Map()      // Socket connections
  }
}

class GameWorld {
  loadContent()     // Load all JSON files into memory
  getRoom(area, id) // Get room data
  getItem(id)       // Get item template
  getEnemy(id)      // Get enemy template
  getNPC(id)        // Get NPC template
  getQuest(id)      // Get quest template
}

class CommandManager {
  constructor(gameWorld, players, combatSessions, io)
  processCommand(player, commandString) // Route to appropriate command
  registerCommands() // Load all command modules
  setupCtxStates()  // Configure contextual states
}

class CtxStateManager {
  registerState(stateKey, exceptionCommands) // Register contextual state with exceptions
  setState(player, stateKey, value)           // Set state on player
  getState(player, stateKey)                  // Get state from player
  resetStatesForCommand(player, command)      // Auto-clear states based on command
}

class BaseCommand {
  constructor(gameWorld, players, combatSessions, io, ctxStateManager)
  // Shared utilities: fuzzy matching, player lookup, gameState updates
  sendGameStateUpdate(player) // Real-time client synchronization
  fuzzyMatch(input, items)    // Intelligent matching system
}

class Player {
  constructor(name)
  save()             // Write to JSON file with error handling
  static load(name)  // Read from JSON file with validation
  addItem(id, qty)   // Add item to inventory with stacking
  removeItem(id, qty)// Remove item from inventory
  hashPassword(password) // PBKDF2 password hashing
  verifyPassword(password) // Password verification
  startHealthRecovery(callback) // Begin health recovery system
  stopHealthRecovery()  // Stop health recovery system
}
```

### Modular Command System
```javascript
// Commands organized by category for better maintainability

// MovementCommands.js
class MovementCommands extends BaseCommand {
  getCommands() {
    return {
      'look': this.look.bind(this),
      'go': this.go.bind(this), 
      'north': this.move.bind(this, 'north'),
      'south': this.move.bind(this, 'south'),
      // ... other directions
    }
  }
}

// InventoryCommands.js  
class InventoryCommands extends BaseCommand {
  getCommands() {
    return {
      'inventory': this.inventory.bind(this),
      'take': this.take.bind(this),
      'drop': this.drop.bind(this),
      'use': this.use.bind(this),
      'equip': this.equip.bind(this),
      'unequip': this.unequip.bind(this)
    }
  }
}

// CombatCommands.js
class CombatCommands extends BaseCommand {
  getCommands() {
    return {
      'attack': this.attack.bind(this),
      'defend': this.defend.bind(this),
      'flee': this.flee.bind(this)
    }
  }
}

// SocialCommands.js
class SocialCommands extends BaseCommand {
  getCommands() {
    return {
      'say': this.say.bind(this),
      'tell': this.tell.bind(this),
      'who': this.who.bind(this),
      'ask': this.ask.bind(this),
      'talk': this.talk.bind(this)
    }
  }
}

// InfoCommands.js
class InfoCommands extends BaseCommand {
  getCommands() {
    return {
      'help': this.help.bind(this),
      'stats': this.stats.bind(this),
      'time': this.time.bind(this)
    }
  }
}

// SystemCommands.js
class SystemCommands extends BaseCommand {
  getCommands() {
    return {
      'save': this.save.bind(this),
      'quit': this.quit.bind(this),
      'logout': this.logout.bind(this)
    }
  }
}
```

### File Operations
```javascript
// Simple file-based persistence
const savePlayer = (player) => {
  const filePath = `./persist/players/${player.name}.json`
  fs.writeFileSync(filePath, JSON.stringify(player, null, 2))
}

const loadPlayer = (name) => {
  const filePath = `./persist/players/${name}.json`
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  }
  return createNewPlayer(name)
}
```

## 🎨 User Interface Design

### Terminal-Style Web Interface
- **Black background** with green text (classic MUD aesthetic)
- **Scrolling output area** for game text
- **Command input** at bottom
- **Quick action buttons** for common commands
- **Character stats panel** (health, level, gold)
- **Room info panel** (current location, exits)

### Client-Side Features
- **Command history** (up/down arrows)
- **Auto-complete** for common commands
- **Click-to-interact** with items/NPCs in room descriptions
- **Keyboard shortcuts** (Enter to send, Tab for help)

## 🚀 Development Phases

### Phase 1: Core Engine ✅ COMPLETED
- [x] Basic server with WebSocket communication
- [x] Player creation and file-based persistence
- [x] Modular command processing system
- [x] Movement between rooms with exit-based navigation
- [x] Clean inventory system with consistent data format

### Phase 2: Content Integration ✅ COMPLETED
- [x] Load existing JSON area/item/NPC data
- [x] Rich room descriptions with dynamic content
- [x] Item pickup/drop/use mechanics
- [x] NPC interactions and dialogues
- [x] Equipment system with slots

### Phase 3: Combat System ✅ COMPLETED
- [x] Turn-based combat with enemy AI
- [x] Attack/defend/flee mechanics
- [x] Experience points and leveling
- [x] Equipment stats affecting combat
- [x] Combat state management

### Phase 4: Advanced Features ✅ COMPLETED
- [x] Player-to-player communication
- [x] Fuzzy command matching system
- [x] Password protection with PBKDF2 hashing
- [x] Comfortable UI with selectable text
- [x] Clean terminal aesthetic without Unicode symbols
- [x] Comprehensive help system
- [x] Admin and system commands
- [x] CtxStateManager for scalable contextual state management

### Phase 5: Enhanced Combat & Recovery ✅ COMPLETED
- [x] Health recovery system (2% every 5 seconds out of combat)
- [x] Real-time client synchronization with gameState updates
- [x] Standardized damage system with [min, max] arrays
- [x] Individual loot item chances with quantity ranges
- [x] Onetime enemy and item tracking system
- [x] Auto-attack functionality for extended combat
- [x] Enhanced loot generation with proper item naming

## 📈 Scalability Considerations

### Current Scope (1-10 players)
- File-based storage is perfectly adequate
- In-memory game state works fine
- Single server instance

### Future Growth (10+ players)
- Could add Redis for shared state
- Database migration path exists
- Load balancing with sticky sessions
- But keep the simple JSON content system!

## 🧩 Modular Architecture Benefits

### Command Organization
- **Maintainable**: Each command category in separate file
- **Extensible**: Easy to add new command categories
- **Reusable**: BaseCommand provides shared utilities
- **Testable**: Commands can be tested in isolation

### Shared Utilities (BaseCommand)
- **Fuzzy Matching**: Intelligent command/target matching
- **Player Lookup**: Find players by partial name
- **Item Resolution**: Convert IDs to full item objects
- **Error Handling**: Consistent error messages
- **Access Control**: GameWorld, players, combat sessions

### Data Consistency
- **Inventory Format**: Always `{id: string, quantity: number}`
- **Item Resolution**: Names looked up via GameWorld.getItem()
- **Equipment Tracking**: Clean slot-based system
- **Save Format**: Standardized player JSON structure

### Code Quality Improvements
- **No Unicode Dependencies**: Clean ASCII-only interface
- **Modern ES6+ Modules**: Import/export syntax throughout
- **Password Security**: PBKDF2 hashing with salt
- **Input Validation**: Sanitized user inputs
- **Error Recovery**: Graceful handling of invalid commands
- **Scalable State Management**: CtxStateManager eliminates manual cleanup code

### CtxStateManager Usage Example
```javascript
// In CommandManager.setupCtxStates()
this.ctxStateManager.registerState('viewingQuestRewards', [
  'quest', 'look', 'l', 'examine', 'ex'
])
this.ctxStateManager.registerState('viewingShop', ['shop', 'look', 'buy'])

// In any command class
this.setCtxState(player, 'viewingShop', shopData)      // Set state
const shopData = this.getCtxState(player, 'viewingShop') // Get state
this.clearCtxState(player, 'viewingShop')              // Manual clear (optional)

// States automatically cleared when executing commands not in exception list
```

## 🔒 Security & Validation

### Input Validation
- Sanitize all player input
- Command length limits
- Rate limiting on commands
- File name validation for saves

### File System Safety
- Restricted file access to persist/ and templates/ directories
- JSON parsing error handling
- Backup system for player files
- Concurrent write protection

## 🎯 Success Metrics

**A successful simple MUD should**:
- ✅ Start up in under 2 seconds
- ✅ Handle commands with <100ms response time
- ✅ Be modifiable via JSON files only
- ✅ Support 5-10 concurrent players smoothly
- ✅ Require zero build/compilation steps
- ✅ Be understandable through modular architecture
- ✅ Maintain all content from complex version
- ✅ Have clean, maintainable command system
- ✅ Provide comfortable user experience
- ✅ Support password-protected characters with secure hashing
- ✅ Use consistent data formats throughout
- ✅ Have comprehensive help and documentation
- ✅ Real-time health recovery and combat feedback
- ✅ Robust loot system with individual item chances
- ✅ Duplicate login prevention and session management
- ✅ Scalable contextual state management

## 🔄 Migration Strategy

### From Current Complex MUD
1. **Keep all JSON content files** (areas, items, enemies)
2. **Export player data** from Supabase to JSON files
3. **Reimplement core systems** with simple architecture
4. **Maintain feature parity** for essential gameplay
5. **Add new features** much faster due to simplicity

### Content Compatibility
- ✅ Existing area JSON files work as-is
- ✅ Item definitions fully compatible
- ✅ Enemy templates reusable
- ✅ Quest data structure compatible
- ✅ NPC definitions work with minor tweaks

This design maintains the rich, JSON-driven content system while drastically simplifying the technical implementation. The result should be a MUD that's fun to play, easy to modify, and quick to extend with new content.