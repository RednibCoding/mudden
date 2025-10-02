#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Location, Item, Enemy, NPC, Quest, Shop } from '../src/types';

interface ValidationError {
  file: string;
  entity: string;
  field: string;
  invalidId: string;
  expectedType: string;
}

// Load all game data
function loadGameData() {
  const dataDir = path.join(__dirname, '../data');
  
  const locations = JSON.parse(fs.readFileSync(path.join(dataDir, 'locations.json'), 'utf-8')) as Location[];
  const items = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf-8')) as Item[];
  const enemies = JSON.parse(fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf-8')) as Enemy[];
  const npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf-8')) as NPC[];
  const quests = JSON.parse(fs.readFileSync(path.join(dataDir, 'quests.json'), 'utf-8')) as Quest[];
  const shops = JSON.parse(fs.readFileSync(path.join(dataDir, 'shops.json'), 'utf-8')) as Shop[];
  
  return {
    locations: new Map(locations.map(l => [l.id, l])),
    items: new Map(items.map(i => [i.id, i])),
    enemies: new Map(enemies.map(e => [e.id, e])),
    npcs: new Map(npcs.map(n => [n.id, n])),
    quests: new Map(quests.map(q => [q.id, q])),
    shops: new Map(shops.map(s => [s.id, s]))
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
  console.log('\nValidating ID references...\n');
  
  // Validate Locations
  console.log('Validating locations...');
  data.locations.forEach((location, locId) => {
    // Check exit targets
    Object.entries(location.exits).forEach(([dir, targetId]) => {
      if (!data.locations.has(targetId)) {
        errors.push({
          file: 'locations.json',
          entity: `${location.name} (${locId})`,
          field: `exits.${dir}`,
          invalidId: targetId,
          expectedType: 'location'
        });
      }
    });
    
    // Check enemies (stored as Enemy objects with id field)
    if (location.enemies && location.enemies.length > 0) {
      location.enemies.forEach(enemy => {
        if (typeof enemy === 'string') {
          // If it's stored as string ID
          if (!data.enemies.has(enemy)) {
            errors.push({
              file: 'locations.json',
              entity: `${location.name} (${locId})`,
              field: 'enemies',
              invalidId: enemy,
              expectedType: 'enemy'
            });
          }
        } else if (enemy && typeof enemy === 'object' && 'id' in enemy) {
          // If it's stored as Enemy object
          if (!data.enemies.has(enemy.id)) {
            errors.push({
              file: 'locations.json',
              entity: `${location.name} (${locId})`,
              field: 'enemies',
              invalidId: enemy.id,
              expectedType: 'enemy'
            });
          }
        }
      });
    }
    
    // Check NPCs
    if (location.npcs) {
      location.npcs.forEach(npcId => {
        if (!data.npcs.has(npcId)) {
          errors.push({
            file: 'locations.json',
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
        file: 'locations.json',
        entity: `${location.name} (${locId})`,
        field: 'shop',
        invalidId: location.shop,
        expectedType: 'shop'
      });
    }
  });
  
  // Validate Items
  console.log('Validating items...');
  // Items only have basic fields, no ID references to validate
  
  // Validate Enemies
  console.log('Validating enemies...');
  data.enemies.forEach((enemy, enemyId) => {
    // Check drop items
    if (enemy.drops) {
      enemy.drops.forEach(drop => {
        if (!data.items.has(drop.itemId)) {
          errors.push({
            file: 'enemies.json',
            entity: `${enemy.name} (${enemyId})`,
            field: 'drops.itemId',
            invalidId: drop.itemId,
            expectedType: 'item'
          });
        }
      });
    }
  });
  
  // Validate NPCs
  console.log('Validating NPCs...');
  data.npcs.forEach((npc, npcId) => {
    // Check quests
    if (npc.quests) {
      npc.quests.forEach(questId => {
        if (!data.quests.has(questId)) {
          errors.push({
            file: 'npcs.json',
            entity: `${npc.name} (${npcId})`,
            field: 'quests',
            invalidId: questId,
            expectedType: 'quest'
          });
        }
      });
    }
    
    // NPCs don't have shop field (shops are in locations)
  });
  
  // Validate Quests
  console.log('Validating quests...');
  data.quests.forEach((quest, questId) => {
    // Check prerequisiteQuests
    if (quest.prerequisiteQuests && quest.prerequisiteQuests.length > 0) {
      quest.prerequisiteQuests.forEach(prereqId => {
        if (!data.quests.has(prereqId)) {
          errors.push({
            file: 'quests.json',
            entity: `${quest.name} (${questId})`,
            field: 'prerequisiteQuests',
            invalidId: prereqId,
            expectedType: 'quest'
          });
        }
      });
    }
    
    // Check target based on quest type
    if (quest.type === 'kill' && quest.target) {
      if (!data.enemies.has(quest.target)) {
        errors.push({
          file: 'quests.json',
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'enemy'
        });
      }
    } else if (quest.type === 'collect' && quest.target) {
      if (!data.items.has(quest.target)) {
        errors.push({
          file: 'quests.json',
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'item'
        });
      }
    } else if (quest.type === 'visit' && quest.target) {
      if (!data.locations.has(quest.target)) {
        errors.push({
          file: 'quests.json',
          entity: `${quest.name} (${questId})`,
          field: 'target',
          invalidId: quest.target,
          expectedType: 'location'
        });
      }
    }
    
    // Check giver NPC
    if (quest.giver && !data.npcs.has(quest.giver)) {
      errors.push({
        file: 'quests.json',
        entity: `${quest.name} (${questId})`,
        field: 'giver',
        invalidId: quest.giver,
        expectedType: 'npc'
      });
    }
    
    // Check turnInNPC
    if (quest.turnInNPC && !data.npcs.has(quest.turnInNPC)) {
      errors.push({
        file: 'quests.json',
        entity: `${quest.name} (${questId})`,
        field: 'turnInNPC',
        invalidId: quest.turnInNPC,
        expectedType: 'npc'
      });
    }
    
    // Check reward items
    if (quest.reward && quest.reward.items && quest.reward.items.length > 0) {
      quest.reward.items.forEach(itemId => {
        if (!data.items.has(itemId)) {
          errors.push({
            file: 'quests.json',
            entity: `${quest.name} (${questId})`,
            field: 'reward.items',
            invalidId: itemId,
            expectedType: 'item'
          });
        }
      });
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
            file: 'shops.json',
            entity: `${shop.name} (${shopId})`,
            field: 'items',
            invalidId: itemId,
            expectedType: 'item'
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
