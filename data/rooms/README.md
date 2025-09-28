# Room Files

This directory contains individual JSON files for each room/location in the game. Each room represents a location that players can visit and explore.

## File Structure

Each room file should be named with the room ID (e.g., `town_square.json`) and contain a complete room definition.

## Room Schema

Each room file must contain the following structure:

```json
{
  "title": "Human-readable room title",
  "description": "Detailed description of the room",
  "exits": {
    "north": "room_id_to_north",
    "south": "room_id_to_south",
    "east": "room_id_to_east",
    "west": "room_id_to_west",
    "up": "room_id_above",
    "down": "room_id_below"
  },
  "items": ["item_id_1", "item_id_2"],
  "npcs": ["npc_id_1", "npc_id_2"],
  "enemies": ["enemy_id_1", "enemy_id_2"]
}
```

## Field Descriptions

- **title**: Display name shown to players when they enter the room (ID is automatically derived from filename)
- **description**: Detailed description of the room's appearance and atmosphere
- **exits**: Object mapping direction names to destination room IDs
- **items**: Array of item IDs that can be found in this room
- **npcs**: Array of NPC IDs that are present in this room
- **enemies**: Array of enemy IDs that can be encountered in this room

## Adding New Rooms

1. Create a new JSON file in this directory
2. Name it with the room ID (e.g., `my_new_room.json`)
3. Follow the schema above
4. Add exits from other rooms to connect your new room
5. The room will be automatically loaded by the ContentService

## Room Connections

When creating exits, ensure that:
- The target room exists or will be created
- Connections are bidirectional (if room A has north → room B, then room B should have south → room A)
- Direction names are consistent: north, south, east, west, up, down, northeast, northwest, southeast, southwest

## Tips

- Keep descriptions immersive and detailed
- Use consistent naming conventions for room IDs
- Consider the logical layout when creating exits
- Items, NPCs, and enemies referenced must exist in their respective directories