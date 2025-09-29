# Enemy Files

This directory contains individual JSON files for each enemy type in the game. Enemies provide combat encounters and can drop loot when defeated.

## File Structure

Each enemy file should be named with the enemy ID (e.g., `wolf.json`) and contain a complete enemy definition.

## Enemy Schema

Each enemy file must contain the following structure:

```json
{
  "name": "Human-readable enemy name",
  "description": "Physical description of the enemy",
  "stats": {
    "health": 30,
    "maxHealth": 30,
    "strength": 8,
    "defense": 3,
    "speed": 12,
    "experience": 15
  },
  "attacks": [
    {
      "name": "attack_name",
      "damage": [6, 10],
      "accuracy": 85,
      "chance": 70,
      "description": "Description of the attack"
    }
  ],
  "loot": {
    "gold": [3, 8],
    "items": [
      {
        "id": "item_id",
        "chance": 60,
        "quantity": [1, 2]
      }
    ]
  },
  "behavior": {
    "aggressive": true,
    "fleeThreshold": 5,
    "packAnimal": false
  }
}
```

## Field Descriptions

- **name**: Display name shown to players (ID is automatically derived from filename)
- **description**: Physical appearance and characteristics
- **stats**: Combat statistics
  - **health/maxHealth**: Hit points
  - **strength**: Attack power modifier
  - **defense**: Damage reduction
  - **speed**: Initiative and flee chance modifier
  - **experience**: XP awarded when defeated
- **attacks**: Array of possible attacks
  - **name**: Attack identifier
  - **damage**: Base damage dealt
  - **accuracy**: Hit chance percentage (0-100)
  - **description**: Flavor text for the attack
- **loot**: Rewards dropped when defeated
  - **gold**: [min, max] gold range
  - **items**: Array of possible item drops
  - **dropRate**: Percentage chance to drop items (0-100)
- **behavior**: AI and combat behavior
  - **aggressive**: Whether enemy attacks on sight
  - **fleeThreshold**: Health percentage when enemy tries to flee
  - **packAnimal**: Whether enemy fights alongside others of same type

## Enemy Types

### Weak Enemies (1-25 HP)
- Good for new players
- Low experience rewards
- Basic attacks
- Common loot drops

### Medium Enemies (26-50 HP)
- Intermediate challenge
- Moderate experience rewards
- Multiple attack types
- Better loot chances

### Strong Enemies (51+ HP)
- High-level encounters
- High experience rewards
- Complex attack patterns
- Rare item drops

## Combat Mechanics

### Attack Resolution
1. Enemy selects random attack from attacks array
2. Accuracy roll determines if attack hits
3. Damage is calculated: base damage + strength modifier
4. Player defense reduces final damage

### Loot Generation
- Gold amount is randomly chosen from [min, max] range
- Items have dropRate% chance to be awarded
- Multiple items can drop from same enemy

### Behavior Patterns
- **Aggressive enemies** attack players on sight
- **Non-aggressive enemies** only fight when provoked
- **Pack animals** may call for help or fight in groups
- **Flee threshold** determines when enemy tries to escape

## Adding New Enemies

1. Create a new JSON file in this directory
2. Name it with the enemy ID (e.g., `dragon.json`)
3. Follow the schema above
4. Add the enemy ID to appropriate room files
5. The enemy will be automatically loaded by the GameWorld

## Balancing Guidelines

### Health Points
- Consider player level and equipment when setting HP
- Boss enemies should have significantly more HP
- Weak enemies: 10-25 HP
- Medium enemies: 30-60 HP
- Strong enemies: 70+ HP

### Damage Output
- Should be challenging but not overwhelming
- Consider player's likely defense at encounter level
- Multiple attacks allow for variety and strategy

### Experience Rewards
- Should scale with difficulty
- Consider time investment to defeat enemy
- Higher XP for more dangerous encounters

### Loot Tables
- Balance gold rewards with game economy
- Rare items should have low drop rates
- Consider what items make sense for each enemy type

## Tips

- Make descriptions vivid and atmospheric
- Vary attack patterns to keep combat interesting
- Consider enemy themes (forest creatures, undead, etc.)
- Test combat balance in-game
- Use consistent naming conventions
- Make behavior match the enemy's nature