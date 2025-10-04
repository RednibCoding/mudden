#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

// Raw JSON types (before enrichment - these have string IDs)
interface RawLocation {
  id: string;
  name: string;
  description: string;
  exits: { [direction: string]: string };
  npcs?: string[];
  enemies?: string[];
  items?: string[];
  shop?: string;
  resources?: Array<{
    materialId: string;
    amount: string;
    cooldown: number;
    chance: number;
  }>;
}

interface RawItem {
  id: string;
  name: string;
  type: string;
  teachesRecipe?: string;
  destination?: string;
}

interface RawEnemy {
  id: string;
  name: string;
  materialDrops?: { [materialId: string]: any };
  itemDrops?: { [itemId: string]: any };
}

interface RawNPC {
  id: string;
  name: string;
  quests?: string[];
  portals?: { [keyword: string]: { destination: string; cost: number } };
}

interface RawQuest {
  id: string;
  name: string;
  type: string;
  target: string;
  materialDrop?: string;
  requiresQuest?: string;
  reward: {
    gold: number;
    xp: number;
    item?: string;
  };
}

interface RawShop {
  id: string;
  name: string;
  items: string[];
}

interface RawRecipe {
  id: string;
  name: string;
  result: string;
  resultType: string;
  materials: { [materialId: string]: number };
}

interface RawMaterial {
  id: string;
  name: string;
}

interface ValidationError {
  file: string;
  entity: string;
  field: string;
  invalidId: string;
  expectedType: string;
}

// Load all JSON files from a folder
function loadFolder<T>(folderPath: string): Map<string, T> {
  const map = new Map<string, T>();
  
  if (!fs.existsSync(folderPath)) {
    return map;
  }
  
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  
  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    const id = file.replace('.json', '');
    map.set(id, data);
  });
  
  return map;
}

// Load all game data (raw JSON, not enriched)
function loadGameData() {
  const dataDir = path.join(__dirname, '../data');
  
  return {
    locations: loadFolder<RawLocation>(path.join(dataDir, 'locations')),
    items: loadFolder<RawItem>(path.join(dataDir, 'items')),
    enemies: loadFolder<RawEnemy>(path.join(dataDir, 'enemies')),
    npcs: loadFolder<RawNPC>(path.join(dataDir, 'npcs')),
    quests: loadFolder<RawQuest>(path.join(dataDir, 'quests')),
    shops: loadFolder<RawShop>(path.join(dataDir, 'shops')),
    materials: loadFolder<RawMaterial>(path.join(dataDir, 'materials')),
    recipes: loadFolder<RawRecipe>(path.join(dataDir, 'recipes'))
  };
}

// Validate all ID references
function validateIds() {
  console.log('=== Mudden ID Reference Validator ===\n');
  
  const data = loadGameData();
  const errors: ValidationError[] = [];
  
  console.log('Loaded game data:');
  console.log(`  - ${data.locations.size} location(s)`);
  console.log(`  - ${data.items.size} item(s)`);
  console.log(`  - ${data.enemies.size} enemy/enemies`);
  console.log(`  - ${data.npcs.size} NPC(s)`);
  console.log(`  - ${data.quests.size} quest(s)`);
  console.log(`  - ${data.shops.size} shop(s)`);
  console.log(`  - ${data.materials.size} material(s)`);
  console.log(`  - ${data.recipes.size} recipe(s)`);
  console.log('\nValidating ID references...\n');
  
  // Validate Locations
  console.log('Validating locations...');
  data.locations.forEach((location, locId) => {
    // Check exit targets
    if (location.exits) {
      Object.entries(location.exits).forEach(([dir, targetId]) => {
        if (!data.locations.has(targetId)) {
          errors.push({
            file: `locations/${locId}.json`,
            entity: `${location.name} (${locId})`,
            field: `exits.${dir}`,
            invalidId: targetId,
            expectedType: 'location'
          });
        }
      });
    }
    
    // Check enemies
    if (location.enemies && location.enemies.length > 0) {
      location.enemies.forEach(enemyId => {
        if (!data.enemies.has(enemyId)) {
          errors.push({
            file: `locations/${locId}.json`,
            entity: `${location.name} (${locId})`,
            field: 'enemies',
            invalidId: enemyId,
            expectedType: 'enemy'
          });
        }
      });
    }
    
    // Check NPCs
    if (location.npcs && location.npcs.length > 0) {
      location.npcs.forEach(npcId => {
        if (!data.npcs.has(npcId)) {
          errors.push({
            file: `locations/${locId}.json`,
            entity: `${location.name} (${locId})`,
            field: 'npcs',
            invalidId: npcId,
            expectedType: 'npc'
          });
        }
      });
    }
    
    // Check shop
    if (location.shop && !data.shops.has(location.shop)) {
      errors.push({
        file: `locations/${locId}.json`,
        entity: `${location.name} (${locId})`,
        field: 'shop',
        invalidId: location.shop,
        expectedType: 'shop'
      });
    }
    
    // Check items on ground
    if (location.items && location.items.length > 0) {
      location.items.forEach(itemId => {
        if (!data.items.has(itemId)) {
          errors.push({
            file: `locations/${locId}.json`,
            entity: `${location.name} (${locId})`,
            field: 'items',
            invalidId: itemId,
            expectedType: 'item'
          });
        }
      });
    }
    
    // Check resource materials
    if (location.resources && location.resources.length > 0) {
      location.resources.forEach((resource, idx) => {
        if (!data.materials.has(resource.materialId)) {
          errors.push({
            file: `locations/${locId}.json`,
            entity: `${location.name} (${locId})`,
            field: `resources[${idx}].materialId`,
            invalidId: resource.materialId,
            expectedType: 'material'
          });
        }
      });
    }
  });
  
  // Validate Items
  console.log('Validating items...');
  data.items.forEach((item, itemId) => {
    // Check teachesRecipe for recipe items
    if (item.type === 'recipe' && item.teachesRecipe) {
      if (!data.recipes.has(item.teachesRecipe)) {
        errors.push({
          file: `items/${itemId}.json`,
          entity: `${item.name} (${itemId})`,
          field: 'teachesRecipe',
          invalidId: item.teachesRecipe,
          expectedType: 'recipe'
        });
      }
    }
    
    // Check destination for teleport scrolls
    if (item.destination && !data.locations.has(item.destination)) {
      errors.push({
        file: `items/${itemId}.json`,
        entity: `${item.name} (${itemId})`,
        field: 'destination',
        invalidId: item.destination,
        expectedType: 'location'
      });
    }
  });
  
  // Validate Enemies
  console.log('Validating enemies...');
  data.enemies.forEach((enemy, enemyId) => {
    // Check material drops
    if (enemy.materialDrops) {
      Object.keys(enemy.materialDrops).forEach(materialId => {
        if (!data.materials.has(materialId)) {
          errors.push({
            file: `enemies/${enemyId}.json`,
            entity: `${enemy.name} (${enemyId})`,
            field: 'materialDrops',
            invalidId: materialId,
            expectedType: 'material'
          });
        }
      });
    }
    
    // Check item drops
    if (enemy.itemDrops) {
      Object.keys(enemy.itemDrops).forEach(itemId => {
        if (!data.items.has(itemId)) {
          errors.push({
            file: `enemies/${enemyId}.json`,
            entity: `${enemy.name} (${enemyId})`,
            field: 'itemDrops',
            invalidId: itemId,
            expectedType: 'item'
          });
        }
      });
    }
  });
  
  // Validate NPCs
  console.log('Validating NPCs...');
  data.npcs.forEach((npc, npcId) => {
    // Check quests array
    if (npc.quests) {
      npc.quests.forEach((questId, idx) => {
        if (!data.quests.has(questId)) {
          errors.push({
            file: `npcs/${npcId}.json`,
            entity: `${npc.name} (${npcId})`,
            field: `quests[${idx}]`,
            invalidId: questId,
            expectedType: 'quest'
          });
        }
      });
    }
    
    // Check portal destinations
    if (npc.portals) {
      Object.values(npc.portals).forEach((portal, idx) => {
        if (!data.locations.has(portal.destination)) {
          errors.push({
            file: `npcs/${npcId}.json`,
            entity: `${npc.name} (${npcId})`,
            field: `portals.destination`,
            invalidId: portal.destination,
            expectedType: 'location'
          });
        }
      });
    }
  });
  
  // Validate Quests
  console.log('Validating quests...');
  data.quests.forEach((quest, questId) => {
    // Check prerequisite quest
    if (quest.requiresQuest && !data.quests.has(quest.requiresQuest)) {
      errors.push({
        file: `quests/${questId}.json`,
        entity: `${quest.name} (${questId})`,
        field: 'requiresQuest',
        invalidId: quest.requiresQuest,
        expectedType: 'quest'
      });
    }
    
    // Check target based on quest type
    if (quest.type === 'kill' && quest.target) {
      if (!data.enemies.has(quest.target)) {
        errors.push({
          file: `quests/${questId}.json`,
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'enemy'
        });
      }
    } else if (quest.type === 'collect' && quest.target) {
      if (!data.enemies.has(quest.target)) {
        errors.push({
          file: `quests/${questId}.json`,
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'enemy'
        });
      }
    } else if (quest.type === 'visit' && quest.target) {
      if (!data.npcs.has(quest.target)) {
        errors.push({
          file: `quests/${questId}.json`,
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'npc'
        });
      }
    }
    
    // Check materialDrop for collect quests
    if (quest.type === 'collect' && quest.materialDrop) {
      if (!data.materials.has(quest.materialDrop)) {
        errors.push({
          file: `quests/${questId}.json`,
          entity: `${quest.name} (${questId})`,
          field: 'materialDrop',
          invalidId: quest.materialDrop,
          expectedType: 'material'
        });
      }
    }
    
    // Check reward item
    if (quest.reward && quest.reward.item) {
      if (!data.items.has(quest.reward.item)) {
        errors.push({
          file: `quests/${questId}.json`,
          entity: `${quest.name} (${questId})`,
          field: 'reward.item',
          invalidId: quest.reward.item,
          expectedType: 'item'
        });
      }
    }
  });
  
  // Validate Shops
  console.log('Validating shops...');
  data.shops.forEach((shop, shopId) => {
    // Check items array
    if (shop.items && shop.items.length > 0) {
      shop.items.forEach(itemId => {
        if (!data.items.has(itemId)) {
          errors.push({
            file: `shops/${shopId}.json`,
            entity: `${shop.name} (${shopId})`,
            field: 'items',
            invalidId: itemId,
            expectedType: 'item'
          });
        }
      });
    }
  });
  
  // Validate Recipes
  console.log('Validating recipes...');
  data.recipes.forEach((recipe, recipeId) => {
    // Check result (item or material)
    if (recipe.resultType === 'item') {
      if (!data.items.has(recipe.result)) {
        errors.push({
          file: `recipes/${recipeId}.json`,
          entity: `${recipe.name} (${recipeId})`,
          field: 'result',
          invalidId: recipe.result,
          expectedType: 'item'
        });
      }
    } else if (recipe.resultType === 'material') {
      if (!data.materials.has(recipe.result)) {
        errors.push({
          file: `recipes/${recipeId}.json`,
          entity: `${recipe.name} (${recipeId})`,
          field: 'result',
          invalidId: recipe.result,
          expectedType: 'material'
        });
      }
    }
    
    // Check material requirements
    if (recipe.materials) {
      Object.keys(recipe.materials).forEach(materialId => {
        if (!data.materials.has(materialId)) {
          errors.push({
            file: `recipes/${recipeId}.json`,
            entity: `${recipe.name} (${recipeId})`,
            field: 'materials',
            invalidId: materialId,
            expectedType: 'material'
          });
        }
      });
    }
  });
  
  // Report results
  console.log('\n' + '='.repeat(60));
  if (errors.length === 0) {
    console.log('\n✓ All ID references are valid!\n');
    return true;
  } else {
    console.log(`\n✗ Found ${errors.length} invalid ID reference(s):\n`);
    
    // Group by file
    const byFile = new Map<string, ValidationError[]>();
    errors.forEach(err => {
      if (!byFile.has(err.file)) {
        byFile.set(err.file, []);
      }
      byFile.get(err.file)!.push(err);
    });
    
    byFile.forEach((fileErrors, file) => {
      console.log(`\n${file}:`);
      fileErrors.forEach(err => {
        console.log(`  ✗ ${err.entity}`);
        console.log(`    Field: ${err.field}`);
        console.log(`    Invalid ${err.expectedType} ID: "${err.invalidId}"`);
      });
    });
    
    console.log('\n');
    return false;
  }
}

// Run validation
const isValid = validateIds();
process.exit(isValid ? 0 : 1);
