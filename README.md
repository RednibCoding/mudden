# MUDDEN - A Small, Clean, Data-Driven MUD Server Engine

A complete yet compact multiplayer MUD (Multi-User Dungeon) server engine built with TypeScript and Socket.IO. Approximately **3,000-4,000 lines of code** providing full MUD gameplay with a clean, maintainable codebase.

## 🎯 Project Philosophy

- **Small & Clean**: ~3,800 lines of well-organized TypeScript
- **Data-Driven**: All game content in JSON files (locations, items, enemies, NPCs, quests, shops)
- **Type-Safe**: Full TypeScript with comprehensive interfaces
- **No Dependencies**: Just Socket.IO, bcrypt, and uuid - no heavy frameworks
- **Developer-Friendly**: Built-in validators, clear architecture, easy to understand

## ✨ Features

### Core Gameplay
- **Real-time Multiplayer** - Socket.IO for instant updates across all players
- **Grid-Based World** - 10-direction movement (N/S/E/W/NE/NW/SE/SW/Up/Down)
- **Visual ASCII Map** - See surrounding areas with connection lines
- **Shared Combat** - Multiple players can fight the same enemies
- **Equipment System** - Weapons, shields, and armor with stat bonuses
- **Ground Items** - Pick up items from locations with quest prerequisites and respawn timers
- **Natural Quest Discovery** - Talk to NPCs to discover and activate quests
- **Quest-Based Spawning** - Enemies and items appear based on player quest progression
- **Player Trading** - Trade items and gold between players
- **Teleportation** - Homestone system for quick travel

### Progression & Social
- **Experience & Leveling** - Gain XP, level up, increase stats
- **Quest System** - Kill, collect, and visit quests with prerequisites
- **Shop System** - Buy and sell items with gold
- **Friends List** - Add friends and see who's online
- **Communication** - Say, whisper, reply commands
- **Inventory Management** - 16-slot limited inventory

### Authentication & Persistence
- **Secure Auth** - bcrypt password hashing with salt
- **File-Based Storage** - Player data saved to JSON files
- **Auto-Save** - Changes saved automatically

## 🛠️ Development Tools

- **Map Validator** - Validates grid consistency, checks bidirectional connections, auto-fix capability
- **ID Reference Validator** - Validates all cross-references between game data files
- **Pre-Build Validation** - Runs validators automatically on `npm run dev`

## 🚀 Quick Start

### Prerequisites
```bash
npm install
```

### Development Mode (with validators)
```bash
npm run dev
```
This will:
1. Validate map grid consistency
2. Validate all ID references
3. Compile TypeScript
4. Start the server on port 3000

### Play the Game
1. Open your browser to `http://localhost:3000`
2. Create a new account or login
3. Type `help` to see available commands

### Development Tools
```bash
npm run validate-map      # Run map validator standalone
npm run validate-ids      # Run ID validator standalone
npm run build            # Compile TypeScript only
```

## 🎮 Commands

### Movement
- `north, south, east, west` (or `n, s, e, w`) - Move in cardinal directions
- `northeast, northwest, southeast, southwest` (or `ne, nw, se, sw`) - Move diagonally
- `up, down` (or `u, d`) - Move vertically
- `map` or `m` - Show visual ASCII map

### Combat
- `attack <enemy>` (or `hit, strike`) - Attack an enemy
- `flee` (or `run`) - Escape from combat

### Items & Equipment
- `inventory` or `i` - Show your inventory
- `get <item>` or `take <item>` - Pick up an item from the ground
- `equip <item>` - Equip a weapon, armor, or shield
- `wield <weapon>` - Wield a weapon
- `wear <armor/shield>` - Wear armor or shield
- `remove <slot>` - Remove equipment (weapon, armor, shield)
- `use <item>` - Use a consumable item
- `give <item> <player>` - Give an item to another player

### Social & Communication
- `say <message>` - Say something to everyone in the room
- `whisper <player> <message>` (or `wis`) - Send a private message
- `reply <message>` (or `r`) - Reply to last whisper
- `who` or `online` - See who's online
- `friend <player>` - Add/remove friend
- `friends` - Show friends list

### Trading
- `trade <player>` - Start a trade with another player
- `offer <item>` - Offer an item in trade
- `offer <amount> gold` - Offer gold in trade
- `ready` - Mark yourself as ready in trade
- `accept` - Accept and complete the trade
- `cancel` - Cancel the trade

### NPCs, Quests & Shops
- `talk <npc>` (or `speak`) - Talk to an NPC (discover quests)
- `quest` or `quests` - Show your active and completed quests
- `list` - List shop inventory
- `buy <item>` - Buy an item from a shop
- `sell <item>` - Sell an item to a shop

### Teleportation
- `homestone` - Set your homestone to current location
- `recall` - Teleport to your homestone

### Info Commands
- `look` or `l` - Look around your current location
- `help` - Show available commands

## 📁 Project Structure

```
mudden/
├── src/                      # TypeScript source code
│   ├── server.ts            # Main game server (~3,800 lines)
│   ├── types.ts             # TypeScript interfaces (~180 lines)
│   └── auth.ts              # Authentication system (~250 lines)
├── tools/                    # Development tools
│   ├── map-validator.ts     # Grid consistency checker & auto-fix
│   └── id-validator.ts      # Reference validator
├── client/                   # Web-based terminal client
│   ├── index.html           # Client HTML
│   └── style.css            # Terminal-style CSS
├── data/                     # JSON game content (data-driven)
│   ├── locations.json       # World map with grid coordinates
│   ├── items.json           # All items (weapons, armor, consumables)
│   ├── enemies.json         # Enemy definitions with drops
│   ├── npcs.json            # NPCs with dialogue
│   ├── quests.json          # Quest definitions
│   ├── shops.json           # Shop inventories
│   └── defaults.json        # Game configuration
├── persist/                  # Player data storage
│   └── players/             # Individual player JSON files
└── dist/                     # Compiled JavaScript
```

## 🎨 Game Content (Data-Driven)

All game content is defined in JSON files in the `data/` directory:

- **Locations** - Rooms with descriptions, exits, enemies, NPCs, and shops
- **Items** - Weapons, armor, shields, consumables, and teleportation items
- **Enemies** - Monsters with stats, gold, XP, drop rates, and respawn timers
- **NPCs** - Characters with dialogue, quests, and homestone services
- **Quests** - Kill, collect, and visit quests with prerequisites and rewards
- **Shops** - Item inventories with pricing and margins
- **Defaults** - Global game configuration (level progression, combat, items)

### Quest-Based Spawning System

The game features a powerful quest-based spawning system that allows enemies and ground items to appear based on player quest progression.

#### Ground Items (locations.json)

Ground items in locations can have quest prerequisites, respawn timers, and one-time flags:

```json
"groundItems": [
  {
    "itemId": "health_potion",
    "respawnTime": 60000
  },
  {
    "itemId": "quest_sword",
    "prerequisiteActiveQuests": ["find_legendary_sword"],
    "oneTime": true
  },
  {
    "itemId": "magic_scroll",
    "prerequisiteCompletedQuests": ["wizard_quest"],
    "respawnTime": 300000
  }
]
```

**Properties:**
- `itemId` (required) - Reference to item in items.json
- `respawnTime` (optional) - Milliseconds before item respawns after pickup
- `prerequisiteActiveQuests` (optional) - Only visible if player has ALL these quests active
- `prerequisiteCompletedQuests` (optional) - Only visible if player completed ALL these quests
- `oneTime` (optional) - If true, item only appears once per player (never respawns after pickup)

**Behavior:**
- Items without `respawnTime` can only be picked up once (disappear forever)
- Items with `respawnTime` reappear after specified time (unless `oneTime` is true)
- One-time items are tracked per player and location (`locationId.itemId`)
- Each player sees different items based on their quest progression

#### Enemies (locations.json)

Enemies in locations can also have quest prerequisites and one-time flags:

```json
"enemies": [
  {
    "enemyId": "goblin"
  },
  {
    "enemyId": "quest_boss",
    "prerequisiteActiveQuests": ["find_dragon"],
    "oneTime": true
  },
  {
    "enemyId": "guardian",
    "prerequisiteCompletedQuests": ["complete_trial"],
    "oneTime": false
  }
]
```

**Properties:**
- `enemyId` (required) - Reference to enemy in enemies.json
- `prerequisiteActiveQuests` (optional) - Only spawns if player has ALL these quests active
- `prerequisiteCompletedQuests` (optional) - Only spawns if player completed ALL these quests
- `oneTime` (optional) - If true, enemy only spawns once per player (never respawns after defeat)

**Behavior:**
- Simple string format `"goblin"` works for enemies without prerequisites
- Enemies are always in the location, but only visible to players who meet prerequisites
- One-time enemies are tracked per player and location (`locationId.enemyId`)
- Each player sees different enemies based on their quest progression
- Respawn time comes from enemy definition in enemies.json

**Use Cases:**
- Quest-specific boss fights that only appear when quest is active
- Tutorial enemies that disappear after first defeat
- Progression-gated content that unlocks after completing previous quests
- Location-specific one-time encounters
- Dynamic world that changes based on player progression

## 📊 Code Statistics

- **Total LOC**: ~3,800 lines
- **Server**: ~3,800 lines (server.ts)
- **Auth**: ~250 lines (auth.ts)
- **Types**: ~180 lines (types.ts)
- **Validators**: ~400 lines (tools/)
- **Client**: Minimal terminal interface
- **Status**: ~95% complete (5 features remaining, see TODO.md)

## 🎯 Remaining Features

See [TODO.md](TODO.md) for the 5 final features needed for feature-complete status:
1. Drop items to ground
2. Take items from ground
3. Pre-defined ground items with respawn
4. Examine enemies (difficulty assessment)
5. Examine players (equipment inspection)

## 📖 Documentation

- [ROADMAP.md](ROADMAP.md) - Development roadmap and progress
- [TODO.md](TODO.md) - Final features checklist
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Development guidelines

## 🧪 Architecture

- **Server**: Pure TypeScript, no game engine frameworks
- **Real-time**: Socket.IO for multiplayer
- **Storage**: File-based JSON (no database needed)
- **Validation**: Pre-build validators ensure data integrity
- **Grid System**: Coordinate-based world with 10-direction movement
- **Type Safety**: Full TypeScript interfaces for all entities

## 📝 Development

- Server runs on port 3000
- Web client served from server
- Player data stored in `persist/players/`
- Real-time updates via Socket.IO
- Hot reload with `npm run dev`
- Validators run automatically on build

## 📄 License

MIT