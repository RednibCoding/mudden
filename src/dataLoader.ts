/**
 * Data loading utilities for game content
 */
import * as fs from 'fs';
import * as path from 'path';
import { gameState } from './gameState';
import { Location, Item, Enemy, NPC, Quest, Shop, LocationEnemy } from './types';

/**
 * Loads all game content from JSON files in the data directory
 */
export function loadGameData(): void {
  const dataDir = path.join(__dirname, '../data');
  
  loadDefaults(dataDir);
  loadLocations(dataDir);
  loadItems(dataDir);
  loadEnemies(dataDir);
  loadNPCs(dataDir);
  loadQuests(dataDir);
  loadShops(dataDir);
  
  processEnemyInstances();
  populateNPCLocations();
}

/**
 * Loads game defaults configuration
 */
function loadDefaults(dataDir: string): void {
  try {
    const defaultsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'defaults.json'), 'utf8'));
    gameState.defaults = defaultsData;
    console.log('Loaded game defaults');
  } catch (error) {
    console.log('No defaults.json found, using hardcoded defaults');
  }
}

/**
 * Loads location data
 */
function loadLocations(dataDir: string): void {
  try {
    const locationsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'locations.json'), 'utf8'));
    locationsData.forEach((location: Location) => {
      gameState.locations.set(location.id, location);
    });
    console.log(`Loaded ${locationsData.length} locations`);
  } catch (error) {
    console.log('No locations.json found');
  }
}

/**
 * Loads item data
 */
function loadItems(dataDir: string): void {
  try {
    const itemsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf8'));
    itemsData.forEach((item: Item) => {
      gameState.items.set(item.id, item);
    });
    console.log(`Loaded ${itemsData.length} items`);
  } catch (error) {
    console.log('No items.json found');
  }
}

/**
 * Loads enemy templates
 */
function loadEnemies(dataDir: string): void {
  try {
    const enemiesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf8'));
    enemiesData.forEach((enemy: Enemy) => {
      gameState.enemies.set(enemy.id, { ...enemy, currentFighters: [] });
    });
    console.log(`Loaded ${enemiesData.length} enemy templates`);
  } catch (error) {
    console.log('No enemies.json found');
  }
}

/**
 * Loads NPC data
 */
function loadNPCs(dataDir: string): void {
  try {
    const npcsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
    npcsData.forEach((npc: NPC) => {
      gameState.npcs.set(npc.id, npc);
    });
    console.log(`Loaded ${npcsData.length} NPCs`);
  } catch (error) {
    console.log('No npcs.json found');
  }
}

/**
 * Loads quest data
 */
function loadQuests(dataDir: string): void {
  try {
    const questsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'quests.json'), 'utf8'));
    questsData.forEach((quest: Quest) => {
      gameState.quests.set(quest.id, quest);
    });
    console.log(`Loaded ${questsData.length} quests`);
  } catch (error) {
    console.log('No quests.json found');
  }
}

/**
 * Loads shop data
 */
function loadShops(dataDir: string): void {
  try {
    const shopsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'shops.json'), 'utf8'));
    shopsData.forEach((shop: Shop) => {
      gameState.shops.set(shop.id, shop);
    });
    console.log(`Loaded ${shopsData.length} shops`);
  } catch (error) {
    console.log('No shops.json found');
  }
}

/**
 * Converts enemy templates to location-specific instances
 */
function processEnemyInstances(): void {
  const enemyTemplates = new Map(gameState.enemies);
  
  gameState.locations.forEach((location) => {
    const enemyInstances: Enemy[] = [];
    
    ((location.enemies as any) as LocationEnemy[]).forEach((enemyDef: LocationEnemy) => {
      const template = enemyTemplates.get(enemyDef.enemyId);
      if (template) {
        const instance: Enemy = {
          ...template,
          currentFighters: [],
          prerequisiteActiveQuests: enemyDef.prerequisiteActiveQuests,
          prerequisiteCompletedQuests: enemyDef.prerequisiteCompletedQuests,
          oneTime: enemyDef.oneTime
        };
        enemyInstances.push(instance);
      }
    });
    
    location.enemies = enemyInstances as any;
  });
  
  gameState.enemies.clear();
}

/**
 * Populates NPC location references based on location data
 */
function populateNPCLocations(): void {
  gameState.locations.forEach((location, locationId) => {
    location.npcs.forEach(npcId => {
      const npc = gameState.npcs.get(npcId);
      if (npc) {
        if (!npc.locations) npc.locations = [];
        if (!npc.locations.includes(locationId)) {
          npc.locations.push(locationId);
        }
      }
    });
  });
}
