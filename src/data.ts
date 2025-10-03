// JSON folder loader for game data

import fs from 'fs';
import path from 'path';
import { GameData, Location, Item, Enemy, NPC, Quest, Shop, Recipe, Material, Config } from './types';

export async function loadGameData(): Promise<GameData> {
  const dataDir = path.join(__dirname, '../data');
  
  console.log('Loading game data...');
  
  const gameData: GameData = {
    locations: await loadFolder<Location>(path.join(dataDir, 'locations')),
    items: await loadFolder<Item>(path.join(dataDir, 'items')),
    enemies: await loadFolder<Enemy>(path.join(dataDir, 'enemies')),
    npcs: await loadFolder<NPC>(path.join(dataDir, 'npcs')),
    quests: await loadFolder<Quest>(path.join(dataDir, 'quests')),
    shops: await loadFolder<Shop>(path.join(dataDir, 'shops')),
    recipes: await loadFolder<Recipe>(path.join(dataDir, 'recipes')),
    materials: await loadFolder<Material>(path.join(dataDir, 'materials')),
    config: await loadConfig(path.join(dataDir, 'config.json'))
  };
  
  // Enrich locations with enemy and item data
  enrichLocations(gameData);
  
  console.log('Game data loaded:');
  console.log(`  - ${gameData.locations.size} locations`);
  console.log(`  - ${gameData.items.size} items`);
  console.log(`  - ${gameData.enemies.size} enemies`);
  console.log(`  - ${gameData.npcs.size} NPCs`);
  console.log(`  - ${gameData.quests.size} quests`);
  console.log(`  - ${gameData.shops.size} shops`);
  console.log(`  - ${gameData.recipes.size} recipes`);
  console.log(`  - ${gameData.materials.size} materials`);
  
  return gameData;
}

// Enrich location data with full enemy and item objects from IDs
function enrichLocations(gameData: GameData): void {
  for (const location of gameData.locations.values()) {
    // Enrich enemies: convert ID strings to full Enemy objects
    if (location.enemies && Array.isArray(location.enemies)) {
      const enrichedEnemies: Enemy[] = [];
      
      for (const enemyId of location.enemies as any[]) {
        // If it's already an object, skip it (old format)
        if (typeof enemyId === 'object') {
          enrichedEnemies.push(enemyId);
          continue;
        }
        
        // If it's a string ID, enrich it
        const enemyTemplate = gameData.enemies.get(enemyId as string);
        if (enemyTemplate) {
          // Create a copy of the enemy with instance-specific data
          enrichedEnemies.push({
            ...enemyTemplate,
            health: enemyTemplate.maxHealth,
            fighters: []
          });
        } else {
          console.warn(`Enemy ID "${enemyId}" not found in location "${location.id}"`);
        }
      }
      
      location.enemies = enrichedEnemies;
    }
    
    // Enrich items: convert ID strings to full Item objects
    if (location.items && Array.isArray(location.items)) {
      const enrichedItems: Item[] = [];
      
      for (const itemId of location.items as any[]) {
        // If it's already an object, skip it (old format)
        if (typeof itemId === 'object') {
          enrichedItems.push(itemId);
          continue;
        }
        
        // If it's a string ID, enrich it
        const itemTemplate = gameData.items.get(itemId as string);
        if (itemTemplate) {
          enrichedItems.push({ ...itemTemplate });
        } else {
          console.warn(`Item ID "${itemId}" not found in location "${location.id}"`);
        }
      }
      
      location.items = enrichedItems;
    }
  }
}

async function loadFolder<T extends { id: string }>(folderPath: string): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    return map;
  }
  
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8')) as T;
      map.set(data.id, data);
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
    }
  }
  
  return map;
}

async function loadConfig(configPath: string): Promise<Config> {
  if (!fs.existsSync(configPath)) {
    console.error('Config file not found! Using defaults.');
    return getDefaultConfig();
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Config;
  } catch (error) {
    console.error('Error loading config:', error);
    return getDefaultConfig();
  }
}

function getDefaultConfig(): Config {
  return {
    newPlayer: {
      startingLocation: 'town_square',
      startingLevel: 1,
      startingGold: 50,
      startingHealth: 100,
      startingMana: 50,
      startingDamage: 5,
      startingDefense: 3,
      startingEquipment: {
        weapon: null,
        armor: null,
        shield: null,
        accessory: null
      },
      startingInventory: []
    },
    gameplay: {
      maxInventorySlots: 16,
      fleeSuccessChance: 0.5,
      enemyRespawnTime: 60000,
      deathGoldLossPct: 0.1,
      deathRespawnLocation: 'town_square'
    },
    progression: {
      baseXpPerLevel: 100,
      xpMultiplier: 1.5,
      healthPerLevel: 10,
      manaPerLevel: 5,
      damagePerLevel: 2,
      defensePerLevel: 1
    },
    economy: {
      shopBuyMultiplier: 1.2,
      shopSellMultiplier: 0.5,
      healerCostFactor: 50
    }
  };
}
