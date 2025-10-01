# Mudden v2 - New Architecture Design

## Overview

Complete rewrite of Mudden MUD server with tick-based architecture, data-driven protocol, and support for both text and graphical clients.

## Core Principles

### 1. Tick-Based Processing
- **1-second tick cycle** (like RuneScape)
- Commands collected → processed atomically → updates distributed
- Predictable, scalable, multiplayer-native

### 2. Data-Driven Protocol
- Server sends structured data, never text messages
- Client handles all presentation (text formatting, graphics, i18n)
- Commands use typed classes with integer constants

### 3. Client-Agnostic Design
- Same protocol works for text MUD and graphical clients
- Server focuses on game logic, clients handle UI/UX
- Full internationalization support

### 4. Strongly Typed Commands
- Each command/packet type has its own class
- Integer constants for command types (no string matching)
- Clear API contracts between client and server

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Text Client              │  Graphical Client (Future)      │
│  - Fuzzy Matching         │  - 3D Rendering                 │
│  - Text Formatting        │  - UI Components                │
│  - Command Parsing        │  - Asset Management             │
│  - Response Display       │  - Animation System             │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   SOCKET.IO       │
                    │   (Commands Up)   │
                    │   (Updates Down)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                      GameEngine                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              TICK CYCLE (1000ms)                        ││
│  │                                                         ││
│  │  [0ms-1000ms]  Command Collection Phase                 ││
│  │  │ ┌─────────────────────────────────────────────────┐ ││
│  │  │ │          CommandQueue                           │ ││
│  │  │ │  - Collect commands from all clients            │ ││
│  │  │ │  - Validate command structure                   │ ││
│  │  │ │  - Queue for processing                         │ ││
│  │  │ └─────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │  [1000ms]      Processing Phase                         ││
│  │  │ ┌─────────────────────────────────────────────────┐ ││
│  │  │ │          TickProcessor                          │ ││
│  │  │ │  - Process commands atomically                  │ ││
│  │  │ │  - Handle conflicts/validation                  │ ││
│  │  │ │  - Generate state updates                       │ ││
│  │  │ └─────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │  [1000ms]      Distribution Phase                       ││
│  │  │ ┌─────────────────────────────────────────────────┐ ││
│  │  │ │        UpdateDistributor                        │ ││
│  │  │ │  - Group updates by affected players            │ ││
│  │  │ │  - Send updates to relevant clients             │ ││
│  │  │ │  - Handle client disconnections                 │ ││
│  │  │ └─────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│                    Manager Layer                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  PlayerManager    WorldManager     InventoryManager     ││
│  │  CombatManager    EquipmentManager  TradeManager        ││
│  │  QuestManager     SocialManager    AuthManager          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│                     Data Layer                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  TemplateManager  │  PlayerStorage  │  WorldState       ││
│  │  (Items, NPCs,    │  (JSON Files)   │  (Runtime Data)   ││
│  │   Quests, etc.)   │                 │                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Command System Design

### Command Type Constants

```javascript
// src/shared/CommandTypes.js
export const CommandTypes = {
  // Movement Commands (1-99)
  MOVE: 1,
  LOOK: 2,
  
  // Inventory Commands (100-199)  
  TAKE_ITEM: 100,
  DROP_ITEM: 101,
  USE_ITEM: 102,
  GIVE_ITEM: 103,
  
  // Equipment Commands (200-299)
  EQUIP_ITEM: 200,
  UNEQUIP_ITEM: 201,
  
  // Social Commands (300-399)
  SAY: 300,
  TELL: 301,
  EMOTE: 302,
  
  // Combat Commands (400-499)
  ATTACK: 400,
  CAST_SPELL: 401,
  
  // Trade Commands (500-599)
  TRADE_REQUEST: 500,
  TRADE_ADD_ITEM: 501,
  TRADE_ACCEPT: 502,
  TRADE_CANCEL: 503,
  
  // System Commands (900-999)
  PING: 900,
  DISCONNECT: 901
}

export const UpdateTypes = {
  // Player Updates (1-99)
  PLAYER_MOVED: 1,
  PLAYER_STATS_CHANGED: 2,
  PLAYER_ENTERED_ROOM: 3,
  PLAYER_LEFT_ROOM: 4,
  
  // Inventory Updates (100-199)
  INVENTORY_CHANGED: 100,
  EQUIPMENT_CHANGED: 101,
  
  // World Updates (200-299)
  ROOM_STATE_CHANGED: 200,
  ITEM_SPAWNED: 201,
  ITEM_REMOVED: 202,
  
  // Combat Updates (300-399)
  DAMAGE_DEALT: 300,
  HEALTH_CHANGED: 301,
  COMBAT_STARTED: 302,
  COMBAT_ENDED: 303,
  
  // Error Updates (800-899)
  COMMAND_ERROR: 800,
  VALIDATION_ERROR: 801,
  PERMISSION_ERROR: 802,
  
  // System Updates (900-999)
  TICK_UPDATE: 900,
  SERVER_MESSAGE: 901
}
```

### Command Classes

```javascript
// src/shared/commands/BaseCommand.js
export class BaseCommand {
  constructor(type, playerId, commandId = null) {
    this.type = type
    this.playerId = playerId
    this.commandId = commandId || this.generateId()
    this.timestamp = Date.now()
  }
  
  generateId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  validate() {
    throw new Error('validate() must be implemented by subclass')
  }
  
  toJSON() {
    return {
      type: this.type,
      playerId: this.playerId,
      commandId: this.commandId,
      timestamp: this.timestamp,
      ...this.getPayload()
    }
  }
  
  getPayload() {
    throw new Error('getPayload() must be implemented by subclass')
  }
}

// src/shared/commands/MoveCommand.js
export class MoveCommand extends BaseCommand {
  constructor(playerId, direction, commandId = null) {
    super(CommandTypes.MOVE, playerId, commandId)
    this.direction = direction
  }
  
  validate() {
    const validDirections = ['north', 'south', 'east', 'west', 'up', 'down']
    if (!validDirections.includes(this.direction)) {
      throw new Error(`Invalid direction: ${this.direction}`)
    }
    return true
  }
  
  getPayload() {
    return {
      direction: this.direction
    }
  }
}

// src/shared/commands/EquipItemCommand.js
export class EquipItemCommand extends BaseCommand {
  constructor(playerId, itemId, commandId = null) {
    super(CommandTypes.EQUIP_ITEM, playerId, commandId)
    this.itemId = itemId
  }
  
  validate() {
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId
    }
  }
}

// src/shared/commands/TakeItemCommand.js
export class TakeItemCommand extends BaseCommand {
  constructor(playerId, itemId, quantity = 1, commandId = null) {
    super(CommandTypes.TAKE_ITEM, playerId, commandId)
    this.itemId = itemId
    this.quantity = quantity
  }
  
  validate() {
    if (!this.itemId || typeof this.itemId !== 'string') {
      throw new Error('itemId is required and must be a string')
    }
    if (this.quantity < 1 || !Number.isInteger(this.quantity)) {
      throw new Error('quantity must be a positive integer')
    }
    return true
  }
  
  getPayload() {
    return {
      itemId: this.itemId,
      quantity: this.quantity
    }
  }
}
```

### Update Classes

```javascript
// src/shared/updates/BaseUpdate.js
export class BaseUpdate {
  constructor(type, affectedPlayers = []) {
    this.type = type
    this.affectedPlayers = affectedPlayers
    this.timestamp = Date.now()
  }
  
  toJSON() {
    return {
      type: this.type,
      affectedPlayers: this.affectedPlayers,
      timestamp: this.timestamp,
      data: this.getData()
    }
  }
  
  getData() {
    throw new Error('getData() must be implemented by subclass')
  }
}

// src/shared/updates/PlayerMovedUpdate.js
export class PlayerMovedUpdate extends BaseUpdate {
  constructor(playerId, commandId, newRoom, oldRoom) {
    super(UpdateTypes.PLAYER_MOVED, [playerId])
    this.playerId = playerId
    this.commandId = commandId
    this.newRoom = newRoom
    this.oldRoom = oldRoom
  }
  
  getData() {
    return {
      playerId: this.playerId,
      commandId: this.commandId,
      newRoom: this.newRoom,
      oldRoom: this.oldRoom
    }
  }
}

// src/shared/updates/PlayerEnteredRoomUpdate.js
export class PlayerEnteredRoomUpdate extends BaseUpdate {
  constructor(roomPlayers, newPlayer, playerData) {
    super(UpdateTypes.PLAYER_ENTERED_ROOM, roomPlayers)
    this.newPlayer = newPlayer
    this.playerData = playerData
  }
  
  getData() {
    return {
      newPlayer: this.newPlayer,
      playerData: this.playerData
    }
  }
}

// src/shared/updates/InventoryChangedUpdate.js
export class InventoryChangedUpdate extends BaseUpdate {
  constructor(playerId, inventoryData, changedItems) {
    super(UpdateTypes.INVENTORY_CHANGED, [playerId])
    this.inventoryData = inventoryData
    this.changedItems = changedItems
  }
  
  getData() {
    return {
      inventory: this.inventoryData,
      changedItems: this.changedItems
    }
  }
}

// src/shared/updates/CommandErrorUpdate.js
export class CommandErrorUpdate extends BaseUpdate {
  constructor(playerId, commandId, errorCode, errorData = {}) {
    super(UpdateTypes.COMMAND_ERROR, [playerId])
    this.commandId = commandId
    this.errorCode = errorCode
    this.errorData = errorData
  }
  
  getData() {
    return {
      commandId: this.commandId,
      errorCode: this.errorCode,
      errorData: this.errorData
    }
  }
}
```

### Error Code Constants

```javascript
// src/shared/ErrorCodes.js
export const ErrorCodes = {
  // General Errors (1-99)
  UNKNOWN_ERROR: 1,
  INVALID_COMMAND: 2,
  PLAYER_NOT_FOUND: 3,
  INSUFFICIENT_PERMISSIONS: 4,
  
  // Movement Errors (100-199)
  NO_EXIT: 100,
  EXIT_BLOCKED: 101,
  INSUFFICIENT_LEVEL: 102,
  
  // Inventory Errors (200-299)
  ITEM_NOT_FOUND: 200,
  ITEM_NOT_IN_INVENTORY: 201,
  INVENTORY_FULL: 202,
  INSUFFICIENT_QUANTITY: 203,
  ITEM_NOT_TAKEABLE: 204,
  
  // Equipment Errors (300-399)
  ITEM_NOT_EQUIPPABLE: 300,
  WRONG_EQUIPMENT_SLOT: 301,
  SLOT_ALREADY_OCCUPIED: 302,
  ITEM_NOT_EQUIPPED: 303,
  CANNOT_UNEQUIP_BAG: 304,
  
  // Combat Errors (400-499)
  TARGET_NOT_FOUND: 400,
  ALREADY_IN_COMBAT: 401,
  TARGET_DEAD: 402,
  NOT_IN_COMBAT: 403,
  INSUFFICIENT_MANA: 404,
  
  // Social Errors (500-599)
  PLAYER_OFFLINE: 500,
  PLAYER_BLOCKED: 501,
  INVALID_MESSAGE: 502,
  
  // Trade Errors (600-699)
  ALREADY_IN_TRADE: 600,
  NOT_IN_TRADE: 601,
  TRADE_PARTNER_NOT_FOUND: 602,
  INSUFFICIENT_GOLD: 603
}
```

## Server Architecture

### GameEngine - Main Controller

```javascript
// src/server/GameEngine.js
export class GameEngine {
  constructor() {
    this.commandQueue = new CommandQueue()
    this.tickProcessor = new TickProcessor()
    this.updateDistributor = new UpdateDistributor()
    this.managers = this.initializeManagers()
    
    this.tickInterval = 1000 // 1 second
    this.currentTick = 0
    this.isRunning = false
  }
  
  start() {
    this.isRunning = true
    this.tickLoop()
    console.log('GameEngine started with 1-second tick cycle')
  }
  
  async tickLoop() {
    while (this.isRunning) {
      const tickStart = Date.now()
      
      try {
        await this.processTick()
      } catch (error) {
        console.error(`Tick ${this.currentTick} error:`, error)
      }
      
      const tickDuration = Date.now() - tickStart
      const sleepTime = Math.max(0, this.tickInterval - tickDuration)
      
      if (tickDuration > this.tickInterval) {
        console.warn(`Tick ${this.currentTick} took ${tickDuration}ms (over budget)`)
      }
      
      await this.sleep(sleepTime)
    }
  }
  
  async processTick() {
    this.currentTick++
    
    // Get all commands from this tick cycle
    const commands = this.commandQueue.getAndClear()
    
    if (commands.length > 0) {
      console.log(`Tick ${this.currentTick}: Processing ${commands.length} commands`)
      
      // Process all commands atomically
      const updates = await this.tickProcessor.processCommands(commands, this.managers)
      
      // Distribute updates to clients
      if (updates.length > 0) {
        this.updateDistributor.distribute(updates)
        console.log(`Tick ${this.currentTick}: Sent ${updates.length} updates`)
      }
    }
  }
  
  addCommand(command) {
    try {
      command.validate()
      this.commandQueue.add(command)
    } catch (error) {
      // Send immediate error response for invalid commands
      const errorUpdate = new CommandErrorUpdate(
        command.playerId,
        command.commandId,
        ErrorCodes.INVALID_COMMAND,
        { error: error.message }
      )
      this.updateDistributor.sendToPlayer(command.playerId, errorUpdate)
    }
  }
}
```

### Command Processing

```javascript
// src/server/CommandQueue.js
export class CommandQueue {
  constructor() {
    this.commands = []
  }
  
  add(command) {
    this.commands.push({
      command,
      receivedAt: Date.now()
    })
  }
  
  getAndClear() {
    const commands = [...this.commands]
    this.commands = []
    return commands
  }
}

// src/server/TickProcessor.js
export class TickProcessor {
  constructor() {
    this.commandHandlers = new Map()
    this.initializeHandlers()
  }
  
  initializeHandlers() {
    this.commandHandlers.set(CommandTypes.MOVE, this.handleMoveCommand.bind(this))
    this.commandHandlers.set(CommandTypes.TAKE_ITEM, this.handleTakeItemCommand.bind(this))
    this.commandHandlers.set(CommandTypes.EQUIP_ITEM, this.handleEquipItemCommand.bind(this))
    // ... register all command handlers
  }
  
  async processCommands(commandEntries, managers) {
    const updates = []
    
    // Sort commands by priority/dependency
    const sortedCommands = this.sortCommands(commandEntries)
    
    for (const { command } of sortedCommands) {
      try {
        const handler = this.commandHandlers.get(command.type)
        if (!handler) {
          updates.push(new CommandErrorUpdate(
            command.playerId,
            command.commandId,
            ErrorCodes.UNKNOWN_COMMAND
          ))
          continue
        }
        
        const commandUpdates = await handler(command, managers)
        updates.push(...commandUpdates)
        
      } catch (error) {
        console.error(`Command ${command.commandId} error:`, error)
        updates.push(new CommandErrorUpdate(
          command.playerId,
          command.commandId,
          ErrorCodes.UNKNOWN_ERROR,
          { error: error.message }
        ))
      }
    }
    
    return updates
  }
  
  async handleMoveCommand(command, managers) {
    const { playerManager, worldManager } = managers
    const player = playerManager.getPlayer(command.playerId)
    
    if (!player) {
      return [new CommandErrorUpdate(
        command.playerId,
        command.commandId,
        ErrorCodes.PLAYER_NOT_FOUND
      )]
    }
    
    const moveResult = worldManager.movePlayer(player, command.direction)
    
    if (!moveResult.success) {
      return [new CommandErrorUpdate(
        command.playerId,
        command.commandId,
        moveResult.errorCode,
        moveResult.errorData
      )]
    }
    
    const updates = []
    
    // Update for moving player
    updates.push(new PlayerMovedUpdate(
      player.id,
      command.commandId,
      moveResult.newRoom,
      moveResult.oldRoom
    ))
    
    // Updates for other players in old room
    if (moveResult.oldRoomPlayers.length > 0) {
      updates.push(new PlayerLeftRoomUpdate(
        moveResult.oldRoomPlayers,
        player.id,
        { name: player.name, level: player.level }
      ))
    }
    
    // Updates for players in new room
    if (moveResult.newRoomPlayers.length > 0) {
      updates.push(new PlayerEnteredRoomUpdate(
        moveResult.newRoomPlayers,
        player.id,
        { name: player.name, level: player.level }
      ))
    }
    
    return updates
  }
}
```

## Client Architecture

### Text Client Design

```javascript
// src/client/TextClient.js
export class TextClient {
  constructor() {
    this.socket = io()
    this.templateCache = new TemplateCache()
    this.fuzzyMatcher = new FuzzyMatcher()
    this.commandParser = new CommandParser()
    this.responseFormatter = new ResponseFormatter()
    this.uiManager = new UIManager()
    
    this.setupSocketEvents()
  }
  
  setupSocketEvents() {
    this.socket.on('tick_update', (updateData) => {
      this.processUpdates(updateData.updates)
    })
    
    this.socket.on('template_data', (templates) => {
      this.templateCache.load(templates)
    })
  }
  
  processCommand(input) {
    try {
      const command = this.commandParser.parse(input, this.templateCache, this.fuzzyMatcher)
      this.socket.emit('command', command.toJSON())
      
      // Show command echo
      this.uiManager.showCommandEcho(input)
      
    } catch (error) {
      this.uiManager.showError(`Invalid command: ${error.message}`)
    }
  }
  
  processUpdates(updates) {
    for (const update of updates) {
      const updateObj = this.deserializeUpdate(update)
      this.handleUpdate(updateObj)
    }
  }
  
  handleUpdate(update) {
    switch (update.type) {
      case UpdateTypes.PLAYER_MOVED:
        this.handlePlayerMoved(update)
        break
      case UpdateTypes.INVENTORY_CHANGED:
        this.handleInventoryChanged(update)
        break
      case UpdateTypes.COMMAND_ERROR:
        this.handleCommandError(update)
        break
      // ... handle all update types
    }
  }
}

// src/client/CommandParser.js
export class CommandParser {
  parse(input, templateCache, fuzzyMatcher) {
    const tokens = input.trim().split(/\s+/)
    const verb = tokens[0].toLowerCase()
    const args = tokens.slice(1)
    
    switch (verb) {
      case 'move':
      case 'go':
      case 'north':
      case 'south':
      case 'east':
      case 'west':
        return this.parseMoveCommand(verb, args)
        
      case 'take':
      case 'get':
        return this.parseTakeCommand(args, templateCache, fuzzyMatcher)
        
      case 'equip':
      case 'wear':
        return this.parseEquipCommand(args, templateCache, fuzzyMatcher)
        
      default:
        throw new Error(`Unknown command: ${verb}`)
    }
  }
  
  parseTakeCommand(args, templateCache, fuzzyMatcher) {
    if (args.length === 0) {
      throw new Error('Take what?')
    }
    
    const itemName = args.join(' ')
    const roomItems = templateCache.getRoomItems() // Current room items
    const matchedItem = fuzzyMatcher.findBestMatch(roomItems, itemName)
    
    if (!matchedItem) {
      throw new Error(`You don't see "${itemName}" here`)
    }
    
    return new TakeItemCommand('current_player_id', matchedItem.id)
  }
}

// src/client/ResponseFormatter.js
export class ResponseFormatter {
  constructor() {
    this.errorMessages = this.loadErrorMessages()
  }
  
  formatPlayerMoved(update) {
    const room = update.data.newRoom
    return `
${room.name}
${room.description}
${this.formatExits(room.exits)}
${this.formatRoomContents(room.items, room.npcs, room.players)}
    `.trim()
  }
  
  formatCommandError(update) {
    const errorTemplate = this.errorMessages[update.data.errorCode]
    if (!errorTemplate) {
      return `Unknown error occurred.`
    }
    
    return this.interpolateTemplate(errorTemplate, update.data.errorData)
  }
  
  loadErrorMessages() {
    return {
      [ErrorCodes.NO_EXIT]: "There is no exit to the {direction}.",
      [ErrorCodes.ITEM_NOT_FOUND]: "You don't see '{itemId}' here.",
      [ErrorCodes.INVENTORY_FULL]: "Your inventory is full.",
      // ... all error message templates
    }
  }
}
```

## Project Structure

```
mudden-v2/
├── src/
│   ├── shared/                 # Shared between client and server
│   │   ├── commands/           # Command classes
│   │   ├── updates/            # Update classes  
│   │   ├── CommandTypes.js     # Command type constants
│   │   ├── UpdateTypes.js      # Update type constants
│   │   └── ErrorCodes.js       # Error code constants
│   │
│   ├── server/                 # Server-side code
│   │   ├── GameEngine.js       # Main game loop
│   │   ├── CommandQueue.js     # Command collection
│   │   ├── TickProcessor.js    # Command processing
│   │   ├── UpdateDistributor.js # Update distribution
│   │   ├── managers/           # Game logic managers
│   │   │   ├── PlayerManager.js
│   │   │   ├── WorldManager.js
│   │   │   ├── InventoryManager.js
│   │   │   ├── EquipmentManager.js
│   │   │   └── CombatManager.js
│   │   └── SocketManager.js    # Socket.IO handling
│   │
│   ├── client/                 # Text client
│   │   ├── TextClient.js       # Main client class
│   │   ├── CommandParser.js    # Input parsing + fuzzy matching
│   │   ├── ResponseFormatter.js # Update formatting
│   │   ├── TemplateCache.js    # Client-side data cache
│   │   ├── FuzzyMatcher.js     # Fuzzy matching logic
│   │   └── UIManager.js        # Output handling
│   │
│   └── data/                   # Game data (same as current)
│       ├── areas/
│       ├── items/
│       ├── npcs/
│       └── quests/
│
├── public/                     # Static web files
│   ├── index.html
│   ├── style.css
│   └── client.js               # Compiled client bundle
│
├── package.json
└── README.md
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. **Shared Types**: Command/Update classes, constants
2. **GameEngine**: Basic tick loop, command queue
3. **Socket Layer**: Command/update serialization

### Phase 2: Basic Commands (Week 2)  
4. **Movement System**: Move, look commands
5. **Inventory System**: Take, drop, inventory commands
6. **Text Client**: Basic parsing and display

### Phase 3: Game Features (Week 3)
7. **Equipment System**: Equip, unequip commands
8. **Combat System**: Attack, health, damage
9. **Social Features**: Say, tell, emote

### Phase 4: Advanced Features (Week 4)
10. **NPCs & Quests**: Talk, quest system
11. **Trading System**: Player-to-player trading
12. **Polish**: Error handling, optimization

## Benefits of This Architecture

### 1. **Strongly Typed**
- Clear API contracts with command/update classes
- Integer constants for performance (no string matching)
- Compile-time validation with TypeScript (future)

### 2. **Scalable**
- Tick-based processing handles load spikes
- Atomic updates prevent race conditions  
- Easy to add new commands/updates

### 3. **Maintainable**
- Clear separation of concerns
- Consistent patterns throughout
- Easy to test individual components

### 4. **Future-Proof**
- Protocol supports graphical clients
- Internationalization built-in
- Easy to extend with new features

### 5. **Performance**
- Integer command types (fast switching)
- Batched update distribution
- Efficient serialization with classes

This architecture provides a solid foundation for both the current text MUD and future graphical client, with excellent maintainability and performance characteristics.