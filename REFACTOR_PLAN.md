# Server-to-Client Fuzzy Matching Refactor Plan

## Goal
Move fuzzy matching from server to client, make server work with IDs only.
Create a generic, data-driven protocol that supports both text and graphical clients.

## Architecture Changes
- **Client**: Gets template data, does fuzzy matching, sends IDs to server
- **Server**: Only validates IDs, performs game logic, responds with structured data
- **Protocol**: Structured commands with IDs + structured data responses
- **Client-Agnostic**: Responses work for both text MUD and graphical (RuneScape-like) clients
- **Internationalization**: Server sends data codes, client handles text/translation

## Refactor Order (Easiest to Hardest)

### Phase 1: Simple Item Commands (Low Risk)
1. **`look <item>`** - Info command, read-only, simple item lookup
   - Client fuzzy matches inventory items → sends itemId
   - Server validates itemId exists in player inventory
   - **Risk**: Low (read-only operation)

2. **`use <item>`** - Item usage, straightforward item lookup
   - Client matches consumable items → sends itemId  
   - Server validates + consumes item by ID
   - **Risk**: Low (single item operation)

3. **`drop <item>`** - Inventory removal, simple validation
   - Client matches inventory items → sends itemId + quantity
   - Server validates + removes by ID
   - **Risk**: Low (simple inventory operation)

### Phase 2: Equipment Commands (Medium Risk)
4. **`equip <item>`** - Equipment system integration
   - Client matches equippable inventory items → sends itemId
   - Server validates + equips by ID via EquipmentManager
   - **Risk**: Medium (equipment state changes)

5. **`unequip <item>`** - Equipment removal
   - Client matches equipped items → sends slot or itemId
   - Server validates + unequips by ID/slot
   - **Risk**: Medium (equipment state changes)

### Phase 3: World Interaction Commands (Medium Risk)
6. **`take <item>`** - Room item pickup
   - Client matches room items → sends itemId
   - Server validates item exists in room + adds to inventory
   - **Risk**: Medium (world state changes)

7. **`talk <npc>`** - NPC interaction
   - Client matches NPCs in room → sends npcId
   - Server validates NPC exists in room + handles dialogue
   - **Risk**: Medium (NPC state, quest integration)

### Phase 4: Social/Trade Commands (High Risk)
8. **`trade <player> <item>`** - Trading system
   - Client matches players + items → sends playerId + itemId
   - Server validates both exist + handles trade logic
   - **Risk**: High (multi-player state, complex validation)

9. **`tell <player>`** - Player messaging
   - Client matches online players → sends playerId + message
   - Server validates player online + sends message
   - **Risk**: Medium (player lookup, but simpler than trade)

### Phase 5: Combat Commands (Highest Risk)
10. **`attack <target>`** - Combat targeting
    - Client matches enemies/players in room → sends targetId
    - Server validates target + handles combat
    - **Risk**: Very High (combat state, real-time implications)

## Implementation Strategy Per Command

### 1. Client-Side Changes
- Add template data loading (items, NPCs, etc.)
- Implement fuzzy matching utilities
- Create command parsing with ID resolution
- Update command sending to use structured format

### 2. Server-Side Changes  
- Update command classes to expect IDs
- Remove fuzzy matching from managers
- Add ID validation methods
- Maintain backward compatibility during transition

### 3. Protocol Changes
```javascript
// OLD: Raw text command + text response
socket.emit('command', 'equip iron sword')
// Server responds: "You equip Iron Sword in your main hand slot."

// NEW: Structured command + structured data response
socket.emit('command', {
  action: 'equip',
  itemId: 'iron_sword'
})

// Server responds with structured data:
{
  success: true,
  action: 'equip',
  data: {
    itemId: 'iron_sword',
    slot: 'main_hand',
    previousItem: null, // or itemId if something was replaced
    playerStats: { /* updated stats */ }
  }
}

// Error responses:
{
  success: false,
  action: 'equip', 
  errorCode: 'ITEM_NOT_FOUND',
  errorData: { itemId: 'iron_sword' }
}
```

## Protocol Design Principles

### Data-Driven Responses
- **Server**: Never sends human-readable text messages
- **Server**: Sends structured data + error codes
- **Client**: Handles presentation layer (text formatting, graphics, translation)

### Example: Room Movement
```javascript
// Client sends:
{ action: 'move', direction: 'north' }

// Success response:
{
  success: true,
  action: 'move',
  data: {
    newRoom: {
      id: 'town_square',
      name: 'Town Square', 
      description: 'A bustling...',
      exits: ['north', 'south', 'east', 'west'],
      items: [{ id: 'town_notice', quantity: 1 }],
      npcs: [{ id: 'town_guard', health: 100 }],
      players: ['PlayerName']
    },
    playerPosition: { area: 'town_area', room: 'town_square' }
  }
}

// Error response:
{
  success: false,
  action: 'move',
  errorCode: 'NO_EXIT',
  errorData: { direction: 'north', currentRoom: 'inn' }
}
```

### Client Presentation Layer
```javascript
// Text Client:
const errorMessages = {
  'NO_EXIT': 'There is no exit to the {direction}.',
  'ITEM_NOT_FOUND': 'You don\'t have {itemId} in your inventory.',
  'INSUFFICIENT_GOLD': 'You need {required} gold but only have {current}.'
}

// Graphical Client:
- Shows room visually with 3D/2D graphics
- Displays items as clickable objects
- Shows NPCs as character models
- Same error codes trigger UI popups/notifications
```

### Internationalization Support
```javascript
// English (en.json)
{
  "NO_EXIT": "There is no exit to the {direction}.",
  "EQUIP_SUCCESS": "You equip {itemName} in your {slot}.",
  "rooms": {
    "town_square": "Town Square"
  }
}

// German (de.json) 
{
  "NO_EXIT": "Es gibt keinen Ausgang nach {direction}.",
  "EQUIP_SUCCESS": "Du rüstest {itemName} in deinem {slot} aus.",
  "rooms": {
    "town_square": "Stadtplatz"
  }
}
```

## Development Approach

### Option B: Gradual Migration (Recommended)
- Support both old and new protocols simultaneously
- Migrate one command at a time  
- Lower risk, allows testing each command
- **Dual Response**: Server sends both text (legacy) and data (new) during transition

### Transition Strategy
```javascript
// During migration, server sends both formats:
{
  // Legacy text response (for old clients)
  text: "You equip Iron Sword in your main hand slot.",
  
  // New structured response (for new clients)
  success: true,
  action: 'equip',
  data: { itemId: 'iron_sword', slot: 'main_hand' }
}
```

## First Command Target: `look <item>`

**Why start here:**
- ✅ Read-only operation (no state changes)
- ✅ Simple item lookup
- ✅ Easy to test and validate
- ✅ Good proof-of-concept for the pattern

**Required Changes:**
1. Client gets template data (items, rooms, NPCs) on login
2. Client implements fuzzy matching for inventory items  
3. Client sends `{action: 'look', target: 'inventory', itemId: 'item_id'}`
4. Server validates itemId exists in player inventory
5. Server responds with structured item data (not text description)

**New Response Format:**
```javascript
// Success:
{
  success: true,
  action: 'look', 
  target: 'inventory',
  data: {
    item: {
      id: 'healing_potion',
      name: 'Healing Potion',
      description: 'A small vial...',
      type: 'consumable',
      value: 25,
      quantity: 3,
      effects: { health: 25 }
    }
  }
}

// Error:
{
  success: false,
  action: 'look',
  target: 'inventory', 
  errorCode: 'ITEM_NOT_IN_INVENTORY',
  errorData: { itemId: 'healing_potion' }
}
```

**Client Processing:**
- **Text Client**: Formats item data into descriptive text
- **Graphical Client**: Shows item tooltip/popup with stats
- **Both**: Use error codes for consistent error handling

**Success Criteria:**
- `look potion` works same as before (text client)
- Server only receives/processes item IDs  
- Server responds with structured data (no hardcoded text)
- Response supports both text and future graphical clients
- Client handles all fuzzy matching and presentation
- Foundation established for internationalization

## Error Code Standards

### Standard Error Codes
```javascript
// Item/Inventory Errors
'ITEM_NOT_FOUND'           // Item doesn't exist in game
'ITEM_NOT_IN_INVENTORY'    // Player doesn't have the item
'INVENTORY_FULL'           // Can't add item, inventory full
'INSUFFICIENT_QUANTITY'    // Player has item but not enough

// Movement Errors  
'NO_EXIT'                  // No exit in that direction
'EXIT_BLOCKED'             // Exit exists but blocked
'INSUFFICIENT_LEVEL'       // Player level too low

// Equipment Errors
'NOT_EQUIPPABLE'           // Item can't be equipped
'WRONG_SLOT'               // Item doesn't fit that slot
'ALREADY_EQUIPPED'         // Slot already occupied

// Combat Errors
'TARGET_NOT_FOUND'         // No valid target
'ALREADY_IN_COMBAT'        // Player already fighting
'TARGET_DEAD'              // Target has 0 health

// Social Errors
'PLAYER_NOT_FOUND'         // Player doesn't exist
'PLAYER_OFFLINE'           // Player not currently online
'BLOCKED_PLAYER'           // Player has blocked sender
```

### Error Data Standards
```javascript
// Always include relevant context data:
{
  errorCode: 'INSUFFICIENT_GOLD',
  errorData: {
    required: 100,
    current: 25,
    itemId: 'iron_sword'
  }
}
```

## Response Data Standards

### Success Response Structure
```javascript
{
  success: true,
  action: 'command_name',
  data: {
    // Command-specific data
    // Always include what changed
    // Include new state information  
  },
  timestamp: 1633024800000 // For client synchronization
}
```

### Common Data Types
```javascript
// Player State Updates
playerState: {
  health: { current: 80, max: 100 },
  gold: 150,
  experience: { current: 450, needed: 700 },
  position: { area: 'town_area', room: 'town_square' }
}

// Item Data
item: {
  id: 'iron_sword',
  name: 'Iron Sword', 
  description: 'A well-crafted...',
  type: 'weapon',
  slot: 'main_hand',
  value: 50,
  effects: { damage: 12 }
}

// Room Data
room: {
  id: 'town_square',
  name: 'Town Square',
  description: 'A bustling marketplace...',
  exits: [
    { direction: 'north', roomId: 'inn', blocked: false },
    { direction: 'south', roomId: 'weapon_shop', blocked: true, reason: 'INSUFFICIENT_LEVEL' }
  ],
  items: [{ id: 'town_notice', quantity: 1 }],
  npcs: [{ id: 'town_guard', health: { current: 100, max: 100 } }],
  players: ['PlayerName1', 'PlayerName2']
}
```

## Next Steps
1. Implement `look <item>` refactor with new protocol
2. Create client-side template data loading and fuzzy matching
3. Test both success and error scenarios
4. Establish response formatting patterns
5. Use lessons learned to refine the protocol
6. Move to next command in the list

This approach establishes a solid foundation for both current text clients and future graphical clients, with full internationalization support.