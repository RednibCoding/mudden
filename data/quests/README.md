# Quest Files

This directory contains individual JSON files for each quest in the game. This structure provides better organization and scalability compared to having all quests in a single file.

## File Structure

Each quest file should be named with the quest ID (e.g., `blacksmith_first_weapon.json`) and contain a complete quest definition.

## Quest Schema

Each quest file must contain the following structure:

```json
{
  "title": "Human-readable quest title",
  "description": "Brief description of the quest",
  "questGiver": "npc_id_who_gives_quest",
  "type": "gather|kill|fetch",
  "levelRequired": 1,
  "objectives": {
    "gather": [
      {
        "item": "item_id",
        "quantity": 3,
        "description": "Gather 3 pieces of Item Name"
      }
    ],
    "kill": [
      {
        "enemy": "enemy_id",
        "quantity": 5,
        "description": "Eliminate 5 Enemy Name"
      }
    ],
    "fetch": [
      {
        "npc": "target_npc_id",
        "item": "item_to_deliver",
        "description": "Deliver Item to NPC Name"
      }
    ]
  },
  "rewards": {
    "gold": 50,
    "xp": 100,
    "items": ["reward_item_id"]
  },
  "questText": "Text shown when quest is offered",
  "completionText": "Text shown when quest is completed",
  "repeatable": true,
  "requirements": {
    "level": 1,
    "completedQuests": ["prerequisite_quest_id"]
  }
}
```

## Field Descriptions

- **title**: Display name shown to players (ID is automatically derived from filename)
- **description**: Brief summary of what the quest involves
- **questGiver**: ID of the NPC who offers this quest
- **type**: Primary quest type (gather, kill, fetch)
- **levelRequired**: Minimum player level (legacy support)
- **objectives**: Quest objectives organized by type
- **rewards**: What the player receives upon completion
- **questText**: Dialogue shown when offering the quest
- **completionText**: Dialogue shown when completing the quest
- **repeatable**: Whether the quest can be repeated
- **requirements**: Prerequisites for accepting the quest
  - **level**: Minimum level requirement
  - **completedQuests**: Array of quest IDs that must be completed first

## Adding New Quests

1. Create a new JSON file in this directory
2. Name it with the quest ID (e.g., `my_new_quest.json`)
3. Follow the schema above
4. The quest will be automatically loaded by the ContentService
5. Update the appropriate NPC's dialogue to offer the quest

## Quest Chains

To create quest chains, use the `requirements.completedQuests` array to specify prerequisite quests that must be completed before this quest becomes available.

Example:
```json
{
  "requirements": {
    "level": 5,
    "completedQuests": ["basic_training", "weapon_mastery"]
  }
}
```

This quest would only be available to players level 5+ who have completed both "basic_training" and "weapon_mastery" quests.