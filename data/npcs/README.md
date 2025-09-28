# NPC Files

This directory contains individual JSON files for each Non-Player Character (NPC) in the game. NPCs provide dialogue, quests, shopping, and other interactive elements.

## File Structure

Each NPC file should be named with the NPC ID (e.g., `town_guard.json`) and contain a complete NPC definition.

## NPC Schema

Each NPC file must contain the following structure:

```json
{
  "name": "Human-readable NPC name",
  "description": "Physical description of the NPC",
  "dialogue": {
    "greeting": "What the NPC says when first talked to",
    "responses": {
      "topic1": "Response to topic1",
      "topic2": "Response to topic2",
      "quests": "Response when asked about quests",
      "bye": "Goodbye message"
    }
  },
  "quests": ["quest_id_1", "quest_id_2"],
  "shop": {
    "items": ["item_id_1", "item_id_2"],
    "services": ["repair", "upgrade"]
  },
  "hostile": false,
  "stats": {
    "health": 100,
    "strength": 15,
    "defense": 10,
    "magic": 0
  }
}
```

## Field Descriptions

- **name**: Display name shown to players (ID is automatically derived from filename)
- **description**: Physical appearance and characteristics
- **dialogue**: Conversation system
  - **greeting**: Initial message when players talk to the NPC
  - **responses**: Object mapping topics to responses
- **quests**: Array of quest IDs this NPC can offer
- **shop**: Optional shop configuration
  - **items**: Items available for purchase
  - **services**: Services offered (repair, upgrade, etc.)
- **hostile**: Whether the NPC is aggressive toward players
- **stats**: Combat and interaction statistics

## Common Dialogue Topics

Standard topics that players often ask about:
- `hello`: General greeting
- `help`: Asking for assistance
- `quests`: Requesting available quests
- `bye`: Saying goodbye
- Custom topics related to the NPC's role or location

## NPC Types

### Merchants
- Include `shop` section with items and services
- Focus dialogue on business and trade
- Usually non-hostile

### Quest Givers
- Include `quests` array with quest IDs
- Dialogue should hint at available quests
- Use "quests" topic for quest offerings

### Guards/Combat NPCs
- Higher stats for health, strength, defense
- May be hostile or neutral
- Dialogue focused on security/protection

### Informational NPCs
- Provide lore, directions, or hints
- Lower combat stats
- Rich dialogue responses

## Adding New NPCs

1. Create a new JSON file in this directory
2. Name it with the NPC ID (e.g., `my_new_npc.json`)
3. Follow the schema above
4. Add the NPC ID to appropriate room files
5. The NPC will be automatically loaded by the ContentService

## Tips

- Make dialogue personality-driven and unique
- Ensure quest IDs in the quests array exist
- Shop items should reference existing item IDs
- Balance stats appropriately for the NPC's role
- Use consistent dialogue tone and voice