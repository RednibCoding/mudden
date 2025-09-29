# Mudden - Simple MUD Game

A clean, extensible Multi-User Dungeon (MUD) game built with modern web technologies, prioritizing simplicity and maintainability.

## 🎯 Design Philosophy

**Simple, JSON-driven MUD** that can be built and modified quickly while maintaining rich content systems.

- **Simplicity First** - Minimal code, maximum functionality
- **JSON-Driven Content** - All game data in easily editable JSON files
- **File-Based Persistence** - No database complexity, just JSON saves
- **Real-Time Experience** - WebSocket-based communication
- **Zero Build Process** - Run with `npm run dev`

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and start playing!

## 🏗️ Architecture

### Core Systems
- **Movement**: Navigate between rooms using cardinal directions
- **Inventory**: Pick up, drop, examine, and equip items
- **Combat**: Turn-based fighting with NPCs
- **Quests**: JSON-driven quest system with automatic progression tracking
- **Social**: Player communication and NPC interactions

### Technical Features
- **Modular Commands**: Organized in logical categories (Movement, Combat, Social, etc.)
- **CtxStateManager**: Scalable contextual state management with automatic cleanup
- **Fuzzy Matching**: Intelligent command and item matching
- **Real-time Communication**: WebSocket connections via Socket.io
- **Password Protection**: Secure character authentication

## 📁 Project Structure

```
mudden/
├── server.js              # Main server file
├── lib/
│   ├── Player.js          # Player class and file operations
│   ├── GameWorld.js       # World state and content loading
│   ├── CommandManager.js  # Command orchestration
│   ├── CtxStateManager.js # Contextual state management
│   └── commands/          # Modular command system
├── persist/               # Player save files
├── templates/             # Game content templates (JSON files)
│   ├── areas/             # Area and room definitions
│   ├── items/             # Item definitions with stats
│   ├── npcs/              # NPC definitions
│   ├── quests/            # Quest definitions
│   └── players/           # Player save files (auto-generated)
└── public/               # Client-side files
```

## 🎮 Key Features

### For Players
- **Rich World**: Explore areas, collect items, fight enemies
- **Quest System**: Discover and complete quests through NPC interactions
- **Character Progression**: Level up, gain stats, equip better gear
- **Social Features**: Chat with other players, interact with NPCs

### For Developers
- **Easy Content Creation**: Add areas, items, NPCs, and quests via JSON files
- **Modular Architecture**: Commands organized in logical categories
- **Scalable State Management**: CtxStateManager handles temporary states automatically
- **Clean Codebase**: Modern ES6+ modules with consistent patterns

## 🔧 Adding Content

### New Areas
Create JSON files in `templates/areas/` with room definitions and connections.

### New Items
Add item definitions to `templates/items/` with stats, descriptions, and effects.

### New Quests
Create quest files in `templates/quests/` with objectives, rewards, and dialogue.

### New Commands
Extend `BaseCommand` and add to appropriate command category file.

## 📚 Documentation

- **[Design Document](mudden-design.md)** - Complete architecture overview
- **[Copilot Instructions](.github/copilot-instructions.md)** - Development guidelines

## 🎯 Philosophy

This is a **Simple MUD** - emphasis on:
- **Clarity over cleverness**
- **Function over form** 
- **Maintainability over features**
- **User experience over technical complexity**

The goal is to create an enjoyable, bug-free gaming experience with code that's easy to understand and modify.