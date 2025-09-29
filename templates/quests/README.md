# Quest Files

This directory contains individual JSON files for each quest in the game. Quests provide structured objectives, rewards, and progression for players.

## File Structure

Each quest file should be named with the quest ID (e.g., `guard_forest_patrol.json`) and contain a complete quest definition.

## Quest Schema

Quest types and statuses are defined as constants in `lib/constants/QuestConstants.js` for consistency across the codebase.

Each quest file must contain the following structure:

```json
{
  "name": "Human-readable quest name",
  "description": "Brief description of the quest",
  "giver": "npc_id_who_gives_quest",
  "turnInNpc": "npc_id_who_receives_quest (optional, defaults to giver)",
  "type": "kill|collect|visit",
  "level": 1,
  "prerequisites": {
    "level": 1,
    "quests": ["previous_quest_id"],
    "items": ["required_item_id"]
  },
  "objectives": [
    {
      "type": "kill|collect|visit",
      "target": "target_id",
      "quantity": 1,
      "current": 0,
      "givenByQuestGiver": false,
      "description": "Human-readable objective description"
    }
  ],
  "rewards": {
    "experience": 50,
    "gold": 25,
    "items": ["reward_item_id"]
  },
  "dialogue": {
    "offer": "Initial quest offer text",
    "accept": "Text when player accepts",
    "decline": "Text when player declines",
    "progress": "Text during quest progress",
    "complete": "Text when quest is completed",
    "completed": "Text for already completed quest"
  },
  "status": "available|accepted|completed"
}
```

## Field Descriptions

### Basic Information
- **name**: Display name shown to players (ID is automatically derived from filename)
- **description**: Brief summary of what the quest involves
- **giver**: NPC ID who offers this quest (must exist in templates/npcs/)
- **turnInNpc**: (Optional) NPC ID who receives the completed quest. If not specified, defaults to the quest giver. Useful for delivery quests where you get the quest from one NPC but turn it in to another.
- **type**: Category of quest (kill, collect, or visit)
- **level**: Recommended player level
- **status**: Current quest state (managed by game system)

### Prerequisites
- **level**: Minimum player level required
- **quests**: Array of quest IDs that must be completed first
- **items**: Array of item IDs that player must possess

### Objectives
Each objective is an object with:
- **type**: What kind of action is required
- **target**: ID of the target (enemy, item, NPC, or location)
- **quantity**: How many are needed
- **current**: Current progress (managed by game system)
- **givenByQuestGiver**: (Optional) If true, this item is automatically given to the player when they accept the quest. Used for delivery-style quests.
- **description**: Human-readable description for players

### Rewards
- **experience**: XP points awarded
- **gold**: Gold pieces awarded
- **items**: Array of item IDs given as rewards

### Dialogue
- **offer**: What the NPC says when offering the quest
- **accept**: Response when player accepts
- **decline**: Response when player declines
- **progress**: What NPC says while quest is in progress
- **complete**: What NPC says when quest is turned in
- **completed**: What NPC says after quest is already finished

## Quest Turn-In System

Quests can be completed with different NPCs than who gave them:

### Same NPC (Default)
```json
{
  "giver": "town_guard",
  // turnInNpc not specified - defaults to "town_guard"
}
```

### Different NPC (Delivery Quests)
```json
{
  "giver": "innkeeper",
  "turnInNpc": "wizard",
  "objectives": [
    {
      "givenByQuestGiver": true,  // Innkeeper gives item when accepted
      "target": "special_ale"     // Player delivers to wizard
    }
  ]
}
```

## Quest Types

### Kill Quests
```json
{
  "type": "kill",
  "objectives": [
    {
      "type": "kill",
      "target": "wolf",
      "quantity": 3,
      "description": "Kill 3 Forest Wolves"
    }
  ]
}
```

### Collection Quests
```json
{
  "type": "collect",
  "objectives": [
    {
      "type": "collect",
      "target": "iron_ore",
      "quantity": 2,
      "description": "Collect 2 Iron Ore"
    }
  ]
}
```

### Delivery Quests
```json
{
  "type": "delivery",
  "objectives": [
    {
      "type": "deliver",
      "target": "wizard",
      "item": "special_ale",
      "quantity": 1,
      "description": "Deliver Special Ale to Wizard"
    }
  ]
}
```

### Quest Chaining
Quest chains are created using the `prerequisites.quests` field, not a separate "chain" type:

```json
{
  "name": "Advanced Smithing",
  "type": "collect", 
  "prerequisites": {
    "quests": ["blacksmith_first_weapon", "blacksmith_repair_tools"]
  },
  "objectives": [
    {
      "type": "collect",
      "target": "rare_ore",
      "quantity": 5,
      "description": "Collect 5 pieces of Rare Ore"
    }
  ]
}
```

### Visit/Exploration Quests
Exploration quests use visit objectives to encourage world discovery:

```json
{
  "type": "collect",
  "objectives": [
    {
      "type": "visit",
      "target": "deep_forest",
      "quantity": 1,
      "description": "Explore the Deep Forest"
    }
  ]
}
```

## Objective Types

### Kill Objectives
- **target**: Enemy ID from templates/enemies/ folder
- Player must defeat the specified number of enemies

### Collect Objectives
- **target**: Item ID that must be collected
- Items can be found, purchased, or obtained from enemies



### Visit Objectives
- **target**: Room ID that must be visited
- Progress updates when player enters the room (via movement) or looks at the room
- Useful for exploration quests that encourage players to discover new areas
- Example: "Visit the Forest Entrance", "Check the Magic Shop"

## Quest Flow

### 1. Offering Phase
- NPC has quest in their `quests` array
- Player talks to NPC and asks about quests
- System checks prerequisites
- If eligible, show quest offer dialogue
- Player can accept or decline

### 2. Accepted Phase
- Quest added to player's active quests
- Quest status becomes "accepted"
- Objectives tracked as player plays
- Progress updated automatically

### 3. Completion Phase
- All objectives completed
- Player returns to quest giver
- Turn in quest for rewards
- Quest status becomes "completed"

## Integration with NPCs

NPCs reference quests in their JSON files:

```json
{
  "name": "Town Guard",
  "quests": ["guard_forest_patrol"],
  "dialogue": {
    "responses": {
      "quests": "I have a mission for brave adventurers."
    }
  }
}
```

## Quest Commands

Players interact with quests through commands:
- `quests` - Show active and available quests
- `quest info [quest_name]` - Show detailed quest information
- `quest accept [quest_name]` - Accept an offered quest
- `quest abandon [quest_name]` - Abandon an active quest

## Adding New Quests

1. Create a new JSON file in this directory
2. Name it with the quest ID (e.g., `my_new_quest.json`)
3. Follow the schema above
4. Add the quest ID to appropriate NPC files
5. Create any needed quest items in the items folder
6. Test quest flow in-game

## Balancing Guidelines

### Experience Rewards
- Simple quests (level 1-2): 20-50 XP
- Medium quests (level 3-5): 50-100 XP
- Complex quests (level 6+): 100+ XP
- Quest series: Higher XP for final quest in a prerequisite chain

### Gold Rewards
- Should be meaningful but not game-breaking
- Consider time investment required
- Factor in item costs and economy

### Item Rewards
- Should match quest difficulty and level
- Unique items for special quests
- Consider player progression curve

### Prerequisites
- Don't create impossible prerequisite loops
- Test that required items are obtainable
- Consider player level progression

## Tips

- Make quest descriptions engaging and clear
- Ensure all referenced items and NPCs exist
- Test prerequisite dependencies thoroughly
- Use consistent dialogue tone for each NPC
- Balance challenge with rewards
- Consider multiple solutions when possible
- Add flavor text to make quests memorable