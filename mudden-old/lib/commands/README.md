# Commands Directory

This directory contains the modular command system for the Simple MUD. Commands are organized into logical categories for better maintainability and code organization.

## File Structure

- **BaseCommand.js** - Base class with shared utilities (fuzzy matching, helper methods)
- **CommandManager.js** - Main manager that loads and coordinates all command categories
- **MovementCommands.js** - Movement and navigation (look, go, north/south/east/west)
- **InventoryCommands.js** - Inventory management (inventory, take, equip, use)
- **CombatCommands.js** - Combat system (attack, defend, flee)
- **SocialCommands.js** - Social interactions (say, tell, talk)
- **InfoCommands.js** - Information commands (stats, health, help)
- **SystemCommands.js** - System commands (save, quit, logout, password)

## Architecture

Each command category:
1. Extends `BaseCommand` for shared functionality
2. Implements `getCommands()` method returning command mappings
3. Contains focused, related command implementations
4. Has access to game state through constructor parameters

## Adding New Commands

1. **New command in existing category**: Add method to appropriate class and update `getCommands()`
2. **New command category**: Create new class extending `BaseCommand`, add to `CommandManager.js`
3. **All commands have access to**:
   - `this.gameWorld` - Game content and rooms
   - `this.players` - Active player sessions  
   - `this.combatSessions` - Combat state
   - `this.io` - Socket.io server for messaging

## Benefits

- **Maintainability**: Related commands grouped together
- **Readability**: Smaller, focused files instead of one huge file
- **Extensibility**: Easy to add new command categories
- **Shared Code**: Common utilities in BaseCommand
- **Performance**: Only loads commands that are actually used