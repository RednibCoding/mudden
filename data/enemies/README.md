# Enemies

This directory contains JSON files for each enemy in the MUD game.

## Enemy Structure

Each enemy JSON file contains:

- `id`: Unique identifier for the enemy
- `name`: Display name of the enemy
- `description`: Detailed description shown to players
- `stats`: Combat statistics
  - `health`: Current health points
  - `maxHealth`: Maximum health points
  - `strength`: Attack power modifier
  - `defense`: Damage reduction
  - `speed`: Initiative/turn order modifier
  - `experience`: XP awarded when defeated
- `attacks`: Array of available attacks
  - `name`: Attack name
  - `damage`: Base damage dealt
  - `accuracy`: Hit chance percentage (0-100)
  - `description`: Flavor text for the attack
- `loot`: Items and gold dropped when defeated
  - `gold`: Array with [min, max] gold range
  - `items`: Array of item IDs that can be dropped
  - `dropRate`: Percentage chance to drop items (0-100)
- `behavior`: AI behavior settings
  - `aggressive`: Whether the enemy attacks on sight
  - `fleeThreshold`: Health percentage when enemy tries to flee
  - `packAnimal`: Whether this enemy can appear in groups

## Available Enemies

- `wolf.json` - Forest Wolf (Level 1-2 enemy)
- `goblin.json` - Sneaky Goblin (Level 1 enemy)
- `orc.json` - Brutal Orc (Level 2-3 enemy)