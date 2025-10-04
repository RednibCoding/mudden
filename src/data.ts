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
  
  // Enrich quests with NPC references
  enrichQuests(gameData);
  
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
    // Enrich NPCs: convert ID strings to full NPC objects
    if (location.npcs && Array.isArray(location.npcs)) {
      const enrichedNPCs: NPC[] = [];
      
      for (const npcId of location.npcs as any[]) {
        // If it's already an object, skip it (old format)
        if (typeof npcId === 'object') {
          enrichedNPCs.push(npcId);
          continue;
        }
        
        // If it's a string ID, enrich it
        const npcTemplate = gameData.npcs.get(npcId as string);
        if (npcTemplate) {
          enrichedNPCs.push({ ...npcTemplate });
        } else {
          throw new Error(`NPC ID "${npcId}" not found in location "${location.id}"`);
        }
      }
      
      location.npcs = enrichedNPCs;
    }
    
    // Enrich shop: convert shop ID string to full Shop object
    if (location.shop && typeof location.shop === 'string') {
      const shopTemplate = gameData.shops.get(location.shop);
      if (shopTemplate) {
        location.shop = { ...shopTemplate };
      } else {
        throw new Error(`Shop ID "${location.shop}" not found in location "${location.id}"`);
      }
    }
    
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
          throw new Error(`Enemy ID "${enemyId}" not found in location "${location.id}"`);
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
          throw new Error(`Item ID "${itemId}" not found in location "${location.id}"`);
        }
      }
      
      location.items = enrichedItems;
    }
  }
}

// Enrich quest data with NPC references
function enrichQuests(gameData: GameData): void {
  // For each quest, find which NPC gives it
  for (const quest of gameData.quests.values()) {
    let questGiverCount = 0;
    let questGiverId: string | undefined;
    
    // Count how many NPCs reference this quest
    for (const npc of gameData.npcs.values()) {
      if (npc.quest === quest.id) {
        questGiverCount++;
        questGiverId = npc.id;
      }
    }
    
    // Validate: at most one quest giver
    if (questGiverCount === 0) {
      console.warn(`Quest "${quest.id}" has no NPC quest giver (quest not yet assigned).`);
    } else if (questGiverCount > 1) {
      throw new Error(`Quest "${quest.id}" has multiple quest givers! Each quest must have exactly one NPC.`);
    } else {
      // Populate the npc field
      quest.npc = questGiverId;
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
      deathRespawnLocation: 'town_square',
      damageVariance: 0.1
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
