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
  
  // Success chance from config (default 0.5 = 50%)
  const fleeChance = config.gameplay.fleeSuccessChance;
  if (Math.random() > fleeChance) {
    return send(player, "You failed to flee!", 'error');
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
  const damage = Math.max(1, playerDamage - enemy.defense);
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
  const enemyDamage = Math.max(1, enemy.damage - playerDefense);
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
  type: 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'recipe';
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
  "type": "weapon",
  "value": 50,
  "damage": 12
}

{
  "id": "wizard_robe",
  "type": "armor",
  "value": 80,
  "defense": 5,
  "mana": 20  // +20 max mana bonus
}

{
  "id": "health_potion",
  "type": "consumable",
  "value": 20,
  "health": 50  // Heals 50 HP
}

{
  "id": "mana_potion",
  "type": "consumable", 
  "value": 25,
  "mana": 30  // Restores 30 mana
}

{
  "id": "fireball_scroll",
  "type": "consumable",
  "value": 40,
  "damage": 30,
  "manaCost": 15  // Costs 15 mana to use
}

{
  "id": "jade_amulet",
  "type": "accessory",
  "value": 120,
  "health": 15  // +15 max HP (accessory can have any stat!)
}

{
  "id": "recipe_iron_sword",
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
    
    send(player, `You use ${item.name}! ${enemy.name} takes ${item.damage} damage!`, 'combat');
    send(player, `(-${item.manaCost} mana)`, 'info');
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
    
    send(player, `You use ${item.name} and are teleported!`, 'success');
    send(player, `(-${item.manaCost} mana)`, 'info');
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
  
const totalDefense = player.defense 
  + (player.equipped.armor?.defense || 0) 
  + (player.equipped.shield?.defense || 0)
  + (player.equipped.accessory?.defense || 0);
  
const maxHealth = player.maxHealth + (player.equipped.accessory?.health || 0);
const maxMana = player.maxMana + (player.equipped.accessory?.mana || 0);
```

**Why accessorys are valuable:**
- Can roll ANY of the 4 stats (health/mana/damage/defense)
- Adds build variety and loot excitement
- Traditional MUD accessory slot

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
  "type": "kill",
  "target": "goblin",
  "count": 5,
  "npc": "guard",
  "dialogue": "Kill 5 goblins for me.",
  "reward": { "gold": 100, "xp": 75 }
}
```

**2. Collect Quests (Quest Items System):**
```json
{
  "id": "wolf_pelts",
  "type": "collect",
  "target": "wolf",
  "count": 3,
  "itemDrop": "wolf_pelt",
  "npc": "tanner",
  "dialogue": "Bring me 3 wolf pelts.",
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
  "id": "find_daughter",
  "type": "visit",
  "target": "daughter_npc",
  "npc": "farmer",
  "dialogue": "Find my daughter in the forest!",
  "reward": { "gold": 50, "xp": 50 }
}
```

### **Quest Chains (Simple Dialogue-State)**

**NO prerequisite arrays!** Use NPC dialogue checks:

```typescript
// Farmer NPC
{
  "id": "farmer",
  "dialogue": "My daughter is missing!",
  "quest": "find_daughter"
}

// Daughter NPC - only offers quest if player completed previous
{
  "id": "daughter", 
  "defaultDialogue": "Who are you?",  // No quest
  "questDialogue": "Tell father I'm safe!",  // After find_daughter complete
  "quest": "return_to_father",
  "requiresQuest": "find_daughter"  // Simple check
}

// In code
function getQuest(npc: NPC, player: Player): Quest | null {
  if (npc.requiresQuest && !player.completed.includes(npc.requiresQuest)) {
    return null;  // Not ready yet
  }
  return npc.quest;
}
```

**Code (~120 lines total):**
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
  "dialogue": "Welcome to my shop!",
  "quest": "goblin_problem",
  "shop": "weapon_shop"
}
```

**NO random dialogue arrays** - NPCs say same thing every time

**NPC Types:**
- Regular - Just dialogue
- Quest Giver - Offers quest
- Shop - Has shop inventory
- Healer - Paid healing/mana recovery (money sink)

**Talk Command:**
```
talk blacksmith
> Gareth the Smith: "Welcome to my shop!"
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
    }
  }
}
```

---

## 🔄 Trading & Item Transfer

### **Direct Give Command (Traditional)**

**NO trade windows!** Use social trust:

```
give iron sword bob     → Transfer item to Bob
give 50 gold bob        → Transfer gold to Bob
```

**Code (~25 lines):**
```typescript
export function give(player: Player, itemName: string, targetName: string): void {
  const target = findPlayer(location, targetName);
  
  if (itemName === 'gold') {
    const amount = parseInt(targetName); // "give 50 gold bob" 
    player.gold -= amount;
    target.gold += amount;
    send(player, `You give ${amount} gold to ${target.name}.`);
    send(target, `${player.name} gives you ${amount} gold.`);
    return;
  }
  
  const item = findItem(player.inventory, itemName);
  player.inventory.remove(item);
  target.inventory.push(item);
  
  send(player, `You give ${item.name} to ${target.name}.`);
  send(target, `${player.name} gives you ${item.name}.`);
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
> [City of Midgaard]
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

[Town Square]
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

[Iron Mine]
A dark mine filled with iron deposits.

Exits:
  - out: mountain_path

Resources:
  - Iron Ore (ready to harvest!)
  
> harvest
You harvest 2x Iron Ore!

> look

[Iron Mine]
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
  
  send(player, `\n[${location.name}]`, 'info');
  send(player, location.description, 'info');
  
  // Exits
  if (Object.keys(location.exits).length > 0) {
    send(player, '\nExits:', 'info');
    for (const [dir, dest] of Object.entries(location.exits)) {
      send(player, `  - ${dir}: ${dest}`, 'info');
    }
  }
  
  // Resources (with cooldown status per material)
  if (location.resources && location.resources.length > 0) {
    send(player, '\nResources:', 'info');
    for (const node of location.resources) {
      const material = gameState.materials.get(node.materialId);
      const cooldownKey = `${location.id}_${node.materialId}`;
      const lastHarvest = player.lastHarvest[cooldownKey] || 0;
      const now = Date.now();
      const timeLeft = node.cooldown - (now - lastHarvest);
      
      if (timeLeft <= 0) {
        send(player, `  - ${material.name} (ready to harvest!)`, 'success');
      } else {
        const mins = Math.ceil(timeLeft / 60000);
        send(player, `  - ${material.name} (available in ${mins} minutes)`, 'info');
      }
    }
  }
  
  // People (NPCs first, then players)
  const npcs = location.npcs || [];
  const players = getPlayersInLocation(location.id).filter(p => p.id !== player.id);
  if (npcs.length > 0 || players.length > 0) {
    send(player, '\nPeople:', 'info');
    const names = [...npcs.map(n => n.name), ...players.map(p => p.name)];
    send(player, `  - ${names.join(', ')}`, 'info');
  }
  
  // Enemies
  if (location.enemies && location.enemies.length > 0) {
    send(player, '\nEnemies:', 'info');
    send(player, `  - ${location.enemies.map(e => e.name).join(', ')}`, 'error');
  }
  
  // Items on ground
  if (location.items && location.items.length > 0) {
    send(player, '\nItems:', 'info');
    send(player, `  - ${location.items.map(i => i.name).join(', ')}`, 'info');
  }
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
    "deathRespawnLocation": "town_square"
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

**Economy Balance:**
- `shopBuyMultiplier` (1.2): Players pay 120% of item value
- `shopSellMultiplier` (0.5): Players get 50% of item value
- `healerCostFactor` (50): Healing costs 0.5 gold per HP/mana (50/100)

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
  "teachesRecipe": "iron_sword"
}
```

**Recipe Data:**
```json
// data/recipes/iron_sword.json
{
  "id": "iron_sword",
  "name": "Iron Sword Recipe",
  "result": "iron_sword",           // Item ID from items/ folder
  "materials": {                      // Material IDs from materials/ folder
    "iron_ore": 3,
    "coal": 1
  },
  "requiredLevel": 5
}
```

**Recipe Interface:**
```typescript
interface Recipe {
  id: string;
  name: string;
  result: string;                    // Item ID to create
  materials: { [materialId: string]: number };  // Material requirements
  requiredLevel: number;  // The level required to learn this recipe
}
```

**How It Works:**

1. **Find recipe** (drop from enemies/chests/NPCs)
2. **Learn recipe** (`use recipe: iron sword`)
3. **View recipes** (`recipes` command)
4. **Examine recipe** (`examine iron_sword` - see requirements)
5. **Craft item** (`craft iron sword` - if materials available)

**Command Flow:**
```
> use recipe: iron sword
You learn how to craft: Iron Sword!

> recipes
Known Recipes:
  - Iron Sword (Level 5)
  - Health Potion (Level 1)
  
> examine iron_sword
Recipe: Iron Sword
Required Level: 5
Materials:
  - Iron Ore x3
  - Coal x1
Result: Iron Sword (+15 damage)

> craft iron sword
You craft an Iron Sword!
Materials consumed: 3x Iron Ore, 1x Coal
```

**Material Storage:**
- Materials stored in `player.materials` (separate from inventory!)
- Harvested from resource nodes OR dropped from enemies
- Unlimited storage (don't take inventory space)
- Example: `{ iron_ore: 5, coal: 2, copper_ore: 8 }`

**Code (~100 lines total):**

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
  send(player, `Recipe: ${recipe.name}`);
  send(player, `Required Level: ${recipe.requiredLevel}`);
  send(player, "Materials:");
  
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    const material = gameState.materials.get(materialId);
    const has = player.materials[materialId] || 0;
    send(player, `  - ${material.name} x${amount} (you have: ${has})`);
  }
  
  const resultItem = gameState.items.get(recipe.result);
  send(player, `Result: ${resultItem.name}`);
}

// Craft item
export function craft(player: Player, recipeId: string): void {
  if (!player.knownRecipes.includes(recipeId)) {
    return send(player, "You don't know that recipe.");
  }
  
  const recipe = gameState.recipes.get(recipeId);
  
  if (player.level < recipe.requiredLevel) {
    return send(player, "Your level is too low to craft this.");
  }
  
  // Check materials
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    const material = gameState.materials.get(materialId);
    if ((player.materials[materialId] || 0) < amount) {
      return send(player, `You need ${amount}x ${material.name}.`);
    }
  }
  
  // Check inventory space
  if (player.inventory.length >= config.gameplay.maxInventorySlots) {
    return send(player, "Your inventory is full!");
  }
  
  // Consume materials
  for (const [materialId, amount] of Object.entries(recipe.materials)) {
    player.materials[materialId] -= amount;
  }
  
  // Create item
  const item = gameState.items.get(recipe.result);
  player.inventory.push({ ...item });
  
  send(player, `You craft ${item.name}!`);
  const materialsUsed = Object.entries(recipe.materials)
    .map(([matId, amt]) => {
      const mat = gameState.materials.get(matId);
      return `${amt}x ${mat.name}`;
    })
    .join(", ");
  send(player, `Materials consumed: ${materialsUsed}`);
}
```

**Benefits:**
- ✅ Traditional MUD pattern (find recipes as loot)
- ✅ Recipes become valuable tradeable items
- ✅ Encourages exploration (find recipes)
- ✅ Clear separation: materials array (not questItems)
- ✅ Simple examine/craft/recipes/materials commands
- ✅ ~100 lines total (4 functions)

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

---

## � Infrastructure & Messaging

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
├── quests.ts         # Quest system (~120 lines)
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

## 📝 Implementation Order

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

### Phase 5: Quests & Progression (~250 lines)
24. Quest system (kill/collect/visit)
25. Quest items (separate from inventory)
26. Quest chains (simple dialogue-state)
27. Quest completion rewards

### Phase 6: Crafting & Materials (~250 lines)
28. Materials system (separate data type with rarity)
29. Material harvesting (per-player nodes with cooldowns)
30. Material drops from enemies (chance-based, on death)
31. Materials storage (separate from inventory, unlimited)
32. Recipe items (find & learn)
33. Recipe learning system
34. Crafting system (consume materials, create items)

### Phase 7: Social & Polish (~300 lines)
33. Say/whisper/reply commands
34. Friend system
35. Who command
36. Command shortcuts (n/s/e/w/i/eq/w/r/f)
37. Help system
38. Error handling & validation

### Phase 8: Configuration & Admin (~100 lines)
39. Config.json loader
40. Starting player setup
41. XP progression calculator
42. Admin commands (optional)

**Total: ~2,450 lines** (with materials system)

---

*This is a living document - pure traditional MUD design with zero legacy bloat.*

**Last Updated:** October 3, 2025  
**Status:** Clean Slate Design - Ready to Build
