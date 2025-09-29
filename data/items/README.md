# Item Files

This directory contains individual JSON files for each item in the game. Items can be weapons, armor, consumables, quest objects, or other interactive objects.

## File Structure

Each item file should be named with the item ID (e.g., `iron_sword.json`) and contain a complete item definition.

## Item Schema

Each item file must contain the following structure:

```json
{
  "name": "Human-readable item name",
  "description": "Detailed description of the item",
  "type": "weapon|armor|consumable|readable|scroll|quest",
  "slot": "main_hand|off_hand|chest|head|legs|feet",
  "value": 50,
  "weight": 5,
  "canTake": true,
  "canUse": true,
  "effects": {
    "damage": 12,
    "defense": 5,
    "health": 25
  }
}
```

## Field Descriptions

- **name**: Display name shown to players (ID is automatically derived from filename)
- **description**: Detailed description of the item's appearance and properties
- **type**: Category of item (weapon, armor, consumable, etc.)
- **slot**: Equipment slot for weapons/armor (optional)
- **value**: Gold value for buying/selling
- **weight**: Encumbrance value (future use)
- **canTake**: Whether players can pick up the item
- **canUse**: Whether the item can be used/activated
- **effects**: Object containing stat modifiers and special effects

## Item Types

### Weapons
```json
{
  "type": "weapon",
  "slot": "main_hand",
  "effects": {
    "damage": 12
  }
}
```

### Armor
```json
{
  "type": "armor",
  "slot": "chest",
  "effects": {
    "defense": 10
  }
}
```

### Consumables
```json
{
  "type": "consumable",
  "effects": {
    "health": 25,
    "stamina": 10
  }
}
```

### Readable Items
```json
{
  "type": "readable",
  "canTake": false,
  "effects": {}
}
```

### Quest Items
```json
{
  "type": "quest",
  "canTake": true,
  "canUse": false,
  "effects": {}
}
```

## Equipment Slots

- **main_hand**: Primary weapon slot
- **off_hand**: Shield or secondary weapon
- **chest**: Body armor
- **head**: Helmets and hats
- **legs**: Leg armor and pants
- **feet**: Boots and shoes

## Effect Types

Common effect properties:
- **damage**: Weapon damage bonus
- **defense**: Armor defense bonus
- **health**: Health restoration or bonus
- **stamina**: Stamina restoration or bonus
- **strength**: Strength attribute bonus
- **magic**: Magic power bonus
- **spell**: Special spell effect
- **speed**: Movement speed modifier

## Adding New Items

1. Create a new JSON file in this directory
2. Name it with the item ID (e.g., `my_new_item.json`)
3. Follow the schema above
4. Add the item ID to appropriate room files, NPC shops, or quest rewards
5. The item will be automatically loaded by the ContentService

## Special Considerations

### Quest Items
- Usually `canTake: true, canUse: false`
- Often have zero value
- Should have descriptive names relating to the quest

### Shop Items
- Set appropriate value for economy balance
- Consider weight for inventory management
- Ensure effects are balanced for game progression

### Room Items
- Some items may have `canTake: false` (like notices or fixtures)
### Data Format Requirements
- **Filename = ID**: The JSON filename becomes the item ID automatically
- **No ID field**: Do not include an "id" field in the JSON content
- **Consistent naming**: Use lowercase with underscores (e.g., `healing_potion.json`)

## Example Item Files

See existing items for reference:
- `iron_sword.json` - Basic weapon with damage bonus
- `chain_mail.json` - Armor with defense bonus
- `healing_potion.json` - Consumable that restores health
- `town_notice.json` - Readable item with story content

## Tips

- Balance value and effects appropriately
- Make descriptions immersive and detailed
- Use consistent naming conventions
- Consider item progression and rarity
- Test items in-game to ensure proper balance
- Interactive items should have `canUse: true`
- Consider respawn mechanics for consumables