# Areas Structure

This directory contains area-based organization for the MUD game world.

## Structure

Each area has its own folder with:
- Individual room JSON files (e.g., `town_square.json`, `inn.json`, etc.)


## Room Files

Each room file contains (filename = room ID):
```json
{
  "name": "Town Square",
  "description": "You are standing in the center of a bustling medieval town...",
  "items": [
    {
      "id": "berries",
      "onetime": false,
      "respawnTime": 3000
    },
    {
      "id": "iron_ore",
      "onetime": false,
      "respawnTime": 15000,
      "quest": "blacksmith_first_weapon"
    }
  ],
  "npcs": ["town_guard"],
  "enemies": [
    {
      "id": "wolf",
      "onetime": false,
      "respawnTime": 180000
    }
  ]
}
```

- `name`: Display name shown to players
- `description`: Detailed room description with atmospheric text
- `items`: Array of item objects found in the room
  - `id`: Item ID from templates/items/
  - `onetime`: Whether item can only be taken once per player (ignored if quest field is set)
  - `respawnTime`: Time in milliseconds before item respawns (only for onetime: false)
  - `quest`: Optional quest ID - makes item quest-specific (overrides onetime behavior)
- `npcs`: Array of NPC IDs present in the room (for interaction)
- `enemies`: Array of enemy objects that can spawn in the room
  - `id`: Enemy ID from templates/enemies/
  - `onetime`: Whether enemy can only be fought once per player (ignored if quest field is set)
  - `respawnTime`: Time in milliseconds before enemy respawns (only for onetime: false)
  - `quest`: Optional quest ID - makes enemy quest-specific (overrides onetime behavior)

**Note**: No `id` field needed (filename = room ID)

## Room Content System

### Items in Rooms
- Items are objects with `id`, `onetime`, optional `respawnTime`, and optional `quest` properties
- Items appear in room descriptions and can be `take`n or `examine`d
- `onetime: true` items can only be taken once per player
- `onetime: false` items respawn after being taken
- `respawnTime` specifies milliseconds before respawn (e.g., 3000 = 3 seconds, 60000 = 1 minute)
- If no `respawnTime` is specified, items respawn immediately
- **Quest Items**: When `quest` field is set, the item becomes quest-specific:
  - Only appears for players who have that quest active
  - Can be taken multiple times if the quest requires it
  - The `onetime` attribute is completely ignored
  - Respawn behavior is unchanged

### NPCs in Rooms
- NPCs are simple ID strings referencing templates/npcs/ files
- Use `talk [npc]` or `ask [npc] about [topic]` commands
- NPCs may offer quests, shop services, or information

### Enemies in Rooms
- Enemies are objects with `id`, `onetime`, optional `respawnTime`, and optional `quest` properties
- `onetime: true` enemies can only be fought once per player
- `onetime: false` enemies respawn after being defeated
- `respawnTime` specifies milliseconds before respawn (e.g., 120000 = 2 minutes, 300000 = 5 minutes)
- If no `respawnTime` is specified, enemies respawn immediately
- **Quest Enemies**: When `quest` field is set, the enemy becomes quest-specific:
  - Only appears for players who have that quest active
  - Can be fought multiple times if the quest requires it
  - The `onetime` attribute is completely ignored
  - Respawn behavior follows the quest requirements
- Combat is initiated with `attack [enemy]` command

## Available Areas

- `town_area/` - Central town with shops and facilities
- `forest_area/` - Dangerous forest with creatures and resources

## Benefits

- **Simple**: Minimal redundant data, exits calculated automatically
- **Organized**: Each area's content is self-contained
- **Scalable**: Easy to add new areas and rooms
- **Maintainable**: Clear separation of area metadata and room data
- **Modular**: Individual room files for easier editing and collaboration