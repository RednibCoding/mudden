# 🗡️ MUDDEN - Multi-User Dungeon Game

A modern text-based adventure game (MUD) built with Nuxt 3, featuring a retro console interface and data-driven architecture.

## 🎮 Features

- **Text-Based Adventure**: Classic MUD gameplay with modern web interface
- **Data-Driven**: All game content (rooms, NPCs, items, enemies, quests) configured via JSON files
- **Modular Quest System**: Individual quest files for better organization and scalability
- **RESTful API**: Server routes provide clean API for game interactions
- **SQLite Database**: Lightweight, file-based database for player data and game state
- **Retro Console UI**: Green-on-black terminal aesthetic with Tailwind CSS
- **Real-time Updates**: Reactive game state management
- **Quest System**: Context-aware quest acceptance and abandonment with numbered selection
- **Extensible**: Easy to add new content and features

## 🚀 Getting Started

### Prerequisites

- Node.js 20.19+ (recommended)
- npm or yarn package manager

### Installation

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

### Database Setup

Initialize the SQLite database:

```bash
node scripts/setup-db.js
```

This creates the database file at `./database/mudden.db` with:
- Player accounts and character data
- Inventory system
- Game sessions and authentication
- Activity logs and statistics

## 🗄️ Database Management

### SQLite GUI Tools

Since we're using SQLite, you have several excellent GUI options:

#### 1. **DB Browser for SQLite** (Recommended - Free)
- **Download**: https://sqlitebrowser.org/
- **Features**: Visual query builder, data editing, schema design
- **Cross-platform**: Windows, macOS, Linux
- **Perfect for**: Beginners and general database management

#### 2. **DBeaver** (Free)
- **Download**: https://dbeaver.io/
- **Features**: Professional database tool, supports many databases
- **Advanced**: Query execution, data visualization, ER diagrams
- **Perfect for**: Advanced users and developers

#### 3. **SQLiteStudio** (Free)
- **Download**: https://sqlitestudio.pl/
- **Features**: Lightweight, portable, script execution
- **Cross-platform**: Windows, macOS, Linux
- **Perfect for**: Quick database browsing and editing

#### 4. **VS Code Extensions**
- **SQLite Viewer**: View database directly in VS Code
- **SQLite**: Run queries and manage databases
- **Perfect for**: Developers who prefer staying in their editor

### Command Line Access

You can also use the SQLite CLI:

```bash
# Install SQLite CLI (if not already installed)
sudo apt install sqlite3  # Ubuntu/Debian
brew install sqlite       # macOS

# Open database
sqlite3 database/mudden.db

# Common commands
.tables          # List all tables
.schema players  # Show table structure
SELECT * FROM players;  # Query data
.quit           # Exit
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

## 🗂️ Data Structure

### Quest System

The game uses a modular quest system where each quest is stored in its own JSON file:

```
data/quests/
├── README.md                           # Quest system documentation
├── blacksmith_first_weapon.json       # Individual quest files
├── guard_forest_patrol.json
├── innkeeper_delivery.json
└── blacksmith_advanced_forging.json
```

#### Creating New Quests

Use the quest generator script to create new quests quickly:

```bash
node scripts/create-quest.js my_new_quest
```

Or manually create a JSON file in `data/quests/` following the schema documented in `data/quests/README.md`.

#### Quest Features

- **Context-Aware Commands**: Players can use numbered selection ("accept 1", "abandon 2")
- **Quest Chains**: Prerequisites system allows complex quest dependencies
- **Multiple Objective Types**: Support for gather, kill, and fetch quest types
- **Repeatable Quests**: Individual quests can be marked as repeatable
- **Level Requirements**: Quests can have minimum level requirements
- **Rich Rewards**: Gold, XP, and item rewards supported

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
