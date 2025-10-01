# Mudden v2 - Clean Architecture MUD# Mudden - Simple MUD Game



A modern Multi-User Dungeon (MUD) game built with clean architecture principles, featuring tick-based processing and complete client-server separation.A clean, extensible Multi-User Dungeon (MUD) game built with modern web technologies, prioritizing simplicity and maintainability.



## 🎯 Design Philosophy## 🎯 Design Philosophy



**Clean Architecture MUD** with professional separation of concerns and modern development practices.**Simple, JSON-driven MUD** that can be built and modified quickly while maintaining rich content systems.



- **Clean Architecture** - Complete separation between client and server- **Simplicity First** - Minimal code, maximum functionality

- **Tick-Based Processing** - Centralized game loop with 1-second ticks- **JSON-Driven Content** - All game data in easily editable JSON files

- **Data-Driven Protocol** - Structured communication using numeric constants- **File-Based Persistence** - No database complexity, just JSON saves

- **Manager Pattern** - Business logic in dedicated manager classes- **Real-Time Experience** - WebSocket-based communication

- **Multiple Client Support** - Architecture supports web, desktop, mobile clients- **Zero Build Process** - Run with `npm run dev`

- **Security First** - Server serves no files, pure WebSocket communication

## 🚀 Quick Start

## 🚀 Quick Start

```bash

### 1. Start the Servernpm install

```bashnpm run dev

npm install```

npm start

# Server runs on WebSocket port 3000Open http://localhost:3000 and start playing!

```

## 🏗️ Architecture

### 2. Run Web Client

```bash### Core Systems

# Use VS Code Live Server extension- **Movement**: Navigate between rooms using cardinal directions

# Open src/client/web/index.html with Live Server- **Inventory**: Pick up, drop, examine, and equip items

# Client will connect to WebSocket server automatically- **Combat**: Turn-based fighting with NPCs and automatic health recovery

```- **Quests**: JSON-driven quest system with progression tracking and reward inspection

- **Friends**: Add friends, track online status, and add personal notes

## 🏗️ Architecture- **Social**: Player communication, messaging system, and NPC interactions



### Server (src/server/)### Technical Features

- **Pure WebSocket Server** - No file serving, only game logic- **Modular Commands**: Organized in 8 logical categories (Movement, Combat, Social, Friends, etc.)

- **Tick-Based Engine** - 1-second game loop for all processing- **Global Tick System**: Centralized timing for combat and health recovery

- **Manager Pattern** - Dedicated managers for each game system- **Fuzzy Matching**: Intelligent command and item matching

- **Command Queue** - Collects and processes commands in batches- **Real-time Communication**: WebSocket connections via Socket.io

- **Update Distribution** - Efficient update broadcasting to clients- **Password Protection**: Secure character authentication with PBKDF2

- **Duplicate Login Prevention**: Robust session management

### Client (src/client/)

- **Web Client** (`web/`) - Browser-based interface using Socket.IO## 📁 Project Structure

- **Modular Design** - Ready for additional client implementations

- **Local Constants** - No server dependencies for shared constants```

- **Clean UI** - Modern, responsive interfacemudden/

├── server.js              # Main server file

### Shared (src/shared/)├── lib/

- **Protocol Definition** - Command types, update types, error codes│   ├── Player.js          # Player class and file operations

- **Command Factory** - Structured command creation and validation│   ├── WorldManager.js    # World state and content loading

- **Update System** - Standardized update format for all game events│   ├── CommandManager.js  # Command orchestration

│   ├── GameTickManager.js # Global tick system management

## 📁 Project Structure│   └── commands/          # Modular command system (8 categories)

├── persist/               # Player save files

```├── templates/             # Game content templates (JSON files)

mudden/│   ├── areas/             # Area and room definitions

├── src/│   ├── items/             # Item definitions with stats

│   ├── server/                # Game server│   ├── npcs/              # NPC definitions

│   │   ├── index.js          # Server entry point│   ├── quests/            # Quest definitions

│   │   ├── GameEngine.js     # Main game engine with tick processing│   └── enemies/           # Enemy definitions with loot tables

│   │   ├── SocketManager.js  # WebSocket connection management└── public/               # Client-side files

│   │   ├── CommandQueue.js   # Command collection and batching```

│   │   ├── TickProcessor.js  # Command processing and execution

│   │   ├── UpdateDistributor.js # Update broadcasting## 🎮 Key Features

│   │   └── managers/         # Business logic managers

│   │       ├── PlayerManager.js     # Player data and authentication### For Players

│   │       ├── WorldManager.js      # World state and rooms- **Rich World**: Explore areas, collect items, fight enemies

│   │       ├── InventoryManager.js  # Item management workflows- **Quest System**: Discover and complete quests, inspect reward items

│   │       ├── EquipmentManager.js  # Equipment system workflows- **Character Progression**: Level up, gain stats, equip better gear

│   │       ├── MovementManager.js   # Movement and room inspection- **Friends System**: Add friends, track online status, add personal notes

│   │       ├── SocialManager.js     # Chat and messaging systems- **Social Features**: Tell/reply messaging, chat with players, interact with NPCs

│   │       └── TemplateManager.js   # Game content loading- **Automatic Recovery**: Health regenerates automatically when not in combat

│   ├── client/

│   │   └── web/              # Web client implementation### For Developers

│   │       ├── index.html    # Main HTML file- **Easy Content Creation**: Add areas, items, NPCs, quests, and enemies via JSON files

│   │       ├── styles.css    # All CSS styles- **Modular Architecture**: Commands organized in 8 logical categories

│   │       └── js/           # Client JavaScript- **Global Tick System**: Centralized timing system for all game mechanics

│   │           ├── client.js       # Main client application- **Clean Codebase**: Modern ES6+ modules with consistent patterns

│   │           ├── ErrorCodes.js   # Error code constants- **Simple State Management**: File-based persistence without complex abstractions

│   │           ├── UpdateTypes.js  # Update type constants

│   │           └── CommandTypes.js # Command type constants## 🔧 Adding Content

│   └── shared/               # Shared protocol definitions

│       ├── ErrorCodes.js     # Centralized error constants### New Areas

│       ├── UpdateTypes.js    # Update type definitionsCreate JSON files in `templates/areas/` with room definitions and connections.

│       ├── CommandTypes.js   # Command type definitions

│       ├── CommandFactory.js # Command creation and validation### New Items

│       ├── BaseUpdate.js     # Base update classAdd item definitions to `templates/items/` with stats, descriptions, and effects.

│       └── commands/         # Command implementations

│           ├── BaseCommand.js      # Base command class### New Quests

│           ├── MovementCommands.js # Movement and lookingCreate quest files in `templates/quests/` with objectives, rewards, and dialogue.

│           ├── InventoryCommands.js # Item management

│           ├── EquipmentCommands.js # Equipment management### New Commands

│           └── SocialCommands.js   # Chat and messagingExtend `BaseCommand` and add to appropriate command category file.

├── templates/                # Game content (JSON files)

│   ├── areas/               # Room and area definitions## 📚 Documentation

│   ├── items/               # Item definitions with stats

│   ├── npcs/                # NPC definitions and dialogues- **[Design Document](mudden-design.md)** - Complete architecture overview

│   ├── quests/              # Quest definitions and rewards- **[Copilot Instructions](.github/copilot-instructions.md)** - Development guidelines

│   └── enemies/             # Enemy definitions and loot tables

└── persist/                 # Player save files and game state## 🎯 Philosophy

    └── players/             # Individual player data files

```This is a **Simple MUD** - emphasis on:

- **Clarity over cleverness**

## 🔧 Key Features- **Function over form** 

- **Maintainability over features**

### Clean Architecture Benefits- **User experience over technical complexity**

- **Testable Components** - Each manager can be unit tested independently

- **Maintainable Code** - Clear separation of concerns and responsibilitiesThe goal is to create an enjoyable, bug-free gaming experience with code that's easy to understand and modify.
- **Extensible Design** - Easy to add new features without breaking existing code
- **Multiple Clients** - Server architecture supports any client implementation

### Game Features
- **Movement System** - Navigate between rooms with intelligent room state management
- **Inventory System** - Complete item management with effects and consumables
- **Equipment System** - Multi-slot equipment affecting player stats
- **Social System** - Chat, messaging, and player interaction
- **Error Handling** - Structured error codes for internationalization

### Technical Features
- **Tick-Based Processing** - Consistent 1-second game loop for all operations
- **Command Batching** - Efficient processing of multiple commands per tick
- **Update Broadcasting** - Targeted update distribution to relevant players
- **Session Management** - Secure player authentication with duplicate login prevention
- **Real-time Communication** - WebSocket-based client-server communication

## 🎮 Development

### Adding New Features
1. **Business Logic** - Add methods to appropriate manager in `src/server/managers/`
2. **Commands** - Create command classes in `src/shared/commands/`
3. **Client Support** - Update client handlers in `src/client/web/js/`
4. **Constants** - Add error codes, update types, command types as needed

### Command Pattern
Commands follow clean architecture:
- **Validation** - Commands validate input parameters
- **Orchestration** - Commands call manager methods for business logic
- **Updates** - Commands create structured updates from manager results

### Manager Pattern
Managers handle all business logic:
- **State Management** - Managers own and modify game state
- **Workflow Methods** - High-level methods that handle complete operations
- **Data Integrity** - Managers ensure data consistency and validation

## 🚀 Deployment

### Development
- **Server**: `npm start` (WebSocket server on port 3000)
- **Client**: VS Code Live Server extension for web client

### Production
- **Server**: Deploy Node.js application with WebSocket support
- **Client**: Serve static files from any web server or CDN
- **Configuration**: Update client connection URL for production server

## 📚 Documentation

- **[Web Client README](src/client/web/README.md)** - Web client setup and usage
- **[Copilot Instructions](.github/copilot-instructions.md)** - Development guidelines

## 🎯 Philosophy

This is a **Professional MUD Architecture** emphasizing:
- **Clean Code** - Readable, maintainable, and testable
- **Separation of Concerns** - Each component has a single responsibility  
- **Scalability** - Architecture supports growth and multiple clients
- **Developer Experience** - Easy to understand, modify, and extend

The goal is to provide a solid foundation for MUD development with modern software engineering practices.