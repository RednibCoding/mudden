# Areas Structure

This directory contains area-based organization for the MUD game world.

## Structure

Each area has its own folder with:
- `area.json` - Area metadata (name, description, grid size, room layout)
- Individual room JSON files (e.g., `town_square.json`, `inn.json`, etc.)

## Area Metadata (`area.json`)

```json
{
  "name": "Town Area",
  "description": "The central town area with shops and the main square",
  "gridSize": {
    "width": 3,
    "height": 2
  },
  "layout": {
    "1,0": "town_square",
    "1,1": "inn",
    "2,0": "weapon_shop",
    "0,0": "magic_shop"
  }
}
```

- `name`: Display name of the area
- `description`: Area description
- `gridSize`: Width and height of the area grid
- `layout`: Maps coordinates to room IDs (e.g., "1,0": "town_square")

## Room Files

Each room file contains (filename = room ID):
```json
{
  "title": "Town Square",
  "description": "You are standing in the center of a bustling medieval town...",
  "items": ["town_notice"],
  "npcs": ["town_guard"],
  "enemies": []
}
```

- `title`: Display name of the room
- `description`: Detailed room description
- `items`: Array of item IDs found in the room
- `npcs`: Array of NPC IDs present in the room
- `enemies`: Array of enemy IDs that can spawn in the room

**Note**: No `id` field needed (filename = ID), no `exits` needed (calculated from layout)

## Available Areas

- `town_area/` - Central town with shops and facilities
- `forest_area/` - Dangerous forest with creatures and resources

## Benefits

- **Simple**: Minimal redundant data, exits calculated automatically
- **Organized**: Each area's content is self-contained
- **Scalable**: Easy to add new areas and rooms
- **Maintainable**: Clear separation of area metadata and room data
- **Modular**: Individual room files for easier editing and collaboration