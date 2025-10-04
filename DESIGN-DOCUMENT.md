# MiniMUD - Traditional MUD Design Document

## 🎯 Core Philosophy

> **"Traditional 1990s MUD simplicity with modern TypeScript tooling"**

Build a clean, minimal MUD that captures the essence of classic Diku/ROM/CircleMUD - nothing more, nothing less. Every feature must justify its existence. Target: **~2,000 lines of code**.

---

## 📐 Design Principles

### What This MUD Is:
- **Traditional** - Feels like a 1990s text MUD
- **Simple** - No modern MMO bloat
- **Social** - Players interact naturally
- **Data-Driven** - Content in JSON files
- **Clean Code** - TypeScript, modular, readable

### What This MUD Is NOT:
- ❌ Not a modern MMO
- ❌ Not feature-complete with WoW
- ❌ Not a GUI/graphics engine
- ❌ Not complex for complexity's sake

---

## 🔑 Client/Server Responsibility Pattern

### **CRITICAL RULE: Server Operates on IDs ONLY**

**Philosophy:**
- **Server**: Works exclusively with IDs (material_id, npc_id, enemy_id, etc.)
- **Client**: Handles all name-to-ID matching and fuzzy search
- **Why**: Keeps server logic simple, fast, and deterministic

### **Name-to-ID Matching (Client-Side)**

**Examples:**

**1. Harvest Command:**
```
Player types: "harvest iron ore"
Client:       Matches "iron ore" → "iron_ore" (from location.resources)
Client sends: { command: "harvest", materialId: "iron_ore" }
Server:       Validates "iron_ore" exists in location.resources[]
```

**2. Talk Command:**
```
Player types: "talk horatio"
Client:       Fuzzy matches "horatio" → "master_horatio" (from NPCs in location)
Client sends: { command: "talk", npcId: "master_horatio" }
Server:       Validates NPC ID exists in location
```

**3. Attack Command:**
```
Player types: "attack goblin"
Client:       Matches "goblin" → "goblin_warrior" (from enemies in location)
Client sends: { command: "attack", enemyId: "goblin_warrior" }
Server:       Validates enemy exists and starts combat
```

**4. Drop/Take Commands:**
```
Player types: "take sword"
Client:       Matches "sword" → "iron_sword" (from items in location)
Client sends: { command: "take", itemId: "iron_sword" }
Server:       Validates item exists on ground
```

### **Client Matching Algorithm (~30 lines)**

```typescript
function matchNameToId(input: string, entities: Array<{id: string, name: string}>): string | null {
  const normalized = input.toLowerCase().trim();
  
  // 1. Exact match (case-insensitive)
  let match = entities.find(e => e.name.toLowerCase() === normalized);
  if (match) return match.id;
  
  // 2. Partial match (starts with)
  match = entities.find(e => e.name.toLowerCase().startsWith(normalized));
  if (match) return match.id;
  
  // 3. Contains match
  match = entities.find(e => e.name.toLowerCase().includes(normalized));
  if (match) return match.id;
  
  // 4. ID match (if player types ID directly)
  match = entities.find(e => e.id === normalized);
  if (match) return match.id;
  
  return null;  // No match found
}
```

### **Server Validation (Always ID-Based)**

```typescript
// Server receives ID, validates it exists
export function harvest(player: Player, materialId: string): void {
  const location = gameState.locations.get(player.location);
  
  // Find by ID only - no name matching!
  const resource = location.resources.find(r => r.materialId === materialId);
  
  if (!resource) {
    return send(player, "That material isn't available here.", 'error');
  }
  
  // ... harvest logic
}
```

### **Why This Matters:**

1. **Performance**: Server doesn't do fuzzy matching
2. **Simplicity**: Server code is deterministic (ID lookups only)
3. **Flexibility**: Client can implement smart matching without server changes
4. **Localization**: Client can translate names without server code changes
5. **Security**: Server validates IDs against actual data (no injection attacks)

### **Client Responsibilities:**
- Parse player input
- Fuzzy/partial name matching
- Build command with IDs
- Handle ambiguity ("Which goblin? 1 or 2?")
- Display friendly names to player

### **Server Responsibilities:**
- Validate IDs exist
- Execute game logic
- Maintain game state
- Send updates to clients

### **Server Architecture: Stand-Alone Socket.IO Server**

**CRITICAL: The server is a pure Socket.IO server - NO web server functionality!**

- ❌ **NO Express.js** - Don't serve web pages
- ❌ **NO static file serving** - Client files are separate
- ❌ **NO HTTP routes** - Only WebSocket connections
- ✅ **Socket.IO ONLY** - Pure real-time game server
- ✅ **Separation of concerns** - Client is served independently (e.g., via `python -m http.server` or any web server)

**Why this matters:**
1. **Simplicity**: Server focuses solely on game logic
2. **Deployment flexibility**: Client and server can be hosted separately
3. **Scalability**: Pure Socket.IO server is lightweight and fast
4. **Development**: Client can be developed/served independently
5. **Production**: Client can be served from CDN, server runs standalone

**Server Setup (Correct Pattern):**
```typescript
// server.ts - Pure Socket.IO server
import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();  // Empty HTTP server (no Express!)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Only Socket.IO event handlers - no HTTP routes!
io.on('connection', (socket) => {
  // Game logic here
});

httpServer.listen(3000);
```

**Client Development:**
- Serve `client/` folder separately: `python -m http.server 8000`
- Or use VS Code Live Server extension
- Or any static file server

**Production:**
- Server: Deploy Socket.IO server to Node.js hosting
- Client: Deploy static files to CDN/static hosting (Netlify, Vercel, S3, etc.)

---

## 🗺️ World Design

### **6-Direction Movement (Traditional)**

**Allowed Directions:**
- `north`, `south`, `east`, `west`
- `up`, `down`

**That's it.** No diagonals (northeast, etc.) - keeps mental mapping simple.

**Location Structure:**
```json
{
  "id": "town_square",
  "name": "Town Square",
  "description": "A bustling marketplace.",
  "exits": {
    "north": "temple",
    "south": "gates", 
    "east": "shops",
    "west": "tavern"
  }
}
```

### **Movement Commands:**
```
north (or n)     → Move north
south (or s)     → Move south
east (or e)      → Move east
west (or w)      → Move west
up (or u)        → Move up
down (or d)      → Move down
flee (or fl)     → Escape combat (random exit, 50% success, combat only)
```

**Move Code (~40 lines):**
```typescript
export function move(player: Player, direction: string): void {
  const location = gameState.locations.get(player.location);
  const exit = location.exits[direction];
  
  if (!exit) {
    return send(player, "You can't go that way.", 'error');
  }
  
  const oldLocation = player.location;
  player.location = exit;
  
  send(player, `You go ${direction}.`, 'info');
  broadcast(oldLocation, `${player.name} leaves ${direction}.`, 'system', player.id);
  broadcast(exit, `${player.name} arrives.`, 'system', player.id);
  
  // Auto-look at new location
  look(player);
}
```

**Flee Code (Combat Only, ~40 lines):**
```typescript
export function flee(player: Player): void {
  const location = gameState.locations.get(player.location);
  
  // Check if player is in combat
  if (!isInCombat(player)) {
    return send(player, "You're not fighting anything!", 'error');
  }
  
  // Find the enemy player is fighting
  let fightingEnemy: Enemy | null = null;
  for (const enemy of location.enemies) {
    if (enemy.fighters.includes(player.username)) {
      fightingEnemy = enemy;
      break;
    }
  }
  
  // Success chance from config (default 0.5 = 50%)
  const fleeChance = config.gameplay.fleeSuccessChance;
  if (Math.random() > fleeChance) {
    send(player, "You failed to flee!", 'error');
    
    // Enemy gets a free attack on failed flee attempt
    if (fightingEnemy) {
      enemyAttack(player, fightingEnemy);
    }
    
    return;
  }
  
  // Remove from all enemy fighter lists
  for (const enemy of location.enemies) {
    const index = enemy.fighters.indexOf(player.name);
    if (index > -1) {
      enemy.fighters.splice(index, 1);
    }
  }
  
  // Pick random exit
  const exits = Object.keys(location.exits);
  if (exits.length === 0) {
    return send(player, "There's nowhere to flee to!", 'error');
  }
  
  const randomExit = exits[Math.floor(Math.random() * exits.length)];
  const destination = location.exits[randomExit];
  
  // Flee!
  const oldLocation = player.location;
  player.location = destination;
  
  send(player, `You flee ${randomExit}!`, 'success');
  broadcast(oldLocation, `${player.name} flees ${randomExit}!`, 'system', player.id);
  broadcast(destination, `${player.name} arrives in a hurry!`, 'system', player.id);
  
  // Auto-look at new location
  look(player);
}
```

**Flee Mechanics:**
- ✅ Combat only (can't flee if not fighting)
- ✅ **Configurable success chance** (set in `config.gameplay.fleeSuccessChance`, default 0.5 = 50%)
- ✅ **Enemy attacks on failed flee** - Prevents spam-fleeing until success
- ✅ Random exit direction (can't choose)
- ✅ Removes player from enemy fighters list
- ✅ Fails if no exits available
- ✅ Shows where you fled to others

**Configuration:**
```json
// config.json
{
  "gameplay": {
    "fleeSuccessChance": 0.5  // 0.5 = 50%, 0.75 = 75%, 1.0 = always succeeds
  }
}
```

---

## ⚔️ Combat System

### **Shared Enemy Combat (Classic Diku Pattern)**

**Core Concept:**
- Enemies live in locations (not global)
- Multiple players can attack same enemy
- Rewards split among all fighters
- Auto-respawn after death

**Enemy Structure:**
```typescript
{
  id: "goblin",
  name: "Goblin Scout", 
  health: 50,
  maxHealth: 50,
  damage: 8,
  defense: 3,
  gold: 25,
  xp: 30,
  materialDrops?: {              // Optional material drops
    [materialId: string]: {      // Material ID from materials/ folder
      chance: number;            // 0.0-1.0 drop probability
      amount: string;            // "min-max" range (e.g., "1-2")
    }
  },
  fighters: []  // Usernames of players fighting this enemy
}
```

**Example Enemies with Material Drops:**
```json
// data/enemies/wolf.json
{
  "id": "wolf",
  "name": "Gray Wolf",
  "health": 40,
  "maxHealth": 40,
  "damage": 10,
  "defense": 2,
  "gold": 15,
  "xp": 25,
  "materialDrops": {
    "wolf_pelt": {        // References data/materials/wolf_pelt.json
      "chance": 0.6,      // 60% chance to drop
      "amount": "1-2"     // Drops 1-2 pelts
    }
  }
}

// data/enemies/spider.json
{
  "id": "spider",
  "name": "Giant Spider",
  "health": 30,
  "maxHealth": 30,
  "damage": 12,
  "defense": 1,
  "gold": 10,
  "xp": 20,
  "materialDrops": {
    "spider_web": {
      "chance": 0.8,      // 80% chance
      "amount": "1-1"     // Always just 1
    },
    "spider_venom": {
      "chance": 0.3,      // 30% chance (rarer)
      "amount": "1-1"
    }
  }
}

// data/enemies/dragon.json
{
  "id": "dragon",
  "name": "Red Dragon",
  "health": 500,
  "maxHealth": 500,
  "damage": 50,
  "defense": 20,
  "gold": 1000,
  "xp": 500,
  "materialDrops": {
    "dragon_scale": {
      "chance": 0.9,      // 90% chance
      "amount": "2-5"     // 2-5 scales
    },
    "dragon_heart": {
      "chance": 0.1,      // 10% chance (very rare!)
      "amount": "1-1"     // Only 1
    }
  }
}
```

**Combat Flow:**
```typescript
// Player attacks
attack goblin
> You hit Goblin Scout for 12 damage.
> Goblin Scout hits you for 6 damage.

// Enemy dies
> Goblin Scout dies!
> You gained 12g and 15xp! (split among fighters)

// Respawns after 60 seconds
```

**Simple Messages - Just Facts:**
- "You hit X for N damage"
- "X hits you for N damage"  
- "X dies!"
- "You gained Ng and Nxp"

**NO verbose health descriptions** ("barely wounded", etc.)

**Code (~200 lines total):**
```typescript
// Apply damage variance to make combat less predictable
function applyDamageVariance(baseDamage: number): number {
  const variance = config.gameplay.damageVariance;  // Default 0.1 = 10%
  const minDamage = Math.floor(baseDamage * (1 - variance));
  const maxDamage = Math.ceil(baseDamage * (1 + variance));
  const randomDamage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
  return Math.max(1, randomDamage);
}

// Server receives enemy/player ID from client (already mapped from name)
export function attack(player: Player, targetId: string): void {
  const enemy = findEnemy(location, target);
  
  // Add to fighters list
  if (!enemy.fighters.includes(player.name)) {
    enemy.fighters.push(player.name);
  }
  
  // Calculate damage (with equipment bonuses)
  const playerDamage = player.damage 
    + (player.equipped.weapon?.damage || 0)
    + (player.equipped.accessory?.damage || 0);
  const baseDamage = Math.max(1, playerDamage - enemy.defense);
  const damage = applyDamageVariance(baseDamage);  // Apply variance!
  enemy.health -= damage;
  
  send(player, `You hit ${enemy.name} for ${damage} damage.`, 'combat');
  broadcast(location, `${player.name} attacks ${enemy.name}.`, 'combat');
  
  // Enemy dies?
  if (enemy.health <= 0) {
    const goldEach = Math.floor(enemy.gold / enemy.fighters.length);
    const xpEach = Math.floor(enemy.xp / enemy.fighters.length);
    
    enemy.fighters.forEach(name => {
      const fighter = getPlayer(name);
      fighter.gold += goldEach;
      fighter.xp += xpEach;
      send(fighter, `You gained ${goldEach}g and ${xpEach}xp!`, 'loot');
      
      // Material drops (each fighter rolls independently)
      if (enemy.materialDrops) {
        for (const [materialId, drop] of Object.entries(enemy.materialDrops)) {
          if (Math.random() <= drop.chance) {
            const amount = randomInt(drop.amount);  // "1-2" -> 1 or 2
            const material = gameState.materials.get(materialId);
            fighter.materials[materialId] = (fighter.materials[materialId] || 0) + amount;
            send(fighter, `You obtain ${amount}x ${material.name}!`, 'loot');
          }
        }
      }
      
      checkLevel(fighter);  // Check for level up
    });
    
    broadcast(location, `${enemy.name} dies!`, 'combat');
    removeEnemy(location, enemy);
    
    // Respawn after delay (configurable)
    setTimeout(() => spawnEnemy(location, enemy.id), config.gameplay.enemyRespawnTime);
    return;
  }
  
  // Enemy attacks back
  const playerDefense = player.defense
    + (player.equipped.armor?.defense || 0)
    + (player.equipped.shield?.defense || 0)
    + (player.equipped.accessory?.defense || 0);
  const baseEnemyDamage = Math.max(1, enemy.damage - playerDefense);
  const enemyDamage = applyDamageVariance(baseEnemyDamage);  // Apply variance!
  player.health -= enemyDamage;
  send(player, `${enemy.name} hits you for ${enemyDamage} damage.`, 'combat');
  
  // Player dies?
  if (player.health <= 0) {
    handleDeath(player);
  }
}
```

---

## 📦 Items & Equipment

### **4-Stat Simplicity**

**Item Stats:**
- `damage` - Weapons (attack power)
- `defense` - Armor/shields (damage reduction)
- `health` - Equipment bonus or potion healing
- `mana` - Equipment bonus or potion restore

**Item Types:**
```typescript
interface Item {
  id: string;
  name: string;
  description: string;
  type: 'equipment' | 'consumable' | 'recipe' | 'quest';
  slot?: 'weapon' | 'armor' | 'shield' | 'accessory';  // For equipment items
  value: number;  // Gold value
  damage?: number;
  defense?: number;
  health?: number;     // +HP bonus or healing amount
  mana?: number;       // +Mana bonus or restore amount
  manaCost?: number;   // For consumable scrolls
  usableIn?: 'any' | 'combat' | 'peaceful';  // Consumable usage restrictions
  destination?: string;  // For teleport scrolls
  teachesRecipe?: string; // For recipe items
}
```

**Examples:**
```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "description": "A well-crafted iron blade.",
  "type": "equipment",
  "slot": "weapon",
  "value": 50,
  "damage": 12
}

{
  "id": "wizard_robe",
  "name": "Wizard Robe",
  "description": "A mystical robe woven with arcane threads.",
  "type": "equipment",
  "slot": "armor",
  "value": 80,
  "defense": 5,
  "mana": 20  // +20 max mana bonus
}

{
  "id": "health_potion",
  "name": "Health Potion",
  "description": "A small red vial that restores 50 health.",
  "type": "consumable",
  "value": 20,
  "health": 50,
  "usableIn": "any"
}

{
  "id": "mana_potion",
  "name": "Mana Potion",
  "description": "A small blue vial that restores 30 mana.",
  "type": "consumable", 
  "value": 25,
  "mana": 30,
  "usableIn": "any"
}

{
  "id": "fireball_scroll",
  "name": "Fireball Scroll",
  "description": "A magical scroll that unleashes a devastating fireball.",
  "type": "consumable",
  "value": 40,
  "damage": 30,
  "manaCost": 15,
  "usableIn": "combat"
}

{
  "id": "jade_amulet",
  "name": "Jade Amulet",
  "description": "A mystical jade amulet radiating power.",
  "type": "equipment",
  "slot": "accessory",
  "value": 120,
  "health": 15,
  "mana": 10  // Accessory can have any stat!
}

{
  "id": "recipe_iron_sword",
  "name": "Iron Sword Recipe",
  "description": "Instructions for crafting an iron sword.",
  "type": "recipe",
  "value": 50,
  "teachesRecipe": "iron_sword"
}
```

**Equipment Slots:**
- `weapon` - One weapon
- `armor` - One armor
- `shield` - One shield
- `accessory` - One accessory (can have any stat!)

**Commands:**
```
inventory (inv, i)      → View inventory
equipment (eq)          → View equipped items
examine <item>          → View detailed item info (exam, ex, look at)
equip iron sword        → Equip weapon
unequip weapon          → Remove weapon
use health potion       → Consume potion (restore HP)
use mana potion         → Consume potion (restore mana)
use fireball scroll     → Cast scroll (costs mana, deals damage)
drop iron sword         → Drop item on ground
get iron sword          → Pick up from ground
```

### **Consumable Usage Rules (Situation-Based)**

**3 Consumable Categories:**

1. **Potions** - Anytime (combat or peaceful)
   - Health potions
   - Mana potions
   
2. **Attack Scrolls** - Combat only
   - Fireball, Lightning Bolt, etc.
   - Requires active enemy target
   
3. **Utility Scrolls** - Outside combat only
   - Teleport scrolls
   - Buff scrolls (if added later)

**Item Data Examples:**
```json
{
  "id": "health_potion",
  "type": "consumable",
  "usableIn": "any",
  "health": 50
}

{
  "id": "fireball_scroll",
  "type": "consumable",
  "usableIn": "combat",
  "damage": 30,
  "manaCost": 15
}

{
  "id": "teleport_scroll",
  "type": "consumable",
  "usableIn": "peaceful",
  "destination": "town_square",
  "manaCost": 20
}
```

**Consumable System (with situation checks):**
```typescript
export function useConsumable(player: Player, item: Item): void {
  const inCombat = isInCombat(player);  // Check if player is fighting
  
  // Validate usage situation
  if (item.usableIn === 'combat' && !inCombat) {
    return send(player, "You can only use this in combat!", 'error');
  }
  
  if (item.usableIn === 'peaceful' && inCombat) {
    return send(player, "You can't use this while fighting!", 'error');
  }
  
  // Health potions (anytime)
  if (item.health) {
    const healed = Math.min(item.health, player.maxHealth - player.health);
    player.health += healed;
    send(player, `You drink ${item.name}. Healed ${healed} HP!`, 'success');
    removeItem(player.inventory, item);
    return;
  }
  
  // Mana potions (anytime)
  if (item.mana && !item.manaCost && !item.damage) {
    const restored = Math.min(item.mana, player.maxMana - player.mana);
    player.mana += restored;
    send(player, `You drink ${item.name}. Restored ${restored} mana!`, 'success');
    removeItem(player.inventory, item);
    return;
  }
  
  // Attack scrolls (combat only - already validated above)
  if (item.damage && item.manaCost) {
    if (player.mana < item.manaCost) {
      return send(player, "Not enough mana!", 'error');
    }
    
    const enemy = findCurrentEnemy(player);
    if (!enemy) {
      return send(player, "You're not fighting anything.", 'error');
    }
    
    player.mana -= item.manaCost;
    enemy.health -= item.damage;
    
    send(player, `You use ${item.name}! ${enemy.name} takes ${item.damage} damage! (-${item.manaCost} mana)`, 'combat');
    broadcast(player.location, `${player.name} uses ${item.name}!`, 'combat');
    
    removeItem(player.inventory, item);
    
    // Check if enemy died
    if (enemy.health <= 0) {
      handleEnemyDeath(player, enemy);
    }
    return;
  }
  
  // Teleport scrolls (peaceful only - already validated above)
  if (item.destination && item.manaCost) {
    if (player.mana < item.manaCost) {
      return send(player, "Not enough mana!", 'error');
    }
    
    const oldLocation = player.location;
    player.mana -= item.manaCost;
    player.location = item.destination;
    
    send(player, `You use ${item.name} and are teleported! (-${item.manaCost} mana)`, 'success');
    broadcast(oldLocation, `${player.name} vanishes in a flash of light!`, 'system', player.id);
    broadcast(item.destination, `${player.name} appears in a flash of light!`, 'system', player.id);
    
    removeItem(player.inventory, item);
    look(player);  // Auto-look at new location
    return;
  }
  
  send(player, "You can't use that.", 'error');
}

// Helper function to check combat status
function isInCombat(player: Player): boolean {
  const location = gameState.locations.get(player.location);
  
  // Check if player is in any enemy's fighters list
  for (const enemy of location.enemies) {
    if (enemy.fighters.includes(player.name)) {
      return true;
    }
  }
  
  return false;
}
```

**Why This Design:**
- ✅ Clear usage restrictions (usableIn field)
- ✅ Prevents teleport exploit during combat
- ✅ Attack scrolls require combat target
- ✅ Potions work anytime (healing is always useful)
- ✅ Simple boolean check: `isInCombat()`
- ✅ Informative error messages
- ✅ ~80 lines total (including helper)

**Usage Patterns:**
```typescript
// In combat
> use fireball scroll
You use Fireball Scroll! Goblin takes 30 damage!
(-15 mana)

> use teleport scroll  
You can't use this while fighting!

// Outside combat
> use teleport scroll
You use Teleport Scroll and are teleported!
(-20 mana)

> use fireball scroll
You can only use this in combat!

// Anytime
> use health potion
You drink Health Potion. Healed 50 HP!
```

### **Equipment System**

**4 Slots:**
- Weapon (damage bonus)
- Armor (defense bonus)
- Shield (defense bonus)
- accessory (any stat: health/mana/damage/defense)

**How it works:**
```typescript
const totalDamage = player.damage 
  + (player.equipped.weapon?.damage || 0)
  + (player.equipped.accessory?.damage || 0);
  
**Total Stat Calculation:**
```typescript
// Damage and Defense: Sum from ALL equipment slots
const totalDamage = player.damage 
  + (player.equipped.weapon?.damage || 0)
  + (player.equipped.armor?.damage || 0)
  + (player.equipped.shield?.damage || 0)
  + (player.equipped.accessory?.damage || 0);
  
const totalDefense = player.defense 
  + (player.equipped.weapon?.defense || 0)
  + (player.equipped.armor?.defense || 0) 
  + (player.equipped.shield?.defense || 0)
  + (player.equipped.accessory?.defense || 0);
  
// Health and Mana: Sum from ALL equipment slots
const maxHealth = player.maxHealth 
  + (player.equipped.weapon?.health || 0)
  + (player.equipped.armor?.health || 0)
  + (player.equipped.shield?.health || 0)
  + (player.equipped.accessory?.health || 0);
  
const maxMana = player.maxMana 
  + (player.equipped.weapon?.mana || 0)
  + (player.equipped.armor?.mana || 0)
  + (player.equipped.shield?.shield || 0)
  + (player.equipped.accessory?.mana || 0);
```

**Equipment Bonus Mechanics:**

1. **Any Equipment Can Have Any Stat:**
   - ALL equipment types (weapon, armor, shield, accessory) can provide ANY of the 4 stats
   - Designers can create unique items like "Vampire Sword" (+damage, +health) or "Mage Plate" (+defense, +mana)
   - Health/mana bonuses increase your **maximum** health/mana
   - All bonuses from ALL equipped items are summed together
   - When equipping: Current health/mana is capped to new total max (won't overheal)
   - When unequipping: Current health/mana is capped to remaining total max (excess removed)

2. **Stats Display:**
   ```
   > stats
   
   === Character Stats ===
   Name:     Player1
   Level:    5
   
   Health:   120/150 (130 + 20)    ← Shows base + total equipment bonus
   Mana:     80/110 (100 + 10)     ← Shows base + total equipment bonus
   Damage:   15 (5 + 10)           ← Shows base + total equipment bonus
   Defense:  18 (3 + 15)           ← Shows base + total equipment bonus
   ```
   
   If no equipment bonuses for a stat, just shows base value:
   ```
   Health:   100/100
   Damage:   5
   ```

3. **Potion Healing:**
   - Health potions heal up to calculated max (base + sum of all equipment health bonuses)
   - Mana potions restore up to calculated max (base + sum of all equipment mana bonuses)

**Why flexible equipment stats are valuable:**
- Creates interesting itemization (unusual stat combinations)
- More build variety and loot excitement
- Designers can create thematic items (vampire weapons, mage armor, etc.)
- Traditional MUD flexibility
- All stats are equally valuable across all equipment slots

**Equip/Unequip Code (~50 lines):**
```typescript
export function equip(player: Player, itemName: string): void {
  const item = findItem(player.inventory, itemName);
  
  if (!item.type.match(/weapon|armor|shield|accessory/)) {
    return send(player, "You can't equip that!");
  }
  
  // Unequip current item in slot
  const currentItem = player.equipped[item.type];
  if (currentItem) {
    player.inventory.push(currentItem);
  }
  
  // Equip new item
  player.equipped[item.type] = item;
  removeFromInventory(player, item);
  
  send(player, `You equip ${item.name}.`);
}

export function unequip(player: Player, slot: string): void {
  const item = player.equipped[slot];
  
  if (!item) {
    return send(player, `You have nothing equipped in that slot.`);
  }
  
  if (player.inventory.length >= 16) {
    return send(player, "Your inventory is full!");
  }
  
  player.inventory.push(item);
  player.equipped[slot] = null;
  
  send(player, `You unequip ${item.name}.`);
}
```

**Strategic Depth:****
- Combat scrolls cost mana (prevents spam)
- Mana potions restore mana (resource management)
- Equipment can boost max mana (build choices)
- Still simple: 4 stats total

**NO cooldowns needed** - mana cost is the limiting factor!

### **Examining Items**

**Command:**
```
examine <item>         → View detailed item information
```

**Aliases:** `exam`, `ex`, `x`

**Works for:**
- Items in your inventory
- Items you have equipped
- Items on the ground in your current location

**Display Format:**
```
> examine iron sword

=== Iron Sword ===
Type: Weapon
Value: 50 gold

Stats:
  Damage: +12

"A well-crafted blade of iron, perfectly balanced for combat."

> examine jade amulet

=== Jade Amulet ===
Type: Accessory
Value: 150 gold

Stats:
  Health: +20
  Mana: +10

"A mystical jade amulet radiating power."

> examine health potion

=== Health Potion ===
Type: Consumable (Usable anytime)
Value: 25 gold

Effect:
  Restores 50 health

"A small red vial that restores 50 health."

> examine fireball scroll

=== Fireball Scroll ===
Type: Consumable (Combat only)
Value: 75 gold

Effect:
  Deals 25 damage
  Costs 15 mana

"A magical scroll that unleashes a devastating fireball."
```

**Code (~60 lines):**
```typescript
export function examine(player: Player, itemName: string): void {
  if (!itemName) {
    send(player, 'Examine what?', 'error');
    return;
  }
  
  // Search in inventory
  let item = findItemInInventory(player, itemName);
  
  // Search in equipped items
  if (!item) {
    const equipped = Object.values(player.equipped).find(i => 
      i && (i.name.toLowerCase().includes(itemName.toLowerCase()) || 
            i.id.toLowerCase().includes(itemName.toLowerCase()))
    );
    if (equipped) item = equipped;
  }
  
  // Search on ground
  if (!item) {
    const location = gameState.gameData.locations.get(player.location);
    if (location?.items) {
      item = location.items.find(i => 
        i.name.toLowerCase().includes(itemName.toLowerCase()) ||
        i.id.toLowerCase().includes(itemName.toLowerCase())
      );
    }
  }
  
  if (!item) {
    send(player, `You don't see "${itemName}" anywhere.`, 'error');
    return;
  }
  
  // Display item details
  let message = `\n=== ${item.name} ===\n`;
  
  // Type with usage info for consumables
  if (item.type === 'consumable' && item.usableIn) {
    const usageText = item.usableIn === 'any' ? 'Usable anytime' :
                      item.usableIn === 'combat' ? 'Combat only' :
                      'Peaceful only';
    message += `Type: Consumable (${usageText})\n`;
  } else {
    const typeText = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    message += `Type: ${typeText}\n`;
  }
  
  message += `Value: ${item.value} gold\n`;
  
  // Stats
  const stats = [];
  if (item.damage) stats.push(`  Damage: +${item.damage}`);
  if (item.defense) stats.push(`  Defense: +${item.defense}`);
  if (item.health && item.type !== 'consumable') stats.push(`  Health: +${item.health}`);
  if (item.mana && item.type !== 'consumable') stats.push(`  Mana: +${item.mana}`);
  
  if (stats.length > 0) {
    message += '\nStats:\n';
    stats.forEach(s => message += `${s}\n`);
  }
  
  // Consumable effects
  if (item.type === 'consumable') {
    const effects = [];
    if (item.health) effects.push(`  Restores ${item.health} health`);
    if (item.mana && !item.manaCost) effects.push(`  Restores ${item.mana} mana`);
    if (item.damage) effects.push(`  Deals ${item.damage} damage`);
    if (item.manaCost) effects.push(`  Costs ${item.manaCost} mana`);
    if (item.destination) effects.push(`  Teleports to ${item.destination}`);
    
    if (effects.length > 0) {
      message += '\nEffect:\n';
      effects.forEach(e => message += `${e}\n`);
    }
  }
  
  // Description
  if (item.description) {
    message += `\n"${item.description}"\n`;
  }
  
  send(player, message, 'info');
}
```

**Why This Design:**
- ✅ Works for inventory, equipped, and ground items
- ✅ Shows all relevant stats clearly
- ✅ Only shows "Stats:" or "Effect:" headers when there's content
- ✅ Consumables show usage restrictions
- ✅ Different format for equipment vs consumables
- ✅ Fuzzy name matching (same as other commands)
- ✅ Helps players make informed decisions (buy/equip/use)
- ✅ Traditional MUD feature (~60 lines)

---

## 🛒 Economy

### **Shop System (Traditional Buy/Sell)**

**Shop Structure:**
```json
{
  "id": "weapon_shop",
  "name": "Weapon Shop",
  "items": ["rusty_sword", "iron_sword", "steel_sword"]
}
```

**Location with Shop:**
```json
{
  "id": "town_square",
  "name": "Town Square",
  "description": "...",
  "exits": { "north": "temple" },
  "shop": "weapon_shop",
  "npcs": ["blacksmith"]
}
```

**Note:** Shops are location-based (one per location max), not tied to NPCs. NPCs are for dialogue/quests only.

**Commands:**
```
list                → Show shop inventory
buy iron sword      → Client maps "iron sword" → "iron_sword" → sends itemId to server
sell rusty sword    → Client maps "rusty sword" → "rusty_sword" → sends itemId to server
```

**Client-to-Server Flow:**
```
Player types:  "buy iron sword"
Client:        Matches "iron sword" in shop.items → finds "iron_sword"
Client sends:  { command: "buy", itemId: "iron_sword" }
Server:        Validates "iron_sword" in shop, checks price, executes purchase
```

**Note:** 
- Buy/sell multipliers are global config settings for easier game balance
- Server operates on IDs only - client handles all name matching

**Code (~150 lines):**
```typescript
// Server receives item ID from client (already mapped from name)
export function buy(player: Player, itemId: string): void {
  const shop = location.shop;
  const item = gameState.items.get(itemId);
  
  if (!shop.items.includes(itemId)) {
    return send(player, "This shop doesn't sell that.", 'error');
  }
  
  const price = Math.floor(item.value * config.economy.shopBuyMultiplier);
  
  if (player.gold < price) {
    return send(player, "You can't afford that.", 'error');
  }
  
  if (player.inventory.length >= config.gameplay.maxInventorySlots) {
    return send(player, "Your inventory is full!", 'error');
  }
  
  player.gold -= price;
  player.inventory.push(item);
  send(player, `You buy ${item.name} for ${price}g.`, 'success');
}

export function sell(player: Player, itemName: string): void {
  const item = findItem(player.inventory, itemName);
  const price = Math.floor(item.value * config.economy.shopSellMultiplier);
  
  player.gold += price;
  removeItem(player.inventory, item);
  send(player, `You sell ${item.name} for ${price}g.`, 'success');
}
```

**Money Sinks:**
- Shops (buy > sell prices)
- Portal travel (see below)
- Healers (optional paid healing)

---

## 🎯 Quest System

### **3 Quest Types (Keep It Simple)**

**1. Kill Quests:**
```json
{
  "id": "goblin_problem",
  "name": "Goblin Problem",
  "type": "kill",
  "target": "goblin",
  "count": 5,
  "dialogue": "Kill 5 goblins for me.",
  "completionDialogue": "Excellent work! The roads are safer now.",
  "reward": { "gold": 100, "xp": 75 }
}
```

**2. Collect Quests (Quest Items System):**
```json
{
  "id": "wolf_pelts",
  "name": "Wolf Pelts",
  "type": "collect",
  "target": "wolf",
  "count": 3,
  "itemDrop": "wolf_pelt",
  "dialogue": "Bring me 3 wolf pelts.",
  "completionDialogue": "Perfect pelts! You're a skilled hunter.",
  "reward": { "gold": 150, "xp": 100 }
}
```

**Quest Items (Separate from Regular Items):**
```typescript
interface Player {
  inventory: Item[];            // Regular items (equipment, consumables, recipes)
  questItems: { [id: string]: number };   // Quest-specific tracking
  materials: { [id: string]: number };    // Crafting materials
}

// When enemy dies with active quest
if (hasQuest(player, 'wolf_pelts')) {
  player.questItems['wolf_pelt']++;  // Quest tracking (temporary)
  if (player.questItems['wolf_pelt'] >= 3) {
    send(player, "Quest items collected! Return to tanner.");
  }
}

// Materials ALWAYS drop (independent of quests)
if (enemy.materialDrops?.wolf_pelt) {
  if (Math.random() <= enemy.materialDrops.wolf_pelt.chance) {
    player.materials['wolf_pelt']++;  // Permanent crafting material
    send(player, "You obtain Wolf Pelt!", 'loot');
  }
}
```

**Quest Items vs Materials (Can Be Same Thing!):**

**Example: Wolf Pelt**
- **As Quest Item** (`questItems['wolf_pelt']`):
  - Only tracked when quest is active
  - Auto-removed when quest completes
  - Can't be sold or used for crafting
  - Example: "Collect 3 wolf pelts for tanner" quest

- **As Material** (`materials['wolf_pelt']`):
  - ALWAYS drops from wolves (if configured)
  - Permanent storage (never removed)
  - Used for crafting recipes
  - Example: Craft "Leather Armor" needs 5 wolf pelts

**Both can happen simultaneously:**
```typescript
// Kill wolf while on quest
> You kill Gray Wolf!
> Quest progress: 2/3 wolf pelts  // questItems tracking
> You obtain Wolf Pelt!            // materials for crafting
```

**Why separate?**
- Quest items: Temporary quest tracking (auto-cleanup on complete)
- Materials: Permanent crafting storage (never auto-removed)
- Same ID can be used for both purposes
- Clean separation of concerns

**3. Visit Quests:**
```json
{
  "id": "find_hermit",
  "name": "Find the Hermit",
  "type": "visit",
  "target": "hermit",
  "count": 1,
  "dialogue": "Find the hermit deep in the forest!",
  "completionDialogue": "You found him! Thank you for checking on the hermit.",
  "reward": { "gold": 50, "xp": 50 }
}
```

### **Quest-NPC Data Relationship**

**Important: NPCs own the quest relationship, not quests!**

Quests don't have an `npc` field in JSON - it's populated by the data loader:

**NPC File (owns the relationship):**
```json
{
  "id": "town_guard",
  "name": "Town Guard",
  "dialogue": "Stay safe out there, citizen.",
  "quest": "goblin_problem"
}
```

**Data Loader Auto-Population:**
```typescript
// In enrichQuests() function:
// 1. For each quest, find which NPC has quest field matching quest.id
// 2. Populate quest.npc with that NPC's id
// 3. Validate: exactly 0 or 1 NPC per quest (error if multiple)

// Result: quest.npc is auto-populated at load time
const quest = gameData.quests.get('goblin_problem');
console.log(quest.npc);  // "town_guard" (populated by loader)
```

**Why this design?**
- ✅ **Single source of truth**: NPC.quest is the only place the relationship is defined
- ✅ **No redundancy**: Quest files don't need npc field
- ✅ **Auto-validated**: Loader errors if multiple NPCs reference same quest
- ✅ **Flexible**: Can create quests without NPCs (designer preview)

### **Quest Dialogue System**

**Three dialogue types:**

1. **Regular NPC dialogue**: Default conversation
2. **Quest dialogue**: Shown when accepting/reminder about active quest
3. **Completion dialogue**: Shown when turning in completed quest

**NPC with questDialogue (for visit quests):**
```json
{
  "id": "hermit",
  "name": "Forest Hermit",
  "dialogue": "Leave me be, traveler.",
  "questDialogue": "Ah, someone finally found me! Tell the tavern keeper I'm fine."
}
```

**Dialogue flow:**
```
1. Player has no quest → Shows NPC.dialogue
2. Player accepts quest → Shows Quest.dialogue
3. Player talks to visit target → Shows NPC.questDialogue
4. Player completes quest → Shows Quest.completionDialogue
```

### **Quest Chains (Simple Prerequisite Check)**

Use `requiresQuest` and `levelRequirement` fields for quest gating:

```json
{
  "id": "advanced_quest",
  "name": "Advanced Quest",
  "type": "kill",
  "target": "dragon",
  "count": 1,
  "dialogue": "Now that you've proven yourself, slay the dragon!",
  "completionDialogue": "You are truly a hero!",
  "reward": { "gold": 1000, "xp": 500 },
  "requiresQuest": "goblin_problem",
  "levelRequirement": 5
}
```

**Quest acceptance logic:**
```typescript
export function canAcceptQuest(player: Player, questId: string): boolean {
  const quest = gameState.gameData.quests.get(questId);
  if (!quest) return false;
  
  // Already active?
  if (player.activeQuests[questId]) return false;
  
  // Already completed?
  if (player.completed.includes(questId)) return false;
  
  // Check level requirement
  if (quest.levelRequirement && player.level < quest.levelRequirement) {
    return false;
  }
  
  // Check prerequisite
  if (quest.requiresQuest && !player.completed.includes(quest.requiresQuest)) {
    return false;
  }
  
  return true;
}
```

**Code (~256 lines total - src/quests.ts):**
```typescript
export function acceptQuest(player: Player, quest: Quest): void {
  player.activeQuests[quest.id] = { progress: 0 };
}

export function completeQuest(player: Player, quest: Quest): void {
  player.gold += quest.reward.gold;
  player.xp += quest.reward.xp;
  player.completed.push(quest.id);
  delete player.activeQuests[quest.id];
  
  send(player, `Quest complete! +${quest.reward.gold}g, +${quest.reward.xp}xp`, 'success');
  checkLevel(player);  // Check for level up
}

export function updateQuestProgress(player: Player, type: string, target: string): void {
  for (const [id, quest] of player.activeQuests) {
    if (quest.type === type && quest.target === target) {
      quest.progress++;
      if (quest.progress >= quest.count) {
        send(player, "Quest objective complete! Return to NPC.");
      }
    }
  }
}
```

---

## 👥 NPC System

### **Single Dialogue (Traditional)**

**NPC Structure:**
```json
{
  "id": "blacksmith",
  "name": "Gareth the Smith",
  "dialogue": "Welcome to my forge!",
  "quest": "goblin_problem"
}
```

**NO random dialogue arrays** - NPCs say same thing every time

**NPC Types:**
- Regular - Just dialogue
- Quest Giver - Offers quest
- Healer - Paid healing/mana recovery (money sink)
- Portal Master - Fast travel (money sink)

**Note:** Shops are location-based, not NPC-based. A location can have a shop AND NPCs.

**Talk Command:**
```
talk blacksmith
> Gareth the Smith: "Welcome to my forge!"
> [accepts/completes quest if applicable]
```

**Healer NPCs:**
```json
{
  "id": "priest",
  "name": "Father Marcus",
  "dialogue": "I can heal your wounds for a donation.",
  "healer": true
}
```

**Healing Cost Formula (from config):**
- `actualCost = (missingHealth + missingMana) * (config.economy.healerCostFactor / 100)`
- Example: Missing 80 HP with factor 50 → Cost = 80 * 0.5 = 40 gold
- Higher damage = Higher cost (prevents spam healing)
- Healer cost factor configured globally in `config.economy.healerCostFactor`

**Code (~60 lines):**
```typescript
export function talk(player: Player, npcName: string): void {
  const npc = findNPC(location, npcName);
  
  // Quest turn-in?
  if (npc.quest && canCompleteQuest(player, npc.quest)) {
    completeQuest(player, npc.quest);
    return;
  }
  
  // Quest offer?
  if (npc.quest && canAcceptQuest(player, npc.quest)) {
    acceptQuest(player, npc.quest);
    send(player, `${npc.name}: "${npc.quest.dialogue}"`, 'npc');
    return;
  }
  
  // Regular dialogue
  send(player, `${npc.name}: "${npc.dialogue}"`, 'npc');
  
  // Healer?
  if (npc.healer) {
    const missingHealth = player.maxHealth - player.health;
    const missingMana = player.maxMana - player.mana;
    
    if (missingHealth > 0 || missingMana > 0) {
      const costFactor = config.economy.healerCostFactor;
      const healthCost = Math.ceil(missingHealth * costFactor / 100);
      const manaCost = Math.ceil(missingMana * costFactor / 100);
      const totalCost = healthCost + manaCost;
      
      if (player.gold < totalCost) {
        return send(player, `${npc.name}: "You need ${totalCost} gold for full healing."`, 'npc');
      }
      
      player.gold -= totalCost;
      player.health = player.maxHealth;
      player.mana = player.maxMana;
      send(player, `You are healed for ${totalCost} gold!`, 'success');
      broadcast(player.location, `${npc.name} heals ${player.username}.`, 'system', player.id);
    }
  }
}
```

---

## 🔄 Trading & Item Transfer

### **Direct Give Command (Traditional)**

**NO trade windows!** Use social trust:

```
give bob iron sword     → Transfer item to Bob
give bob 50 gold        → Transfer gold to Bob
```

**Code (~160 lines):**
```typescript
export function give(player: Player, args: string[]): void {
  const targetName = args[0]; // First arg is always the player
  const target = findPlayerInLocation(player.location, targetName);
  
  // Check if it's gold: "give bob 50 gold"
  if (args.length >= 3 && args[args.length - 1].toLowerCase() === 'gold') {
    const amount = parseInt(args[1]);
    
    if (player.gold < amount) {
      return send(player, `You don't have ${amount} gold.`, 'error');
    }
    
    player.gold -= amount;
    target.gold += amount;
    send(player, `You give ${amount} gold to ${target.username}.`, 'success');
    send(target, `${player.username} gives you ${amount} gold.`, 'success');
    savePlayer(player);
    savePlayer(target);
    return;
  }
  
  // Otherwise it's an item: "give bob iron sword"
  const itemName = args.slice(1).join(' ');
  const item = findItemInInventory(player.inventory, itemName);
  
  if (target.inventory.length >= maxInventorySlots) {
    return send(player, `${target.username}'s inventory is full!`, 'error');
  }
  
  player.inventory.splice(player.inventory.indexOf(item), 1);
  target.inventory.push(item);
  
  send(player, `You give ${item.name} to ${target.username}.`, 'success');
  send(target, `${player.username} gives you ${item.name}.`, 'success');
  savePlayer(player);
  savePlayer(target);
}
```

**Benefits:**
- Simple, fast
- Social trust-based (like real MUDs)
- No complex state management
- 25 lines vs 610 lines of trade windows

---

## 🚀 Fast Travel

### **Portal Master NPCs (Money Sink)**

**Portal NPC:**
```json
{
  "id": "portal_master",
  "name": "Portal Master",
  "dialogue": "Say a city name to travel.",
  "portals": {
    "midgaard": { "destination": "midgaard_square", "cost": 100 },
    "newbie": { "destination": "town_square", "cost": 50 }
  }
}
```

**Usage:**
```
talk portal master
> Portal Master: "Say a city name to travel."

say midgaard
> Portal Master: "That will be 100 gold."
> You step through the portal...

=== City of Midgaard ===
```

**Code (~25 lines):**
```typescript
export function sayToNPC(player: Player, npc: NPC, message: string): void {
  const portal = npc.portals?.[message.toLowerCase()];
  
  if (!portal) {
    return send(player, `${npc.name}: "I don't know that place."`);
  }
  
  if (player.gold < portal.cost) {
    return send(player, `${npc.name}: "You need ${portal.cost} gold."`);
  }
  
  player.gold -= portal.cost;
  player.location = portal.destination;
  send(player, "You step through the portal...");
}
```

**Benefits:**
- Gold sink (removes money from economy)
- Designer-controlled destinations
- Simple implementation

---

## 🪨 Materials System

### **Material Definitions (Crafting Components)**

**Material Structure:**
```json
{
  "id": "iron_ore",
  "name": "Iron Ore",
  "description": "A chunk of raw iron ore.",
  "rarity": "common"
}
```

**Material Types:**
```typescript
interface Material {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';  // Cosmetic only!
}
```

**Rarity = Cosmetic Indicator Only:**
- ❌ **NO** rarity-based game mechanics
- ❌ **NO** rarity affecting drop rates
- ❌ **NO** rarity affecting crafting
- ✅ **ONLY** visual indicator for players ("this looks valuable")
- ✅ Helps players decide what to keep/use
- ✅ Can be displayed with color coding in client

**Example Materials:**
```json
// data/materials/iron_ore.json
{
  "id": "iron_ore",
  "name": "Iron Ore",
  "description": "A chunk of raw iron ore, useful for smithing.",
  "rarity": "common"
}

// data/materials/coal.json
{
  "id": "coal",
  "name": "Coal",
  "description": "Black coal used for smelting.",
  "rarity": "common"
}

// data/materials/mithril_ore.json
{
  "id": "mithril_ore",
  "name": "Mithril Ore",
  "description": "A rare, magical ore that glows faintly.",
  "rarity": "rare"
}
```

**Why Materials Are Separate:**
- ✅ Not regular items (can't be bought/sold in shops)
- ✅ Unlimited storage in `player.materials` (don't use inventory space)
- ✅ **Obtained from TWO sources:**
  - **Harvesting** resource nodes (iron ore from mines)
  - **Enemy drops** (wolf pelt from wolves, spider web from spiders)
- ✅ Used only for crafting
- ✅ Rarity is cosmetic only (visual indicator of value)

**Player Storage:**
```typescript
interface Player {
  materials: { [materialId: string]: number };  // { iron_ore: 5, coal: 2 }
}
```

**Commands:**
```
materials               → Show all harvested materials
examine iron ore        → Show material details (if you have any)
```

**How to Obtain Materials:**

1. **Harvesting Resource Nodes** (see section below)
   - Visit location with resource node
   - Use `harvest` command
   - Per-player cooldown timer
   - Example: Iron ore from mines

2. **Enemy Drops** (automatic on kill)
   - Kill enemies that drop materials
   - Chance-based drops (each fighter rolls independently)
   - Example: Wolf pelts from wolves, spider webs from spiders
   - Rare materials from boss enemies (dragon scales, etc.)

**Materials Display:**
```
> materials

Harvested Materials:
  - Iron Ore x5 (common)
  - Coal x2 (common)
  - Mithril Ore x1 (rare)
```

---

## ⛏️ Resource Harvesting (Crafting)

### **Per-Player Resource Nodes**

**Location with Resources:**
```json
{
  "id": "iron_mine",
  "name": "Iron Mine",
  "description": "A dark mine filled with iron deposits.",
  "exits": { "out": "mountain_path" },
  "resources": [
    {
      "materialId": "iron_ore",     // References data/materials/iron_ore.json
      "amount": "1-3",               // Random amount per harvest
      "cooldown": 3600000,            // 1 hour per player (in milliseconds)
      "chance": 0.8                   // 80% success rate
    }
  ]
}
```

**Resource Node Interface:**
```typescript
interface ResourceNode {
  materialId: string;    // ID of material from materials/ folder
  amount: string;        // "min-max" range (e.g., "1-3")
  cooldown: number;      // Milliseconds between harvests per player
  chance: number;        // 0.0-1.0 success probability
}
```

**Player Tracking:**
```typescript
interface Player {
  lastHarvest: { [key: string]: number };  // Key = "locationId_materialId"
}
```

**Why composite key?**
- Allows independent cooldowns for each material in same location
- Example: `{ "iron_mine_iron_ore": 1234567890, "iron_mine_coal": 1234560000 }`
- Can harvest coal while iron ore is on cooldown

**Harvest Command:**
```
harvest <material_id>        → Client maps "iron ore" to "iron_ore" before sending
harvest                      → Harvest first available resource (if only one)
```

**Client-to-Server Flow:**
```
Player types:  "harvest iron ore"
Client maps:   "iron ore" → "iron_ore" (from location.resources)
Client sends:  { command: "harvest", materialId: "iron_ore" }
Server:        Validates "iron_ore" exists, executes harvest
```

**Examples:**
```
// Single resource node
> harvest
You harvest 2x Iron Ore!

// Multiple resource nodes (client maps names to IDs)
> harvest iron ore           → Client sends materialId: "iron_ore"
You harvest 2x Iron Ore!

> harvest crystal            → Client fuzzy matches → "crystal_shard"
Wait 45 minutes.

> harvest
Which material? (iron ore, crystal shard)  ← Client shows names, sends IDs
```

**Code (~60 lines):**
```typescript
export function harvest(player: Player, materialId?: string): void {
  const location = gameState.locations.get(player.location);
  
  if (!location.resources || location.resources.length === 0) {
    return send(player, "There's nothing to harvest here.", 'error');
  }
  
  // If no material specified and multiple resources, list them
  if (!materialId && location.resources.length > 1) {
    const materials = location.resources
      .map(r => gameState.materials.get(r.materialId).name)
      .join(', ');
    return send(player, `Which material? (${materials.toLowerCase()})`, 'info');
  }
  
  // Find the resource node
  let resource: ResourceNode;
  if (materialId) {
    resource = location.resources.find(r => r.materialId === materialId);
    if (!resource) {
      return send(player, "That material isn't available here.", 'error');
    }
  } else {
    resource = location.resources[0];  // Single resource, auto-select
  }
  
  // Check cooldown (per material, per location)
  const cooldownKey = `${location.id}_${resource.materialId}`;
  const lastTime = player.lastHarvest[cooldownKey] || 0;
  const now = Date.now();
  
  if (now - lastTime < resource.cooldown) {
    const mins = Math.ceil((resource.cooldown - (now - lastTime)) / 60000);
    const material = gameState.materials.get(resource.materialId);
    return send(player, `You can't harvest ${material.name} yet. Wait ${mins} minutes.`, 'error');
  }
  
  // Success chance
  if (Math.random() > resource.chance) {
    return send(player, "You failed to harvest.", 'error');
  }
  
  // Harvest!
  const amount = randomInt(resource.amount); // "1-3" -> 1 to 3
  const material = gameState.materials.get(resource.materialId);
  
  player.materials[resource.materialId] = (player.materials[resource.materialId] || 0) + amount;
  player.lastHarvest[cooldownKey] = now;
  
  send(player, `You harvest ${amount}x ${material.name}!`, 'success');
  broadcast(player.location, `${player.name} gathers materials.`, 'system');
}
```

**Why this works:**
- Per-player cooldown (no depletion)
- All players get fair access
- No farming exploits
- Simple to implement

---

## 📊 Player Progression

### **Simple Level System**

**Player Stats:**
```typescript
interface Player {
  level: number;
  xp: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  damage: number;
  defense: number;
  gold: number;
  inventory: Item[];              // Regular items (equipment, consumables, recipes)
  equipped: {
    weapon: Item | null;
    armor: Item | null;
    shield: Item | null;
    accessory: Item | null;  // Can have any stat!
  };
  questItems: { [id: string]: number };   // Temporary quest tracking (auto-removed on complete)
  materials: { [id: string]: number };    // Permanent crafting materials (unlimited storage)
  knownRecipes: string[];                 // Learned recipe IDs
  activeQuests: { [id: string]: Quest };
  completed: string[];
  lastHarvest: { [key: string]: number };  // Key = "locationId_materialId"
  lastWhisperFrom: string;                // For reply system
}
```

**Leveling (with configurable XP):**
```typescript
function getXpNeeded(level: number): number {
  const base = config.progression.baseXpPerLevel;  // 100
  const mult = config.progression.xpMultiplier;    // 1.5
  return Math.floor(base * Math.pow(mult, level - 1));
}

function checkLevel(player: Player): void {
  const xpNeeded = getXpNeeded(player.level + 1);
  
  if (player.xp >= xpNeeded) {
    player.level++;
    player.xp -= xpNeeded;  // Carry over excess XP
    
    // Stat increases per level (configurable)
    player.maxHealth += config.progression.healthPerLevel;
    player.maxMana += config.progression.manaPerLevel;
    player.damage += config.progression.damagePerLevel;
    player.defense += config.progression.defensePerLevel;
    
    // Full restore on level up
    player.health = player.maxHealth;
    player.mana = player.maxMana;
    
    send(player, `Level up! You are now level ${player.level}.`, 'success');
    broadcast(player.location, `${player.name} has reached level ${player.level}!`, 'system');
  }
}
```

**4 Core Stats:**
- **Health** - Hit points (base + equipment bonuses)
- **Mana** - Magic points (base + equipment bonuses)
- **Damage** - Attack power (base + weapon)
- **Defense** - Damage reduction (base + armor + shield)

**NO complex attributes** (STR, DEX, INT, WIS, CON, etc.)

---

## 💬 Social System

### **Basic Communication**

**Commands:**
```
say <message>            → Talk to room (or just: <message>)
whisper <player> <msg>   → Private message (shortcut: w)
reply <message>          → Reply to last whisper (shortcut: r)
who                      → List online players
```

**Friend System:**
```
friend add <name>        → Add friend
friend remove <name>     → Remove friend
friend                   → Show friends (shortcut: f)
```

**Reply System:**
```typescript
// Track last whisper sender
interface Player {
  lastWhisperFrom: string;  // Username of last person who whispered
}

// Reply command
export function handleReply(player: Player, message: string): void {
  if (!player.lastWhisperFrom) {
    return send(player, "No one has whispered to you yet.");
  }
  
  const target = gameState.players.get(player.lastWhisperFrom);
  if (!target) {
    return send(player, "That player is no longer online.");
  }
  
  send(player, `You whisper to ${target.username}: ${message}`);
  send(target, `${player.username} whispers: ${message}`);
  target.lastWhisperFrom = player.username;  // Allow them to reply back
}
```

**Code (~180 lines total for all social)**

---

## 💀 Death & Respawn

### **Simple Death System**

**When player dies:**
```typescript
function handleDeath(player: Player): void {
  const goldLossPct = config.gameplay.deathGoldLossPct;
  const goldLost = Math.floor(player.gold * goldLossPct);
  player.gold -= goldLost;
  player.health = player.maxHealth;
  player.mana = player.maxMana;  // Also restore mana
  
  const oldLocation = player.location;
  const respawnLocation = config.gameplay.deathRespawnLocation;
  player.location = respawnLocation;
  
  send(player, `You died! Lost ${goldLost} gold.`, 'error');
  broadcast(oldLocation, `${player.name} has died!`, 'system', player.id);
  broadcast(respawnLocation, `${player.name} has respawned here.`, 'system', player.id);
}
```

**NO complex corpse system, NO XP loss, NO item drops**

**Code (~20 lines)**

---

## 🎨 Display & Information

### **Simple Text Output (Traditional)**

**Look Command:**
```
> look

=== Town Square ===
A bustling marketplace.

Exits:
  - north: forest
  - south: bridge
  - east:  farmer
  - west:  shores

People:
  - Guard, Blacksmith, Bob, Alice  // Npc's first, then players
Enemies:
  - Goblin Scout

Items:
  - Rusty Sword, Big Herbal

Resources:
  - Iron Ore (available in 15 minutes)  // Shows cooldown status per player
```

**Look Command (in a mine with resources):**
```
> look

=== Iron Mine ===
A dark mine filled with iron deposits.

Exits:
  - out: mountain_path

Resources:
  - Iron Ore (ready to harvest!)
  
> harvest
You harvest 2x Iron Ore!

> look

=== Iron Mine ===
A dark mine filled with iron deposits.

Exits:
  - out: mountain_path

Resources:
  - Iron Ore (available in 59 minutes)
```

**Inventory:**
```
> inventory

You are carrying (3/16):  // 16 slot maximum (traditional)
Gold: 250
  - Iron Sword (equipped)
  - Health Potion x3
```

**Equipment:**
```
> equipment

You are wearing:
  Weapon:   Iron Sword (+12 damage)
  Armor:    Leather Armor (+8 defense)
  Shield:   (none)
  accessory: Jade Amulet (+15 health)
```

**NO ASCII maps, NO fancy boxes, NO color codes in core**

**Look Command Implementation (~50 lines):**
```typescript
export function look(player: Player): void {
  const location = gameState.locations.get(player.location);
  
  let message = `\n=== ${location.name} ===\n${location.description}`;
  
  // Exits
  if (Object.keys(location.exits).length > 0) {
    message += '\n\nExits:\n';
    for (const [dir, dest] of Object.entries(location.exits)) {
      message += `  - ${dir}: ${dest}\n`;
    }
  }
  
  // Resources (with cooldown status per material)
  if (location.resources && location.resources.length > 0) {
    message += '\nResources:\n';
    for (const node of location.resources) {
      const material = gameState.materials.get(node.materialId);
      const cooldownKey = `${location.id}_${node.materialId}`;
      const lastHarvest = player.lastHarvest[cooldownKey] || 0;
      const now = Date.now();
      const timeLeft = node.cooldown - (now - lastHarvest);
      
      if (timeLeft <= 0) {
        message += `  - ${material.name} (ready to harvest!)\n`;
      } else {
        const mins = Math.ceil(timeLeft / 60000);
        message += `  - ${material.name} (available in ${mins} minutes)\n`;
      }
    }
  }
  
  // People (NPCs first, then players)
  const npcs = location.npcs || [];
  const players = getPlayersInLocation(location.id).filter(p => p.id !== player.id);
  if (npcs.length > 0 || players.length > 0) {
    const names = [...npcs.map(n => n.name), ...players.map(p => p.name)];
    message += `\nPeople:\n  - ${names.join(', ')}\n`;
  }
  
  // Enemies
  if (location.enemies && location.enemies.length > 0) {
    const enemyNames = location.enemies.map(e => e.name).join(', ');
    message += `\nEnemies:\n  - ${enemyNames}\n`;
  }
  
  // Items on ground
  if (location.items && location.items.length > 0) {
    const itemNames = location.items.map(i => i.name).join(', ');
    message += `\nItems:\n  - ${itemNames}\n`;
  }
  
  send(player, message, 'info');
}
```

**Code (~150 lines for all info commands)**

---

## 🩹 Health & Mana Recovery

### **No Auto-Regeneration (Traditional Hardcore)**

**Recovery Methods:**
1. **Potions** - Instant restore (consumables)
2. **Healers** - Pay gold for full restore
3. **Level Up** - Full HP/mana restore

**NO passive regeneration** - resource management matters!

**Why this design:**
- ✅ Makes potions valuable (economy)
- ✅ Makes healers relevant (gold sink)
- ✅ Strategic resource management
- ✅ Traditional hardcore MUD style
- ✅ Simple (no regen timers needed)

**Code: 0 lines (no regen system needed!)**

---

## 🎮 Command Shortcuts

### **Essential Quality of Life**

> **Important:** Player types friendly names, client maps to IDs, server operates on IDs only.

**Movement:**
```
n, s, e, w, u, d        → north, south, east, west, up, down
```

**Combat:**
```
k <target>              → kill/attack <target> (client maps name → enemyId)
fl                      → flee
```

**Inventory:**
```
i                       → inventory
eq                      → equipment
get <item>              → get <item>
drop <item>             → drop <item>
```

**Items:**
```
use <item>              → use <item>
```

**Social:**
```
w <player> <msg>        → whisper <player> <msg>
r <message>             → reply <message> (to last whisper)
f                       → friend list
```

**Information:**
```
l                       → look
who                     → who (no shortcut needed)
```

**Crafting:**
```
craft <recipe>          → craft <recipe>
recipes                 → recipes (list known)
examine <recipe>        → examine <recipe> (show requirements)
materials               → materials (show harvested materials)
```

**NPC:**
```
t <npc>                 → talk <npc>
```

**Code (~20 lines - just alias mapping)**

---

## 📚 Help System

### **Built-in Documentation**

**Help Command:**
```
> help

Available Commands:
  Movement:  n, s, e, w, u, d, flee (fl)
  Combat:    kill (k), flee (fl)
  Items:     inventory (i), equipment (eq), use, get, drop
  Crafting:  craft, recipes, materials, examine
  Social:    say, whisper (w), reply (r), friend (f), who
  NPC:       talk (t)
  Info:      look (l), help
  
Type 'help <category>' for more details.
```

**Category Help:**
```
> help combat

Combat Commands:
  kill <target>  (k) - Attack an enemy or player (client maps name → ID)
  flee           (fl) - Attempt to escape combat (50% chance)
  
Examples:
  k goblin           → Client maps "goblin" → "goblin_warrior" → sends enemyId
  kill goblin scout  → Client maps "goblin scout" → "goblin_scout_1" → sends enemyId
  fl
```

**Code (~80 lines - static help text + formatter)**

---

## ⚙️ Starting Configuration

### **New Player Setup (Data-Driven)**

**config.json:**
```json
{
  "newPlayer": {
    "startingLocation": "town_square",
    "startingLevel": 1,
    "startingGold": 50,
    "startingHealth": 100,
    "startingMana": 50,
    "startingDamage": 5,
    "startingDefense": 3,
    "startingEquipment": {
      "weapon": "rusty_sword",
      "armor": "cloth_shirt",
      "shield": null,
      "accessory": null
    },
    "startingInventory": [
      "health_potion",
      "health_potion"
    ]
  },
  "gameplay": {
    "maxInventorySlots": 16,
    "fleeSuccessChance": 0.5,
    "enemyRespawnTime": 60000,
    "deathGoldLossPct": 0.1,
    "deathRespawnLocation": "town_square",
    "damageVariance": 0.1
  },
  "progression": {
    "baseXpPerLevel": 100,
    "xpMultiplier": 1.5,
    "healthPerLevel": 10,
    "manaPerLevel": 5,
    "damagePerLevel": 2,
    "defensePerLevel": 1
  },
  "economy": {
    "shopBuyMultiplier": 1.2,
    "shopSellMultiplier": 0.5,
    "healerCostFactor": 50
  }
}
```

**XP Progression Formula:**
```typescript
function getXpNeeded(level: number): number {
  const base = config.progression.baseXpPerLevel;  // 100
  const mult = config.progression.xpMultiplier;    // 1.5
  return Math.floor(base * Math.pow(mult, level - 1));
}

// Level 1 → 2: 100 XP
// Level 2 → 3: 150 XP (100 * 1.5)
// Level 3 → 4: 225 XP (100 * 1.5²)
// Level 4 → 5: 337 XP (100 * 1.5³)
```

**All Configurable Game Values:**

**Progression Tuning:**
- `baseXpPerLevel` (100): Base XP needed for level 2
- `xpMultiplier` (1.5): Exponential curve steepness (1.0 = linear, 2.0 = very steep)
- `healthPerLevel` (10): HP gained per level
- `manaPerLevel` (5): Mana gained per level  
- `damagePerLevel` (2): Damage gained per level
- `defensePerLevel` (1): Defense gained per level

**Gameplay Balance:**
- `maxInventorySlots` (16): Inventory size limit
- `fleeSuccessChance` (0.5): 50% flee success rate
- `enemyRespawnTime` (60000): 60 seconds enemy respawn
- `deathGoldLossPct` (0.1): Lose 10% gold on death
- `deathRespawnLocation` ("town_square"): Where players respawn
- `damageVariance` (0.1): 10% damage randomness (±10% from base damage)

**Economy Balance:**
- `shopBuyMultiplier` (1.2): Players pay 120% of item value
- `shopSellMultiplier` (0.5): Players get 50% of item value
- `healerCostFactor` (50): Healing costs 0.5 gold per HP/mana (50/100)

**Damage Variance Examples:**
- Base damage: 10 → Actual damage: 9-11 (with 0.1 variance)
- Base damage: 20 → Actual damage: 18-22 (with 0.1 variance)
- Base damage: 5 → Actual damage: 4-6 (with 0.1 variance)
- Minimum damage is always 1 (even if variance would go lower)

**Why configurable:**
- ✅ Easy game balance tweaks without code changes
- ✅ Adjust difficulty curve (make harder/easier)
- ✅ Fine-tune economy (gold sinks vs rewards)
- ✅ Customize server styles (hardcore vs casual)
- ✅ A/B test different progression rates
- ✅ All in one file for quick reference

**Code (~40 lines to load and apply config + XP calculations)**

---

## 🔨 Crafting System (Recipe Learning)

### **Traditional MUD Pattern: Find & Learn Recipes**

**Recipe Items (can be consumed by the use command):**
```json
{
  "id": "recipe_iron_sword",
  "name": "Recipe: Iron Sword",
  "type": "recipe",
  "description": "A crafting recipe for an Iron Sword",
  "teachesRecipe": "iron_sword_recipe"
}
```

**Recipe Data (Two Types: Items OR Materials):**

**1. Item Recipes (create equipment/consumables):**
```json
// data/recipes/iron_sword_recipe.json
{
  "id": "iron_sword_recipe",
  "name": "Iron Sword Recipe",
  "result": "iron_sword",           // Item ID from items/ folder
  "resultType": "item",              // Creates an item
  "materials": {                     // Material IDs from materials/ folder
    "iron_ore": 3,
    "wolf_pelt": 1
  },
  "requiredLevel": 5
}
```

**2. Material Recipes (process raw materials into refined ones):**
```json
// data/recipes/smelt_iron_bar.json
{
  "id": "smelt_iron_bar",
  "name": "Smelt Iron Bar",
  "result": "iron_bar",              // Material ID from materials/ folder
  "resultType": "material",          // Creates a material
  "resultAmount": 1,                 // How many materials produced
  "materials": {
    "iron_ore": 2                    // 2 ore → 1 refined bar
  },
  "requiredLevel": 1
}
```

**Recipe Interface:**
```typescript
interface Recipe {
  id: string;
  name: string;
  result: string;                              // Item ID OR material ID
  resultType: 'item' | 'material';             // What type to create
  resultAmount?: number;                       // For materials (default: 1)
  materials: { [materialId: string]: number }; // Material requirements
  requiredLevel: number;                       // Level required to LEARN recipe
}
```

**How It Works:**

1. **Find recipe** (drop from enemies/locations/NPCs)
2. **Learn recipe** (`use recipe: iron sword`)
3. **View recipes** (`recipes` command)
4. **Examine recipe** (`examine iron_sword_recipe` - see requirements)
5. **Craft item/material** (`craft iron_sword_recipe` - if materials available)

**Command Flow (Item Crafting):**
```
> use recipe: iron sword
You learn how to craft: Iron Sword Recipe!

> recipes
Known Recipes:
  - Iron Sword Recipe (Level 5)
  - Smelt Iron Bar (Level 1)
  
> examine iron_sword_recipe
=== Iron Sword Recipe ===
Required Level: 5

Materials Required:
  ✓ Iron Ore: 3/3
  ✓ Wolf Pelt: 1/1

Result: Iron Sword
  A sturdy iron blade.
  Damage: +15

> craft iron_sword_recipe
You craft Iron Sword!
Materials consumed: 3x Iron Ore, 1x Wolf Pelt
```

**Command Flow (Material Processing):**
```
> use recipe: smelt iron
You learn how to craft: Smelt Iron Bar!

> examine smelt_iron_bar
=== Smelt Iron Bar ===
Required Level: 1

Materials Required:
  ✓ Iron Ore: 2/2

Result: 1x Iron Bar
  A refined iron bar, ready to be forged into equipment.
  Rarity: common

> craft smelt_iron_bar
You craft 1x Iron Bar!
Materials consumed: 2x Iron Ore

> materials
=== Crafting Materials ===
  1x Iron Bar [common]
  5x Wolf Pelt [common]
```

**Key Differences:**
- **Item recipes**: Result goes to inventory (requires space)
- **Material recipes**: Result goes to materials storage (unlimited, no inventory needed)
- **Processing chains**: Raw materials → Refined materials → Crafted items

**Material Storage:**
- Materials stored in `player.materials` (separate from inventory!)
- Harvested from resource nodes OR dropped from enemies OR crafted from other materials
- Unlimited storage (don't take inventory space)
- Example: `{ iron_ore: 5, iron_bar: 2, leather: 8 }`

**Multi-Stage Crafting Examples:**

```
Stage 1: Raw materials → Refined materials
  2x Iron Ore → 1x Iron Bar (smelting)
  3x Wolf Pelt → 2x Leather (tanning)

Stage 2: Refined materials → Equipment
  3x Iron Bar + 1x Leather → Iron Sword
  5x Leather → Leather Armor
```

**Code (~293 lines total - src/crafting.ts):**

```typescript
// Learn recipe from item
export function useRecipe(player: Player, recipeItem: Item): void {
  const recipeId = recipeItem.teachesRecipe;
  
  if (player.knownRecipes.includes(recipeId)) {
    return send(player, "You already know this recipe!");
  }

  const recipe = gameState.recipes.get(recipeId);

  if (player.level < recipe.requiredLevel) {
    return send(player, `Your level is too low to learn ${recipe.name}.`);
  }

  player.knownRecipes.push(recipeId);
  send(player, `You learn how to craft: ${recipe.name}!`);
  
  // Remove recipe item from inventory
  removeFromInventory(player, recipeItem);
}

// List known recipes
export function listRecipes(player: Player): void {
  if (player.knownRecipes.length === 0) {
    return send(player, "You don't know any recipes yet.");
  }
  
  send(player, "Known Recipes:");
  for (const recipeId of player.knownRecipes) {
    const recipe = gameState.recipes.get(recipeId);
    send(player, `  - ${recipe.name} (Level ${recipe.requiredLevel})`);
  }
}

// Examine recipe details
export function examineRecipe(player: Player, recipeId: string): void {
  if (!player.knownRecipes.includes(recipeId)) {
    return send(player, "You don't know that recipe.");
  }
  
  const recipe = gameState.recipes.get(recipeId);
  let message = `Recipe: ${recipe.name}\n`;
  message += `Required Level: ${recipe.requiredLevel}\n`;
  message += "Materials:\n";
  
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    const material = gameState.materials.get(materialId);
    const has = player.materials[materialId] || 0;
    message += `  - ${material.name} x${amount} (you have: ${has})\n`;
  }
  
  const resultItem = gameState.items.get(recipe.result);
  message += `Result: ${resultItem.name}\n`;
  
  send(player, message, 'info');
}

// Craft item
export function craft(player: Player, recipeId: string): void {
  if (!player.knownRecipes.includes(recipeId)) {
    return send(player, "You don't know that recipe.");
  }
  
  const recipe = gameState.recipes.get(recipeId);
  
  // Check materials
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    const material = gameState.materials.get(materialId);
    if ((player.materials[materialId] || 0) < amount) {
      return send(player, `You need ${amount}x ${material.name}.`);
    }
  }
```typescript
// Craft item or material
export function craft(player: Player, recipeId: string): void {
  const recipe = gameState.recipes.get(recipeId);
  
  // Validate recipe known, level, materials
  // ...
  
  // Consume materials
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    player.materials[materialId] -= amount;
  }
  
  if (recipe.resultType === 'material') {
    // Create material (goes to materials storage)
    const amount = recipe.resultAmount || 1;
    player.materials[recipe.result] += amount;
    
    const mat = gameState.materials.get(recipe.result);
    send(player, `You craft ${amount}x ${mat.name}!`);
  } else {
    // Create item (goes to inventory)
    const item = gameState.items.get(recipe.result);
    player.inventory.push({ ...item });
    send(player, `You craft ${item.name}!`);
  }
}
```

**Benefits:**
- ✅ Traditional MUD pattern (find recipes as loot)
- ✅ Recipes become valuable tradeable items
- ✅ Multi-stage crafting (raw → refined → equipment)
- ✅ Material processing doesn't require inventory space
- ✅ Encourages exploration (find recipes in locations)
- ✅ Clear separation: materials storage (unlimited, separate from inventory)
- ✅ Simple commands: recipes, examine, craft, materials, harvest
- ✅ ~293 lines total (src/crafting.ts)

---

## 📁 Data Architecture

### **Folder-Based JSON Structure (Scalable)**

```
data/
├── locations/           # Each location = separate file
│   ├── town_square.json
│   ├── forest_path.json
│   ├── dark_cave.json
│   └── ...
├── items/               # Each item = separate file
│   ├── iron_sword.json
│   ├── health_potion.json
│   ├── wizard_robe.json
│   └── ...
├── enemies/             # Each enemy type = separate file
│   ├── goblin.json
│   ├── wolf.json
│   ├── dragon.json
│   └── ...
├── npcs/                # Each NPC = separate file
│   ├── blacksmith.json
│   ├── guard.json
│   ├── portal_master.json
│   └── ...
├── quests/              # Each quest = separate file
│   ├── goblin_problem.json
│   ├── wolf_pelts.json
│   ├── find_daughter.json
│   └── ...
├── shops/               # Each shop = separate file
│   ├── weapon_shop.json
│   ├── armor_shop.json
│   ├── general_store.json
│   └── ...
├── recipes/             # Each recipe = separate file
│   ├── iron_sword.json
│   ├── health_potion.json
│   └── ...
├── materials/           # Each material/resource = separate file
│   ├── iron_ore.json
│   ├── coal.json
│   ├── copper_ore.json
│   └── ...
└── config.json          # Global game settings
```

**Benefits:**
- ✅ Easy to find/edit specific content
- ✅ Git-friendly (clean diffs, no merge conflicts)
- ✅ Scales to 100s or 1000s of items
- ✅ Team collaboration (multiple people editing different files)
- ✅ Hot-reload individual files (dev workflow)
- ✅ Clear organization by type

**TypeScript Interfaces:**
```typescript
// types.ts - Core interfaces only
interface Location { ... }
interface Item { ... }
interface Enemy { ... }
interface NPC { ... }
interface Quest { ... }
interface Recipe { ... }
interface Material { ... }
interface Player { ... }
```

**Data Loader (~80 lines):**
```typescript
// data.ts
import fs from 'fs';
import path from 'path';

export interface GameData {
  locations: Map<string, Location>;
  items: Map<string, Item>;
  enemies: Map<string, Enemy>;
  npcs: Map<string, NPC>;
  quests: Map<string, Quest>;
  shops: Map<string, Shop>;
  recipes: Map<string, Recipe>;
  materials: Map<string, Material>;
  config: Config;
}

export async function loadGameData(): Promise<GameData> {
  const dataDir = path.join(__dirname, '../data');
  
  return {
    locations: await loadFolder<Location>(path.join(dataDir, 'locations')),
    items: await loadFolder<Item>(path.join(dataDir, 'items')),
    enemies: await loadFolder<Enemy>(path.join(dataDir, 'enemies')),
    npcs: await loadFolder<NPC>(path.join(dataDir, 'npcs')),
    quests: await loadFolder<Quest>(path.join(dataDir, 'quests')),
    shops: await loadFolder<Shop>(path.join(dataDir, 'shops')),
    recipes: await loadFolder<Recipe>(path.join(dataDir, 'recipes')),
    materials: await loadFolder<Material>(path.join(dataDir, 'materials')),
    config: JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf-8'))
  };
}

async function loadFolder<T extends { id: string }>(folderPath: string): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    return map;
  }
  
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8')) as T;
    map.set(data.id, data);
  }
  
  console.log(`Loaded ${map.size} items from ${path.basename(folderPath)}/`);
  return map;
}
```

**Usage:**
```typescript
// server.ts
const gameData = await loadGameData();
console.log('Game data loaded:');
console.log(`  - ${gameData.locations.size} locations`);
console.log(`  - ${gameData.items.size} items`);
console.log(`  - ${gameData.enemies.size} enemies`);
console.log(`  - ${gameData.npcs.size} NPCs`);
console.log(`  - ${gameData.quests.size} quests`);
console.log(`  - ${gameData.shops.size} shops`);
console.log(`  - ${gameData.recipes.size} recipes`);
console.log(`  - ${gameData.materials.size} materials`);
```

### **ID-Based References with Runtime Enrichment**

**CRITICAL PATTERN:** Location JSON files store only IDs for enemies and items, which get enriched to full objects during data loading. This keeps data files clean and maintainable.

**Location JSON (as stored on disk):**
```json
{
  "id": "deep_forest",
  "name": "Deep Forest",
  "description": "The forest grows darker here...",
  "exits": {
    "north": "forest_path"
  },
  "enemies": ["wolf", "spider"],
  "items": ["health_potion"]
}
```

**After Loading (enriched in memory):**
```typescript
{
  id: "deep_forest",
  name: "Deep Forest",
  description: "The forest grows darker here...",
  exits: { north: "forest_path" },
  enemies: [
    {
      id: "wolf",
      name: "Gray Wolf",
      health: 60,
      maxHealth: 60,
      damage: 12,
      // ... full enemy object from enemies/wolf.json
      fighters: []  // Instance-specific runtime data
    },
    {
      id: "spider",
      name: "Giant Spider",
      // ... full enemy object from enemies/spider.json
      fighters: []
    }
  ],
  items: [
    {
      id: "health_potion",
      name: "Health Potion",
      // ... full item object from items/health_potion.json
    }
  ]
}
```

**Enrichment Function (~60 lines added to data.ts):**
```typescript
function enrichLocations(gameData: GameData): void {
  for (const location of gameData.locations.values()) {
    // Enrich enemies: convert ID strings to full Enemy objects
    if (location.enemies && Array.isArray(location.enemies)) {
      const enrichedEnemies: Enemy[] = [];
      
      for (const enemyId of location.enemies as any[]) {
        // If it's a string ID, enrich it
        if (typeof enemyId === 'string') {
          const enemyTemplate = gameData.enemies.get(enemyId);
          if (enemyTemplate) {
            // Create instance with runtime data
            enrichedEnemies.push({
              ...enemyTemplate,
              health: enemyTemplate.maxHealth,
              fighters: []
            });
          }
        }
      }
      
      location.enemies = enrichedEnemies;
    }
    
    // Same pattern for items
    if (location.items && Array.isArray(location.items)) {
      const enrichedItems: Item[] = [];
      
      for (const itemId of location.items as any[]) {
        if (typeof itemId === 'string') {
          const itemTemplate = gameData.items.get(itemId);
          if (itemTemplate) {
            enrichedItems.push({ ...itemTemplate });
          }
        }
      }
      
      location.items = enrichedItems;
    }
  }
}

// Called in loadGameData():
export async function loadGameData(): Promise<GameData> {
  const gameData: GameData = {
    // ... load all data
  };
  
  enrichLocations(gameData);  // Convert IDs to objects
  enrichQuests(gameData);     // Populate quest.npc field
  
  return gameData;
}
```

### **Data Validation (Fail-Fast)**

**All enrichment functions throw errors on invalid data:**

```typescript
function enrichLocations(gameData: GameData): void {
  for (const location of gameData.locations.values()) {
    // Validate NPC IDs
    for (const npcId of location.npcs) {
      const npc = gameData.npcs.get(npcId);
      if (!npc) {
        throw new Error(`NPC ID "${npcId}" not found in location "${location.id}"`);
      }
      enrichedNPCs.push({ ...npc });
    }
    
    // Same for enemies, items, shops - all throw on missing IDs
  }
}

function enrichQuests(gameData: GameData): void {
  for (const quest of gameData.quests.values()) {
    let questGiverCount = 0;
    let questGiverId: string | undefined;
    
    // Find which NPC gives this quest
    for (const npc of gameData.npcs.values()) {
      if (npc.quest === quest.id) {
        questGiverCount++;
        questGiverId = npc.id;
      }
    }
    
    // Validate: at most one quest giver
    if (questGiverCount === 0) {
      console.warn(`Quest "${quest.id}" has no NPC quest giver (not yet assigned).`);
    } else if (questGiverCount > 1) {
      throw new Error(`Quest "${quest.id}" has multiple quest givers!`);
    } else {
      quest.npc = questGiverId;  // Auto-populate from NPC.quest
    }
  }
}
```

**Validation Rules:**
- ❌ **Missing ID reference** → Server fails to start
- ❌ **Multiple quest givers** → Server fails to start  
- ⚠️ **Quest without NPC** → Warning only (designer preview)

**Benefits:**
- ✅ **DRY**: Enemy stats defined once in enemies/wolf.json
- ✅ **Maintainable**: Change wolf stats in one place, affects all locations
- ✅ **Clean diffs**: Location files show just IDs, not full enemy data
- ✅ **Scalable**: Add 100 wolves to 100 locations with just their IDs
- ✅ **Type-safe**: TypeScript sees Location.enemies as Enemy[] at runtime

**Same pattern applies to:**
- NPCs in locations (npc IDs → full NPC objects)
- Items in shops (item IDs → full Item objects)
- Materials in recipes (material IDs → full Material objects)
- Quest rewards (item IDs → full Item objects)
- **Player inventory** (item IDs → full Item objects)
- **Player equipment** (item IDs → full Item objects)

---

### **Player Persistence with ID-Based Storage**

**CRITICAL:** Player save files store only IDs for inventory and equipped items, which get enriched when loading. This keeps player files clean and ensures item stats are always up-to-date.

**Player Save File (JSON on disk):**
```json
{
  "id": "uuid-here",
  "username": "player1",
  "passwordHash": "$2b$10$...",
  "location": "town_square",
  "level": 5,
  "xp": 450,
  "health": 120,
  "maxHealth": 150,
  "mana": 80,
  "maxMana": 100,
  "damage": 15,
  "defense": 10,
  "gold": 350,
  "inventory": ["health_potion", "iron_sword", "health_potion"],
  "equipped": {
    "weapon": "iron_sword",
    "armor": "leather_armor",
    "shield": null,
    "accessory": "jade_amulet"
  },
  "materials": {
    "wolf_pelt": 5,
    "iron_ore": 3
  },
  "knownRecipes": ["iron_sword_recipe"]
}
```

**Player Object (enriched in memory):**
```typescript
{
  id: "uuid-here",
  username: "player1",
  // ... other fields same ...
  inventory: [
    {
      id: "health_potion",
      name: "Health Potion",
      type: "consumable",
      healAmount: 50,
      // ... full item object from items/health_potion.json
    },
    {
      id: "iron_sword",
      name: "Iron Sword",
      type: "equipment",
      slot: "weapon",
      damage: 12,
      // ... full item object from items/iron_sword.json
    },
    // ... another health potion
  ],
  equipped: {
    weapon: {
      id: "iron_sword",
      name: "Iron Sword",
      // ... full item object
    },
    armor: {
      id: "leather_armor",
      name: "Leather Armor",
      // ... full item object
    },
    shield: null,
    accessory: {
      id: "jade_amulet",
      name: "Jade Amulet",
      // ... full item object
    }
  }
}
```

**Player Save/Load Code (~130 lines in player.ts):**
```typescript
export async function savePlayer(player: Player): Promise<void> {
  const filePath = path.join(PERSIST_DIR, `${player.username}.json`);
  
  // Remove socket (runtime only)
  const { socket, ...playerData } = player;
  
  // Convert inventory items to IDs only
  const inventoryIds = player.inventory.map(item => item.id);
  
  // Convert equipped items to IDs only
  const equippedIds = {
    weapon: player.equipped.weapon?.id || null,
    armor: player.equipped.armor?.id || null,
    shield: player.equipped.shield?.id || null,
    accessory: player.equipped.accessory?.id || null
  };
  
  // Create save data with IDs instead of full objects
  const saveData = {
    ...playerData,
    inventory: inventoryIds,
    equipped: equippedIds
  };
  
  fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
}

export async function loadPlayer(username: string): Promise<Player | null> {
  const filePath = path.join(PERSIST_DIR, `${username}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  // Enrich inventory: convert item IDs to full Item objects
  if (data.inventory && Array.isArray(data.inventory)) {
    const enrichedInventory: Item[] = [];
    for (const itemId of data.inventory) {
      if (typeof itemId === 'string') {
        const item = gameState.gameData.items.get(itemId);
        if (item) {
          enrichedInventory.push({ ...item });
        } else {
          console.warn(`Item ID "${itemId}" not found for player ${username}`);
        }
      }
    }
    data.inventory = enrichedInventory;
  }
  
  // Enrich equipped items: convert item IDs to full Item objects
  if (data.equipped) {
    const slots = ['weapon', 'armor', 'shield', 'accessory'] as const;
    for (const slot of slots) {
      const itemId = data.equipped[slot];
      if (itemId && typeof itemId === 'string') {
        const item = gameState.gameData.items.get(itemId);
        data.equipped[slot] = item ? { ...item } : null;
      }
    }
  }
  
  return data as Player;
}
```

**Benefits:**
- ✅ **Clean save files**: Just IDs, not 100s of lines of duplicated item data
- ✅ **Always current**: Item stats updated? All players get new stats on next load
- ✅ **Smaller files**: Player saves are tiny (~30 lines vs 300+ with full objects)
- ✅ **Easy debugging**: Can read/edit player files by hand
- ✅ **Type-safe**: Runtime still has full Item objects with all properties
- ✅ **Backward compatible**: Code handles both old (objects) and new (IDs) formats

**Example:**
```
Change iron_sword damage from 12 → 15 in items/iron_sword.json
→ All players with iron_sword get +15 damage on next login (no player file edits!)
```
- Materials in recipes (material IDs → full Material objects)
- Quest rewards (item IDs → full Item objects)

---

## 📨 Infrastructure & Messaging

### **Core Communication System**

The entire MUD relies on two fundamental messaging functions that are used throughout all systems:

**1. `send(player, message)` - Direct message to one player**
```typescript
function send(player: Player, message: string): void {
  player.socket.emit('message', message);
}
```

**Usage:**
- Send feedback to command executor
- Private information (inventory, stats, errors)
- Quest updates, combat results

**Examples:**
```typescript
send(player, "You can't go that way.");
send(player, `You hit ${enemy.name} for ${damage} damage.`);
send(player, "Your inventory is full!");
```

**2. `broadcast(locationId, message, excludePlayerId?)` - Message to all in location**
```typescript
function broadcast(locationId: string, message: string, exclude?: string): void {
  const players = getPlayersInLocation(locationId);
  players.forEach(p => {
    if (p.id !== exclude) {
      p.socket.emit('message', message);
    }
  });
}
```

**Usage:**
- Notify others of player actions
- Combat events visible to all
- Movement arrival/departure
- Social interactions

**Examples:**
```typescript
broadcast(location, `${player.name} attacks ${enemy.name}.`);
broadcast(location, `${player.name} leaves north.`, player.id);
broadcast(location, `${player.name} says: Hello everyone!`);
```

**3. `whisper(fromPlayer, toPlayer, message)` - Private player-to-player**
```typescript
function whisper(from: Player, to: Player, message: string): void {
  send(to, `${from.name} whispers: ${message}`);
  send(from, `You whisper to ${to.name}: ${message}`);
}
```

**Why This Design:**
- ✅ Simple Socket.IO wrapper (just emit events)
- ✅ Every command uses send/broadcast consistently
- ✅ Easy to understand message flow
- ✅ ~30 lines total for all messaging

**Code (~30 lines):**
```typescript
// messaging.ts
import { Player } from './types';

export function send(player: Player, message: string): void {
  player.socket.emit('message', message);
}

export function broadcast(locationId: string, message: string, excludeId?: string): void {
  const location = gameState.locations.get(locationId);
  const players = Array.from(gameState.players.values())
    .filter(p => p.location === locationId && p.id !== excludeId);
  
  players.forEach(p => p.socket.emit('message', message));
}

export function whisper(from: Player, toName: string, message: string): void {
  const to = findPlayerByName(toName);
  
  if (!to) {
    return send(from, "Player not found.");
  }
  
  send(to, `${from.name} whispers: ${message}`);
  send(from, `You whisper to ${to.name}: ${message}`);
  
  // Track for reply system
  to.lastWhisperFrom = from.name;
}

export function sendToAll(message: string): void {
  gameState.players.forEach(p => p.socket.emit('message', message));
}
```

**🎨 Better Design: Message Types for Client Styling**

Instead of plain strings, send **typed messages** so clients can style them differently:

```typescript
// Add to types.ts
export type MessageType = 
  | 'info'       // General information (look, inventory, help)
  | 'success'    // Positive actions (bought item, quest complete, level up)
  | 'error'      // Failed actions (can't afford, inventory full)
  | 'combat'     // Combat messages (damage dealt/taken)
  | 'say'        // Public chat (say command)
  | 'whisper'    // Private messages (whisper/reply)
  | 'npc'        // NPC dialogue
  | 'system'     // Server announcements (player joined/left, movement)
  | 'loot';      // Rewards (gold/xp gained, item found)

export interface GameMessage {
  type: MessageType;
  text: string;
  timestamp: number;
}

// Updated messaging.ts with types
export function send(player: Player, text: string, type: MessageType = 'info'): void {
  player.socket.emit('message', { type, text, timestamp: Date.now() });
}

export function broadcast(
  locationId: string, 
  text: string, 
  type: MessageType = 'info',
  excludeId?: string
): void {
  const players = Array.from(gameState.players.values())
    .filter(p => p.location === locationId && p.id !== excludeId);
  
  players.forEach(p => send(p, text, type));
}
```

**Usage with Types:**
```typescript
send(player, "You can't go that way.", 'error');               // Red
send(player, `You hit goblin for 15 damage.`, 'combat');       // Yellow
send(player, "Quest complete!", 'success');                    // Green
send(player, "You gained 50 gold!", 'loot');                   // Gold
broadcast(loc, `${player.name} says: Hello!`, 'say');          // Cyan (public chat)
send(player, `Bob whispers: Hey there!`, 'whisper');           // Magenta (private)
send(player, `Blacksmith: Welcome to my shop!`, 'npc');        // White/Bold (NPC)
broadcast(loc, `${player.name} arrives.`, 'system');           // Gray (system/movement)
```

**Client Styling (CSS):**
```css
.msg-info     { color: #aaa; }   /* Gray - neutral */
.msg-success  { color: #0f0; }   /* Green - success */
.msg-error    { color: #f00; }   /* Red - errors */
.msg-combat   { color: #ff0; }   /* Yellow - combat */
.msg-say      { color: #0ff; }   /* Cyan - public chat */
.msg-whisper  { color: #f0f; }   /* Magenta - private messages */
.msg-npc      { color: #fff; font-weight: bold; }  /* White bold - NPC dialogue */
.msg-system   { color: #888; }   /* Dark gray - system/movement */
.msg-loot     { color: #fa0; }   /* Gold - rewards */
```

**Client Implementation:**
```typescript
// client.js
socket.on('message', (msg: GameMessage) => {
  const div = document.createElement('div');
  div.className = `msg-${msg.type}`;
  div.textContent = msg.text;
  outputDiv.appendChild(div);
});
```

**Benefits:**
- ✅ 9 message types for precise styling control
- ✅ Distinguish public chat (say) from private (whisper)
- ✅ NPCs have unique styling (bold white)
- ✅ Movement merged into system messages
- ✅ Client controls styling (colors, fonts, sounds)
- ✅ Type defaults to 'info' (no breaking changes)
- ✅ Timestamp for history/logging
- ✅ Traditional MUD feel with modern UX

---

## 🔧 Technical Stack

### **Core:**
- Node.js + TypeScript
- Socket.IO (real-time)
- File system (player data)
```

---

## �🔧 Technical Stack

### **Core:**
- Node.js + TypeScript
- Socket.IO (real-time)
- File system (player data)
- JSON (all content)

### **File Structure:**
```
src/
├── server.ts         # Entry point (~100 lines)
├── types.ts          # Interfaces (~100 lines)
├── game.ts           # Game state (~50 lines)
├── data.ts           # JSON folder loader (~80 lines)
├── player.ts         # Auth/save (~100 lines)
├── combat.ts         # Combat system (~200 lines)
├── items.ts          # Items/equipment (~150 lines)
├── quests.ts         # Quest system (~256 lines)
├── movement.ts       # Move/flee (~60 lines)
├── shops.ts          # Buy/sell (~150 lines)
├── npcs.ts           # NPC interaction (~60 lines)
├── social.ts         # Say/whisper/who (~150 lines)
└── commands.ts       # Command router (~200 lines)

Total: ~1,520 lines
+ utilities/helpers: ~300 lines
+ error handling: ~200 lines
= ~2,020 lines total
```

---

## ✅ Feature Checklist

### **Core Systems:**
- [x] 6-direction movement (n/s/e/w/u/d)
- [x] Flee command (combat only, configurable success chance)
- [x] Shared enemy combat
- [x] 4-stat system (health/mana/damage/defense)
- [x] Equipment (weapon/armor/shield/accessory)
- [x] Consumables (situation-based: potions anytime, attack scrolls combat-only, teleport scrolls peaceful-only)
- [x] Shop system (buy/sell)
- [x] Quest system (kill/collect/visit)
- [x] Quest items (separate from inventory)
- [x] NPC dialogue (quest givers, healers, portal masters)
- [x] Direct give command
- [x] Portal travel (gold sink)
- [x] Materials system (separate from items, unlimited storage)
- [x] Material harvesting (per-player nodes with cooldowns)
- [x] Material drops from enemies (chance-based)
- [x] Crafting system (recipe learning)
- [x] Recipe items (find & learn)
- [x] Level progression (configurable XP curve)
- [x] Social commands (say/whisper/reply/friends)
- [x] Death/respawn (configurable penalties)

### **Infrastructure:**
- [x] TypeScript types
- [x] Folder-based JSON data (locations/, items/, enemies/, npcs/, quests/, shops/, recipes/, materials/)
- [x] Socket.IO real-time
- [x] Typed messages (9 message types for client styling)
- [x] File-based player storage
- [x] Command routing
- [x] Message broadcasting
- [x] Command shortcuts
- [x] Configurable game mechanics (15 values in config.json)

---

## 🚫 What We're NOT Building

- ❌ Trade windows/GUIs (610 lines saved)
- ❌ ASCII map visualization (140 lines saved)
- ❌ Quest prerequisite chains (110 lines saved)
- ❌ Random NPC dialogue (20 lines saved)
- ❌ Item cooldowns (80 lines saved)
- ❌ Verbose health descriptions (120 lines saved)
- ❌ Ground item respawn timers (160 lines saved)
- ❌ Homestone binding (83 lines saved)
- ❌ Diagonal movement (20 lines saved)
- ❌ Complex stat systems (STR/DEX/etc)
- ❌ Item durability/weight
- ❌ PvP (maybe later)
- ❌ Guilds/factions
- ❌ Pet/mount systems
- ❌ Database backend

**Total bloat avoided: ~1,500+ lines**

---

## 🎯 Success Criteria

**A successful MiniMUD:**
- ✅ Feels like a 1990s MUD
- ✅ ~2,000 lines of clean code
- ✅ Complete core gameplay loop
- ✅ Real-time multiplayer
- ✅ JSON-based content
- ✅ Easy to understand fully
- ✅ Easy to extend

**It does NOT need to:**
- ❌ Compete with modern MMOs
- ❌ Have every feature
- ❌ Be "complete" by modern standards

---

## � Phase 7: Social System & Polish

### **Friend System (social.ts ~100 lines)**

**Friend Management:**
- Add friends (must be online)
- Remove friends
- List friends with online/offline status

**Friend Functions:**
```typescript
export function addFriend(player: Player, username: string): void {
  // Can't befriend yourself
  if (username.toLowerCase() === player.username.toLowerCase()) {
    return send(player, "You can't befriend yourself!");
  }
  
  // Check if already friends
  if (player.friends.includes(username)) {
    return send(player, `${username} is already your friend.`);
  }
  
  // Check if player exists (must be online)
  const target = gameState.players.get(username);
  if (!target) {
    return send(player, 'Player not found. They must be online to add as friend.');
  }
  
  // Add friend
  player.friends.push(username);
  send(player, `You are now friends with ${username}.`, 'success');
  send(target, `${player.username} has added you as a friend.`, 'info');
}

export function removeFriend(player: Player, username: string): void {
  const index = player.friends.indexOf(username);
  if (index === -1) {
    return send(player, `${username} is not your friend.`);
  }
  
  player.friends.splice(index, 1);
  send(player, `${username} has been removed from your friends list.`, 'success');
}

export function listFriends(player: Player): void {
  if (player.friends.length === 0) {
    return send(player, 'You have no friends yet. Use "friend add <name>" to add friends.');
  }
  
  let message = '\n=== Friends ===\n';
  
  player.friends.forEach(username => {
    const friend = gameState.players.get(username);
    const status = friend?.socket ? '[Online]' : '[Offline]';
    message += `  ${username} ${status}\n`;
  });
  
  message += `\nTotal: ${player.friends.length} friend(s)\n`;
  send(player, message);
}

export function handleFriendCommand(player: Player, args: string[]): void {
  if (args.length === 0) {
    listFriends(player);
    return;
  }
  
  const subcommand = args[0].toLowerCase();
  const username = args[1];
  
  switch (subcommand) {
    case 'add':
      if (!username) return send(player, 'Add who? Usage: friend add <name>');
      addFriend(player, username);
      break;
      
    case 'remove':
    case 'delete':
      if (!username) return send(player, 'Remove who? Usage: friend remove <name>');
      removeFriend(player, username);
      break;
      
    case 'list':
      listFriends(player);
      break;
      
    default:
      send(player, 'Usage: friend [list|add <name>|remove <name>]');
  }
}
```

### **Enhanced Social Commands**

**Already Implemented in messaging.ts:**
- `whisper(from, to, message)` - Private messages
- `reply(player, message)` - Reply to last whisper
- `say(player, message)` - Room broadcast

**New Command Handlers in server.ts:**
```typescript
case 'whisper':
case 'tell':
case 'w':
  if (args.length < 2) {
    send(player, 'Whisper what? Usage: whisper <player> <message>');
  } else {
    whisper(player, args[0], args.slice(1).join(' '));
  }
  break;

case 'reply':
case 'r':
  if (args.length === 0) {
    send(player, 'Reply what?');
  } else {
    reply(player, args.join(' '));
  }
  break;

case 'friend':
case 'friends':
case 'f':
  handleFriendCommand(player, args);
  break;
```

### **Command Shortcuts Summary**

**Movement:**
- `n` → north
- `s` → south
- `e` → east
- `w` → west
- `u` → up
- `d` → down

**Items:**
- `i` → inventory
- `eq` → equipment
- `m` → materials
- `x` → examine

**Combat:**
- `k` → attack
- `fl` → flee

**Social:**
- `w` → whisper
- `r` → reply
- `f` → friend

**Other:**
- `q` → quests
- `l` → look

### **Help System**

Comprehensive help command showing all available commands organized by category:
- Movement
- Combat
- Items & Equipment
- Quests
- Crafting
- Shop
- NPCs
- Information
- Social

### **Error Handling & Validation**

**Already implemented throughout:**
- Input validation (empty commands, missing args)
- Entity existence checks (items, enemies, NPCs)
- State validation (combat state, quest progress)
- Permission checks (level requirements, quest prerequisites)
- Resource validation (inventory space, gold, materials)

---

## 📝 Implementation Order

**It does NOT need to:**
- ❌ Compete with modern MMOs
- ❌ Have every feature
- ❌ Be "complete" by modern standards

---

## �📝 Implementation Order

### Phase 1: Core Infrastructure (~500 lines)
1. Server setup + Socket.IO
2. TypeScript types (all interfaces)
3. Typed messaging system (9 message types)
4. Player auth/storage (bcrypt passwords)
5. JSON folder scanner & loader (reads all data/ subdirectories)
6. Game state management

### Phase 2: Movement & Combat (~400 lines)
7. 6-direction movement system
8. Flee command (combat-only, 50% success)
9. Shared enemy combat
10. Enemy respawn system
11. XP & leveling (configurable progression)
12. Death/respawn

### Phase 3: Items & Equipment (~300 lines)
13. 4-stat item system (health/mana/damage/defense)
14. Equipment (weapon/armor/shield/accessory)
15. Consumables (potions & scrolls)
16. Mana cost system (no cooldowns!)
17. Drop/get commands

### Phase 4: Economy & NPCs (~350 lines)
18. Shop system (buy/sell)
19. NPC dialogue system
20. Quest givers
21. Healer NPCs (paid healing/mana)
22. Portal masters (fast travel)
23. Direct give command

### Phase 5: Quests & Progression (~256 lines)
24. Quest system (kill/collect/visit)
25. Quest items (separate from inventory)
26. Quest dialogue system (dialogue + completionDialogue + questDialogue)
27. Quest chains (requiresQuest + levelRequirement)
28. Quest completion rewards (gold + XP + level up)
29. Materials command (view collected crafting materials)
30. Quest-NPC auto-linking (data loader enrichment)
31. Data validation (fail-fast on invalid references)

### Phase 6: Crafting & Materials (~293 lines)
32. Materials system (separate data type with rarity)
33. Material harvesting (per-player nodes with cooldowns)
34. Material drops from enemies (chance-based, on death)
35. Materials storage (separate from inventory, unlimited)
36. Recipe items (find & learn)
37. Recipe learning system (use command)
38. Crafting system - Items (consume materials, create items)
39. Crafting system - Materials (process raw into refined materials)
40. Multi-stage crafting (raw → refined → equipment)

### Phase 7: Social & Polish (~100 lines) ✅ COMPLETE
41. Say/whisper/reply commands ✅
42. Friend system ✅
43. Who command ✅
44. Command shortcuts (n/s/e/w/i/eq/w/r/f) ✅
45. Help system ✅
46. Error handling & validation ✅

### Phase 8: Admin (~100 lines)
47. Admin commands (optional)

---

*This is a living document - pure traditional MUD design with zero legacy bloat.*

**Last Updated:** October 4, 2025  
**Status:** Phase 7 Complete - Social System & Polish Fully Implemented! Friend system, whisper/reply commands, all shortcuts active!
