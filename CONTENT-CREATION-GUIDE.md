# Mudden MUD - Content Creation Guide

**Welcome, Content Creator!** This guide will teach you how to create all types of game content for Mudden MUD. All content is stored as individual JSON files in the `data/` folder.

---

## 📂 File Structure Overview

```
data/
├── config.json        # Global game settings
├── locations/         # One JSON file per location
├── items/             # One JSON file per item
├── enemies/           # One JSON file per enemy type
├── npcs/              # One JSON file per NPC
├── quests/            # One JSON file per quest
├── shops/             # One JSON file per shop
├── recipes/           # One JSON file per crafting recipe
└── materials/         # One JSON file per crafting material
```

**Important:** 
- Every file name must match the `id` field inside (e.g., `town_square.json` has `"id": "town_square"`)
- Use `snake_case` for all IDs (lowercase with underscores)
- All references between files use IDs only

---

## 🗺️ Creating Locations

**File:** `data/locations/your_location_id.json`

### Basic Location Template

```json
{
  "id": "forest_clearing",
  "name": "Forest Clearing",
  "description": "A peaceful clearing in the forest. Sunlight streams through the trees, illuminating wildflowers swaying in the breeze.",
  "exits": {
    "north": "deep_forest",
    "south": "forest_path",
    "east": "river_bank"
  }
}
```

### Location with Everything

```json
{
  "id": "town_square",
  "name": "Town Square",
  "description": "You stand in the bustling town square. Merchants hawk their wares while adventurers prepare for their journeys.",
  "exits": {
    "north": "temple",
    "south": "gates",
    "east": "market",
    "west": "tavern",
    "down": "iron_mine"
  },
  "npcs": ["blacksmith", "town_guard"],
  "enemies": ["goblin"],
  "shop": "weapon_shop",
  "items": ["health_potion", "mana_potion"],
  "resources": [
    {
      "materialId": "iron_ore",
      "amount": "1-3",
      "cooldown": 180000,
      "chance": 0.8
    }
  ]
}
```

### Fields Explained

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ Yes | string | Unique location ID (snake_case) |
| `name` | ✅ Yes | string | Display name (shown to players) |
| `description` | ✅ Yes | string | What players see when they look |
| `exits` | ✅ Yes | object | Connections to other locations |
| `npcs` | ❌ No | array | NPC IDs present in this location |
| `enemies` | ❌ No | array | Enemy IDs that spawn here |
| `shop` | ❌ No | string | Shop ID (if location has a shop) |
| `items` | ❌ No | array | Item IDs on the ground |
| `resources` | ❌ No | array | Harvestable materials (see below) |

### Exit Directions
Valid directions: `north`, `south`, `east`, `west`, `up`, `down`

**Important:** Connections should be bidirectional! If location A has `"north": "location_b"`, then location B should have `"south": "location_a"`.

### Resource Nodes

Resource nodes allow players to harvest materials:

```json
"resources": [
  {
    "materialId": "iron_ore",
    "amount": "1-3",
    "cooldown": 180000,
    "chance": 0.8
  }
]
```

- `materialId`: Material ID from `data/materials/`
- `amount`: String format `"min-max"` (e.g., `"1-3"` gives 1-3 materials per harvest)
- `cooldown`: Milliseconds before player can harvest again (180000 = 3 minutes)
- `chance`: Probability of success (0.0-1.0, where 0.8 = 80% chance)

---

## ⚔️ Creating Items

**File:** `data/items/your_item_id.json`

### Item Types

Mudden has 3 item types: `equipment`, `consumable`, `recipe`

### 1. Equipment Items

Equipment can be equipped in one of 4 slots: `weapon`, `armor`, `shield`, `accessory`

#### Weapon Example
```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "description": "A well-crafted iron blade.",
  "type": "equipment",
  "slot": "weapon",
  "damage": 8,
  "value": 100
}
```

#### Armor Example
```json
{
  "id": "leather_armor",
  "name": "Leather Armor",
  "description": "Sturdy leather armor that provides good protection.",
  "type": "equipment",
  "slot": "armor",
  "defense": 5,
  "value": 80
}
```

#### Shield Example
```json
{
  "id": "wooden_shield",
  "name": "Wooden Shield",
  "description": "A simple wooden shield.",
  "type": "equipment",
  "slot": "shield",
  "defense": 3,
  "value": 40
}
```

#### Accessory Example (Can Have Any Stat!)
```json
{
  "id": "ruby_ring",
  "name": "Ruby Ring",
  "description": "A magical ring that enhances combat prowess.",
  "type": "equipment",
  "slot": "accessory",
  "damage": 3,
  "defense": 2,
  "health": 20,
  "mana": 10,
  "value": 200
}
```

**Equipment Stats:**
- `damage`: Increases attack power
- `defense`: Reduces damage taken
- `health`: Increases max HP
- `mana`: Increases max mana
- **Accessories are special:** They can have any combination of the 4 stats!

### 2. Consumable Items

Consumables have 2 sub-types: `potion`, `scroll`

#### Health Potion
```json
{
  "id": "health_potion",
  "name": "Health Potion",
  "description": "A small red vial that restores 50 health.",
  "type": "consumable",
  "subType": "potion",
  "healAmount": 50,
  "useSituation": "anytime",
  "value": 25
}
```

#### Mana Potion
```json
{
  "id": "mana_potion",
  "name": "Mana Potion",
  "description": "A blue potion that restores 30 mana.",
  "type": "consumable",
  "subType": "potion",
  "manaAmount": 30,
  "useSituation": "anytime",
  "value": 20
}
```

#### Combat Scroll (Attack)
```json
{
  "id": "fireball_scroll",
  "name": "Fireball Scroll",
  "description": "A magical scroll that unleashes a devastating fireball.",
  "type": "consumable",
  "subType": "scroll",
  "damage": 25,
  "manaCost": 15,
  "useSituation": "combat",
  "value": 75
}
```

#### Utility Scroll (Teleport)
```json
{
  "id": "teleport_scroll",
  "name": "Teleport Scroll",
  "description": "A magical scroll that teleports you to town square.",
  "type": "consumable",
  "subType": "scroll",
  "teleportTo": "town_square",
  "useSituation": "peaceful",
  "value": 100
}
```

**Usage Situations:**
- `anytime`: Can use during combat or in peaceful areas (potions)
- `combat`: Can only use while fighting (attack scrolls)
- `peaceful`: Can only use outside combat (teleport scrolls)

### 3. Recipe Items

Recipe items teach players how to craft. Players use them once with the `use` command.

**Note:** This is an **item** (stored in `data/items/`), NOT a recipe file. Recipe files are stored in `data/recipes/`.

```json
{
  "id": "recipe_iron_sword",
  "name": "Recipe: Iron Sword",
  "description": "Instructions for forging an iron sword.",
  "type": "recipe",
  "teachesRecipe": "iron_sword_recipe",
  "value": 50
}
```

**Recipe Item Fields:**
- `type`: Must be `"recipe"`
- `teachesRecipe`: ID of the recipe file in `data/recipes/` (e.g., `"iron_sword_recipe"`)
- `value`: Gold value for buying/selling
- Standard item fields: `id`, `name`, `description`

---

## 👹 Creating Enemies

**File:** `data/enemies/your_enemy_id.json`

### Basic Enemy
```json
{
  "id": "goblin",
  "name": "Goblin Scout",
  "description": "A small, green-skinned goblin wielding a crude dagger.",
  "health": 50,
  "maxHealth": 50,
  "damage": 8,
  "defense": 2,
  "gold": 15,
  "xp": 20,
  "fighters": []
}
```

### Enemy with Material Drops
```json
{
  "id": "wolf",
  "name": "Gray Wolf",
  "description": "A fierce wolf with matted gray fur and sharp fangs.",
  "health": 60,
  "maxHealth": 60,
  "damage": 10,
  "defense": 3,
  "gold": 20,
  "xp": 25,
  "materialDrops": {
    "wolf_pelt": {
      "chance": 0.5,
      "amount": "1-2"
    },
    "wolf_tooth": {
      "chance": 0.3,
      "amount": "1-1"
    }
  },
  "fighters": []
}
```

### Fields Explained

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ Yes | string | Unique enemy ID |
| `name` | ✅ Yes | string | Display name |
| `description` | ✅ Yes | string | What players see when examining |
| `health` | ✅ Yes | number | Starting HP (should match maxHealth) |
| `maxHealth` | ✅ Yes | number | Maximum HP |
| `damage` | ✅ Yes | number | Base damage dealt |
| `defense` | ✅ Yes | number | Damage reduction |
| `gold` | ✅ Yes | number | Gold dropped when killed |
| `xp` | ✅ Yes | number | Experience points awarded |
| `materialDrops` | ❌ No | object | Materials that can drop (see below) |
| `itemDrops` | ❌ No | object | Items that can drop (see below) |
| `fighters` | ✅ Yes | array | **Always empty array `[]`** (managed at runtime) |

### Material Drops

```json
"materialDrops": {
  "material_id": {
    "chance": 0.5,
    "amount": "1-2"
  }
}
```

- `chance`: Drop probability (0.0-1.0, where 0.5 = 50%)
- `amount`: String format `"min-max"`

### Item Drops

```json
"itemDrops": {
  "item_id": {
    "chance": 0.1
  }
}
```

- `chance`: Drop probability (0.0-1.0, where 0.1 = 10%)
- Each fighter rolls independently for item drops
- If inventory is full, item drops to the ground

**Enemy Respawning:** Enemies automatically respawn after being killed. Respawn time is set in `config.json` → `gameplay.enemyRespawnTime` (in milliseconds).

---

## 🧙 Creating NPCs

**File:** `data/npcs/your_npc_id.json`

### Basic NPC (Just Dialogue)
```json
{
  "id": "blacksmith",
  "name": "Gareth the Smith",
  "dialogue": "Welcome to my forge! I craft the finest weapons and armor in the realm."
}
```

### NPC with Quest
```json
{
  "id": "town_guard",
  "name": "Captain Aldric",
  "dialogue": "Stay alert, citizen. Dangerous creatures roam these lands.",
  "quest": "goblin_problem"
}
```

When a player talks to this NPC:
- If they haven't started the quest → Shows quest dialogue and offers to accept
- If quest is active → Shows progress
- If quest is complete → Allows turn-in for rewards

### NPC with Quest Dialogue
```json
{
  "id": "hermit",
  "name": "Old Hermit",
  "dialogue": "Leave me alone! I came out here for peace and quiet.",
  "questDialogue": "Ah, the innkeeper sent you? Tell him I'm doing just fine out here."
}
```

- `questDialogue`: Special dialogue shown when player has an active visit quest targeting this NPC

### Healer NPC
```json
{
  "id": "priest",
  "name": "Father Marcus",
  "dialogue": "I can heal your wounds for a donation. May the light guide you.",
  "healer": true
}
```

When a player talks to a healer:
- Shows current HP
- Calculates healing cost based on missing health
- Heals player to full HP if they pay

**Healing Cost Formula:** `missingHealth * config.economy.healerCostFactor`

### Portal Master NPC
```json
{
  "id": "portal_master",
  "name": "Portal Master Zephyr",
  "dialogue": "I can transport you to distant locations. Just say the name of where you wish to go.",
  "portals": {
    "town": {
      "destination": "town_square",
      "cost": 50
    },
    "gates": {
      "destination": "gates",
      "cost": 30
    },
    "temple": {
      "destination": "temple",
      "cost": 40
    }
  }
}
```

Players use: `say town` (or any portal keyword) to teleport.

### Fields Explained

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ Yes | string | Unique NPC ID |
| `name` | ✅ Yes | string | Display name |
| `dialogue` | ✅ Yes | string | Default conversation text |
| `questDialogue` | ❌ No | string | Special text for visit quests |
| `quest` | ❌ No | string | Quest ID this NPC offers |
| `healer` | ❌ No | boolean | Set to `true` for healing NPCs |
| `portals` | ❌ No | object | Portal destinations (see above) |

---

## 📜 Creating Quests

**File:** `data/quests/your_quest_id.json`

Mudden supports 3 quest types: `kill`, `collect`, `visit`

### 1. Kill Quest

Kill N enemies of a specific type.

```json
{
  "id": "goblin_problem",
  "name": "Goblin Problem",
  "type": "kill",
  "target": "goblin",
  "count": 5,
  "dialogue": "Those goblins have been terrorizing travelers! Kill 5 of them and I'll reward you.",
  "completionDialogue": "Excellent work! The roads are safer now thanks to you.",
  "reward": {
    "gold": 100,
    "xp": 75
  }
}
```

### 2. Collect Quest

Collect quest items by killing specific enemies. The quest tracks materials dropped from enemies.

```json
{
  "id": "wolf_pelts",
  "name": "Wolf Pelts",
  "type": "collect",
  "target": "wolf",
  "count": 3,
  "materialDrop": "wolf_pelt",
  "dialogue": "I need wolf pelts for my leather work. Bring me 3 and I'll pay you well.",
  "completionDialogue": "Perfect pelts! These will make fine leather. Here's your payment.",
  "reward": {
    "gold": 150,
    "xp": 100
  }
}
```

**How it works:**
- `target`: The **enemy ID** to kill (e.g., `"wolf"`)
- `materialDrop`: The **material ID** that the quest tracks (e.g., `"wolf_pelt"`)
- When the player kills the target enemy, the quest automatically increments the counter
- The system displays progress using the material's display name
- Quest items are tracked separately and don't use inventory space
- Quest items are automatically removed when the quest is completed

**Important:** The `materialDrop` field references a **material**, not a separate quest item! The material should exist in `data/materials/` and the enemy should drop it via `materialDrops`.

### 3. Visit Quest

Talk to a specific NPC.

```json
{
  "id": "find_hermit",
  "name": "Find the Hermit",
  "type": "visit",
  "target": "hermit",
  "count": 1,
  "dialogue": "A hermit lives deep in the forest. Find him and tell me what he says.",
  "completionDialogue": "Ah, good to know he's doing well out there. Here, have a drink on the house!",
  "reward": {
    "gold": 50,
    "xp": 50
  }
}
```

**Important:** The target NPC should have `questDialogue` to make the interaction meaningful.

### Quest Prerequisites

Quests can require a minimum level or previous quest completion:

```json
{
  "id": "advanced_quest",
  "name": "Advanced Mission",
  "type": "kill",
  "target": "dragon",
  "count": 1,
  "requiredLevel": 10,
  "prerequisiteQuest": "goblin_problem",
  "dialogue": "Only seasoned adventurers can handle this challenge.",
  "completionDialogue": "You truly are a hero!",
  "reward": {
    "gold": 500,
    "xp": 1000
  }
}
```

- `requiredLevel`: Player must be at least this level
- `prerequisiteQuest`: Player must have completed this quest ID first

### Fields Explained

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ Yes | string | Unique quest ID |
| `name` | ✅ Yes | string | Quest display name |
| `type` | ✅ Yes | string | `kill`, `collect`, or `visit` |
| `target` | ✅ Yes | string | Enemy ID, item ID, or NPC ID |
| `count` | ✅ Yes | number | How many to kill/collect/visit |
| `dialogue` | ✅ Yes | string | Quest offer text |
| `completionDialogue` | ✅ Yes | string | Quest completion text |
| `reward` | ✅ Yes | object | `{gold: number, xp: number}` |
| `requiredLevel` | ❌ No | number | Minimum level to accept |
| `prerequisiteQuest` | ❌ No | string | Required completed quest ID |

---

## 🛍️ Creating Shops

**File:** `data/shops/your_shop_id.json`

Shops are simple - just a name and list of item IDs:

```json
{
  "id": "weapon_shop",
  "name": "The Rusty Blade",
  "items": ["rusty_sword", "iron_sword", "wooden_shield", "leather_armor"]
}
```

### Shop Pricing

Shops don't store prices! Prices are calculated from item `value` field:

- **Buy Price:** `item.value * config.economy.shopBuyMultiplier` (default: 1.2x = 20% markup)
- **Sell Price:** `item.value * config.economy.shopSellMultiplier` (default: 0.5x = half value)

**Example:**
- Iron Sword has `"value": 100`
- Players buy it for: 100 × 1.2 = **120 gold**
- Players sell it for: 100 × 0.5 = **50 gold**

### Shop Types

You can create themed shops:

```json
{
  "id": "general_store",
  "name": "General Store",
  "items": ["health_potion", "mana_potion", "teleport_scroll"]
}
```

```json
{
  "id": "magic_shop",
  "name": "The Arcane Emporium",
  "items": ["fireball_scroll", "ice_blast_scroll", "mana_potion"]
}
```

**Shops Buy Everything:** Any shop will buy any item from the player at the standard sell price.

---

## 🔨 Creating Crafting Materials

**File:** `data/materials/your_material_id.json`

Materials are simple resources used in crafting:

```json
{
  "id": "iron_ore",
  "name": "Iron Ore",
  "description": "A chunk of raw iron ore. Can be smelted and forged into weapons and armor.",
  "rarity": "common"
}
```

```json
{
  "id": "wolf_pelt",
  "name": "Wolf Pelt",
  "description": "A thick wolf pelt. Useful for making leather goods.",
  "rarity": "uncommon"
}
```

```json
{
  "id": "dragon_scale",
  "name": "Dragon Scale",
  "description": "An incredibly rare and valuable dragon scale. Could be used to craft legendary items.",
  "rarity": "legendary"
}
```

### Rarity Levels

Rarity is just for flavor (displayed to players):
- `common`
- `uncommon`
- `rare`
- `epic`
- `legendary`

### How Players Get Materials

**Two sources:**

1. **Harvesting resource nodes** (in locations)
2. **Enemy drops** (from killed enemies)

**Material Storage:** Materials don't use inventory space! They're stored separately and unlimited.

---

## 📋 Creating Recipes

**File:** `data/recipes/your_recipe_id.json`

Recipes allow players to craft items from materials.

### Craft an Item
```json
{
  "id": "iron_sword_recipe",
  "name": "Iron Sword Recipe",
  "result": "iron_sword",
  "resultType": "item",
  "materials": {
    "iron_ore": 3,
    "wolf_pelt": 1
  },
  "requiredLevel": 5
}
```

### Craft a Material (Smelting/Processing)
```json
{
  "id": "smelt_iron_bar",
  "name": "Smelt Iron Bar",
  "result": "iron_bar",
  "resultType": "material",
  "materials": {
    "iron_ore": 2
  },
  "requiredLevel": 3
}
```

### Fields Explained

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ Yes | string | Unique recipe ID |
| `name` | ✅ Yes | string | Display name |
| `result` | ✅ Yes | string | Item or material ID created |
| `resultType` | ✅ Yes | string | `item` or `material` |
| `materials` | ✅ Yes | object | `{material_id: quantity}` |
| `requiredLevel` | ❌ No | number | Minimum level to craft |

### How Players Learn Recipes

**Three ways:**

1. **Recipe Items:** Create a recipe item (type: `recipe`) that teaches the recipe when used
2. **Location Items:** Place recipe items on the ground in locations
3. **Shop Sales:** Sell recipe items in shops

**Example Flow:**
1. Create recipe: `data/recipes/iron_sword_recipe.json`
2. Create recipe item: `data/items/recipe_iron_sword.json` with `"teachesRecipe": "iron_sword_recipe"`
3. Place in world: Add `"recipe_iron_sword"` to location's `items` array
4. Player picks it up and uses it → learns recipe permanently

---

## ⚙️ Configuring config.json

**File:** `data/config.json`

The config file controls all game balance and mechanics.

### New Player Settings

```json
"newPlayer": {
  "startingLocation": "town_square",
  "startingLevel": 1,
  "startingGold": 50,
  "startingHealth": 100,
  "startingMana": 50,
  "startingDamage": 5,
  "startingDefense": 3,
  "startingEquipment": {
    "weapon": null,
    "armor": null,
    "shield": null,
    "accessory": null
  },
  "startingInventory": []
}
```

**Give new players items:**
```json
"startingInventory": ["health_potion", "rusty_sword"]
```

**Give new players equipment:**
```json
"startingEquipment": {
  "weapon": "rusty_sword",
  "armor": "cloth_shirt",
  "shield": null,
  "accessory": null
}
```

### Gameplay Settings

```json
"gameplay": {
  "maxInventorySlots": 16,
  "fleeSuccessChance": 0.5,
  "enemyRespawnTime": 30000,
  "deathGoldLossPct": 0.1,
  "deathRespawnLocation": "town_square",
  "damageVariance": 0.1
}
```

- `maxInventorySlots`: How many items players can carry (materials don't count)
- `fleeSuccessChance`: Probability of successful flee (0.5 = 50%)
- `enemyRespawnTime`: Milliseconds before dead enemies respawn (30000 = 30 seconds)
- `deathGoldLossPct`: Percentage of gold lost on death (0.1 = 10%)
- `deathRespawnLocation`: Where players respawn when they die
- `damageVariance`: Random damage variance (0.1 = ±10%)

### Progression Settings

```json
"progression": {
  "baseXpPerLevel": 100,
  "xpMultiplier": 1.5,
  "healthPerLevel": 10,
  "manaPerLevel": 5,
  "damagePerLevel": 2,
  "defensePerLevel": 1
}
```

**XP Required for Level N:**
```
XP = baseXpPerLevel * (xpMultiplier ^ (level - 1))
```

**Example:**
- Level 2: 100 × 1.5^1 = 150 XP
- Level 3: 100 × 1.5^2 = 225 XP
- Level 4: 100 × 1.5^3 = 337 XP

**Stats gained per level:**
- Health: +10 per level
- Mana: +5 per level
- Damage: +2 per level
- Defense: +1 per level

### Economy Settings

```json
"economy": {
  "shopBuyMultiplier": 1.2,
  "shopSellMultiplier": 0.5,
  "healerCostFactor": 50
}
```

- `shopBuyMultiplier`: Markup when buying from shops (1.2 = 20% more than base value)
- `shopSellMultiplier`: Markdown when selling to shops (0.5 = 50% of base value)
- `healerCostFactor`: Cost per HP healed (50 = 50 gold per HP)

**Healer Cost Example:**
- Player missing 20 HP
- Cost = 20 × 50 = **1,000 gold**

---

## 🔗 How Everything Connects

### Example: Simple Collect Quest

Let's create a collect quest where players gather wolf pelts:

#### Step 1: Create the Material
**File:** `data/materials/wolf_pelt.json`
```json
{
  "id": "wolf_pelt",
  "name": "Wolf Pelt",
  "description": "A thick wolf pelt. Useful for crafting leather goods.",
  "rarity": "common"
}
```

#### Step 2: Create the Enemy (with material drop)
**File:** `data/enemies/wolf.json`
```json
{
  "id": "wolf",
  "name": "Gray Wolf",
  "description": "A lean gray wolf with sharp fangs.",
  "health": 60,
  "maxHealth": 60,
  "damage": 12,
  "defense": 3,
  "gold": 10,
  "xp": 25,
  "materialDrops": {
    "wolf_pelt": {
      "chance": 0.6,
      "amount": "1-2"
    }
  },
  "fighters": []
}
```

#### Step 3: Create the Collect Quest
**File:** `data/quests/wolf_pelts.json`
```json
{
  "id": "wolf_pelts",
  "name": "Wolf Pelts",
  "type": "collect",
  "target": "wolf",
  "count": 3,
  "materialDrop": "wolf_pelt",
  "dialogue": "I need wolf pelts for my leather work. Bring me 3 and I'll pay you well.",
  "completionDialogue": "Perfect pelts! These will make fine leather. Here's your payment.",
  "reward": {
    "gold": 150,
    "xp": 100
  }
}
```

**Key Points:**
- `target` = enemy ID (`"wolf"`)
- `materialDrop` = material ID (`"wolf_pelt"`)
- The material MUST be in the enemy's `materialDrops`
- The quest tracks materials automatically when the player kills wolves
- No separate "quest item" needed!

#### Step 4: Create Quest-Giver NPC
**File:** `data/npcs/tanner.json`
```json
{
  "id": "tanner",
  "name": "Greta the Tanner",
  "dialogue": "I work with leather all day. Always need more pelts!",
  "quest": "wolf_pelts"
}
```

#### Step 5: Place in Location
Add the tanner to a location and wolves to another:

**File:** `data/locations/market.json`
```json
{
  "id": "market",
  "name": "Marketplace",
  "description": "A busy marketplace with various shops and traders.",
  "exits": {
    "west": "town_square"
  },
  "npcs": ["tanner"]
}
```

**File:** `data/locations/forest_path.json`
```json
{
  "id": "forest_path",
  "name": "Forest Path",
  "description": "A path through the forest where wolves roam.",
  "exits": {
    "north": "town_square"
  },
  "enemies": ["wolf"]
}
```

**Player Experience:**
1. Player talks to Greta → accepts "Wolf Pelts" quest
2. Player goes to forest and kills wolves
3. Wolves drop wolf pelts (60% chance, 1-2 per kill)
4. Quest automatically tracks: "Quest progress: 1/3 Wolf Pelt"
5. After collecting 3 pelts, return to Greta
6. Complete quest → receive 150 gold + 100 XP
7. Quest pelts are removed from tracking (player keeps any extras from material drops)

---

### Example: Complete Quest Chain

Let's create a complete quest where players:
1. Accept quest from NPC
2. Kill enemies
3. Enemies drop materials
4. Use materials to craft item
5. Return to NPC for reward

#### Step 1: Create the Enemy

**File:** `data/enemies/dire_wolf.json`
```json
{
  "id": "dire_wolf",
  "name": "Dire Wolf",
  "description": "A massive wolf with glowing red eyes.",
  "health": 80,
  "maxHealth": 80,
  "damage": 15,
  "defense": 5,
  "gold": 30,
  "xp": 40,
  "materialDrops": {
    "dire_wolf_pelt": {
      "chance": 0.7,
      "amount": "1-1"
    }
  },
  "fighters": []
}
```

#### Step 2: Create the Material

**File:** `data/materials/dire_wolf_pelt.json`
```json
{
  "id": "dire_wolf_pelt",
  "name": "Dire Wolf Pelt",
  "description": "An exceptionally thick pelt from a dire wolf.",
  "rarity": "rare"
}
```

#### Step 3: Create the Recipe

**File:** `data/recipes/dire_wolf_armor_recipe.json`
```json
{
  "id": "dire_wolf_armor_recipe",
  "name": "Dire Wolf Armor",
  "result": "dire_wolf_armor",
  "resultType": "item",
  "materials": {
    "dire_wolf_pelt": 3,
    "iron_bar": 2
  },
  "requiredLevel": 8
}
```

#### Step 4: Create the Armor

**File:** `data/items/dire_wolf_armor.json`
```json
{
  "id": "dire_wolf_armor",
  "name": "Dire Wolf Armor",
  "description": "Heavy armor crafted from dire wolf pelts. Provides excellent protection.",
  "type": "equipment",
  "slot": "armor",
  "defense": 12,
  "health": 30,
  "value": 300
}
```

#### Step 5: Create Recipe Item

**File:** `data/items/recipe_dire_wolf_armor.json`
```json
{
  "id": "recipe_dire_wolf_armor",
  "name": "Recipe: Dire Wolf Armor",
  "description": "Instructions for crafting armor from dire wolf pelts.",
  "type": "recipe",
  "teachesRecipe": "dire_wolf_armor_recipe",
  "value": 100
}
```

#### Step 6: Create the Quest

**File:** `data/quests/dire_wolf_hunt.json`
```json
{
  "id": "dire_wolf_hunt",
  "name": "Dire Wolf Hunt",
  "type": "kill",
  "target": "dire_wolf",
  "count": 5,
  "requiredLevel": 7,
  "dialogue": "Dire wolves have been attacking our hunters. Slay 5 of them and I'll teach you how to use their pelts.",
  "completionDialogue": "The forest is safer now! As promised, here's the recipe for dire wolf armor.",
  "reward": {
    "gold": 200,
    "xp": 150,
    "item": "recipe_dire_wolf_armor"
  }
}
```

**Note:** Quest rewards can include items! Just add `"item": "item_id"` to the reward object.

#### Step 7: Create the Quest-Giver NPC

**File:** `data/npcs/master_hunter.json`
```json
{
  "id": "master_hunter",
  "name": "Master Hunter Theron",
  "dialogue": "I've been hunting these lands for thirty years. Need something?",
  "quest": "dire_wolf_hunt"
}
```

#### Step 8: Create the Location

**File:** `data/locations/dark_forest.json`
```json
{
  "id": "dark_forest",
  "name": "Dark Forest",
  "description": "A foreboding forest where shadows move between the trees. The howling of wolves echoes in the distance.",
  "exits": {
    "south": "forest_path"
  },
  "npcs": ["master_hunter"],
  "enemies": ["dire_wolf"]
}
```

### The Player Experience

1. Player travels to Dark Forest
2. Talks to Master Hunter Theron → accepts quest "Dire Wolf Hunt"
3. Kills 5 Dire Wolves
4. Collects Dire Wolf Pelts (materials) from drops
5. Returns to Master Hunter → completes quest
6. Receives 200 gold, 150 XP, and Recipe: Dire Wolf Armor
7. Uses the recipe item → learns the recipe permanently
8. Harvests iron ore from mines
9. Smelts iron ore into iron bars (using another recipe)
10. Crafts Dire Wolf Armor (requires 3 pelts + 2 iron bars)
11. Equips the new armor!

---

## ✅ Content Validation

Before adding content, always validate it:

### Run the ID Validator

```bash
npm run validate-ids
```

This checks:
- All IDs are referenced correctly
- No missing items, enemies, NPCs, etc.
- No typos in IDs

### Run the Map Validator

```bash
npm run validate-map
```

This checks:
- All location exits connect properly
- No dead ends or unreachable areas
- Bidirectional connections work

### Common Mistakes

❌ **Wrong:** File name doesn't match ID
```
File: town.json
Content: { "id": "town_square", ... }
```

✅ **Correct:**
```
File: town_square.json
Content: { "id": "town_square", ... }
```

---

❌ **Wrong:** Using display name instead of ID
```json
{
  "exits": {
    "north": "Town Square"
  }
}
```

✅ **Correct:**
```json
{
  "exits": {
    "north": "town_square"
  }
}
```

---

❌ **Wrong:** One-way connection
```json
// Location A
{
  "id": "forest",
  "exits": { "north": "town" }
}

// Location B
{
  "id": "town",
  "exits": {}  // ← Missing "south": "forest"
}
```

✅ **Correct:**
```json
// Location A
{
  "id": "forest",
  "exits": { "north": "town" }
}

// Location B
{
  "id": "town",
  "exits": { "south": "forest" }
}
```

---

❌ **Wrong:** Material drops on enemy but material doesn't exist
```json
{
  "id": "dragon",
  "materialDrops": {
    "dragon_scale": { ... }  // ← No dragon_scale.json file!
  }
}
```

✅ **Correct:** Create `data/materials/dragon_scale.json` first!

---

## 🎨 Design Tips

### Balancing Combat

**Enemy Difficulty Formula:**
- Easy: Health = player_level × 10, Damage = player_level × 2
- Medium: Health = player_level × 15, Damage = player_level × 3
- Hard: Health = player_level × 20, Damage = player_level × 4
- Boss: Health = player_level × 50, Damage = player_level × 5

**Gold Rewards:**
- Easy: 10-20 gold
- Medium: 20-40 gold
- Hard: 40-80 gold
- Boss: 100-500 gold

**XP Rewards:**
- Easy: level × 10
- Medium: level × 15
- Hard: level × 25
- Boss: level × 100

### Balancing Equipment

**Value = Total Stats × 10**

Example:
- Iron Sword: 8 damage → value = 80
- Ruby Ring: 3 damage + 2 defense + 20 health + 10 mana = 35 total → value = 350

### Quest Rewards

**General guidelines:**
- Gold: 50-200 for normal quests, 500+ for major quests
- XP: Should be 1-2 enemy kills worth
- Items: Useful but not overpowered

### Material Drop Rates

- Common materials: 70-90% chance
- Uncommon materials: 40-60% chance
- Rare materials: 20-30% chance
- Epic materials: 10-15% chance
- Legendary materials: 5% or less

---

## 📚 Quick Reference

### Required Fields Checklist

#### Location
- ✅ id, name, description, exits

#### Item (Equipment)
- ✅ id, name, description, type, slot, value
- ✅ At least one stat (damage, defense, health, mana)

#### Item (Consumable)
- ✅ id, name, description, type, subType, value, useSituation
- ✅ Effect (healAmount, manaAmount, damage, or teleportTo)

#### Item (Recipe)
- ✅ id, name, description, type, teachesRecipe, value

#### Enemy
- ✅ id, name, description, health, maxHealth, damage, defense, gold, xp, fighters: []

#### NPC
- ✅ id, name, dialogue

#### Quest
- ✅ id, name, type, target, count, dialogue, completionDialogue, reward

#### Shop
- ✅ id, name, items

#### Material
- ✅ id, name, description, rarity

#### Recipe
- ✅ id, name, result, resultType, materials

---

## 🚀 Getting Started

### Your First Location

1. Copy an existing location file
2. Change the ID and name
3. Update the description
4. Add exits to neighboring locations
5. Update neighbor locations to exit back to yours
6. Run `npm run validate-map`

### Your First Quest

1. Identify the quest giver (existing or new NPC)
2. Create the quest file
3. Add `"quest": "your_quest_id"` to the NPC
4. Test by talking to the NPC in-game

### Your First Craftable Item

1. Create the materials needed
2. Create the recipe
3. Create the result item
4. Create a recipe item to teach it
5. Place the recipe item somewhere in the world
6. Test by finding, learning, gathering materials, and crafting

---

## 🎮 Testing Your Content

1. **Start the server:** `npm run dev`
2. **Connect via browser:** http://localhost:3000
3. **Create a test character**
4. **Test all interactions:**
   - Can you reach the location?
   - Can you talk to NPCs?
   - Can you accept quests?
   - Can enemies be killed?
   - Do materials drop?
   - Can you craft items?

5. **Check for errors in server console**

---

## 📖 Further Reading

- `DESIGN-DOCUMENT.md` - Complete game design philosophy
- `src/types.ts` - TypeScript interfaces for all data structures
- `tools/id-validator.ts` - How ID validation works
- `tools/map-validator.ts` - How map validation works

---

## 💡 Need Help?

If something isn't working:

1. Check server console for errors
2. Run validation tools (`npm run validate-ids`, `npm run validate-map`)
3. Compare your JSON to working examples in `data/`
4. Verify all IDs are in snake_case
5. Ensure file names match IDs exactly

**Happy Creating! 🎉**
