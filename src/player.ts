// Player authentication and persistence

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Player, Item } from './types';
import { gameState } from './game';

const PERSIST_DIR = path.join(__dirname, '../persist/players');
const SALT_ROUNDS = 10;

// Ensure persist directory exists
if (!fs.existsSync(PERSIST_DIR)) {
  fs.mkdirSync(PERSIST_DIR, { recursive: true });
}

export async function createPlayer(username: string, password: string): Promise<Player> {
  const config = gameState.gameData.config;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Get starting equipment
  const startingEquipment: any = {
    weapon: null,
    armor: null,
    shield: null,
    accessory: null
  };
  
  // Load starting equipment items
  if (config.newPlayer.startingEquipment.weapon) {
    startingEquipment.weapon = gameState.gameData.items.get(config.newPlayer.startingEquipment.weapon) || null;
  }
  if (config.newPlayer.startingEquipment.armor) {
    startingEquipment.armor = gameState.gameData.items.get(config.newPlayer.startingEquipment.armor) || null;
  }
  if (config.newPlayer.startingEquipment.shield) {
    startingEquipment.shield = gameState.gameData.items.get(config.newPlayer.startingEquipment.shield) || null;
  }
  if (config.newPlayer.startingEquipment.accessory) {
    startingEquipment.accessory = gameState.gameData.items.get(config.newPlayer.startingEquipment.accessory) || null;
  }
  
  // Load starting inventory items
  const startingInventory: Item[] = [];
  for (const itemId of config.newPlayer.startingInventory) {
    const item = gameState.gameData.items.get(itemId);
    if (item) {
      startingInventory.push({ ...item });
    }
  }
  
  const player: Player = {
    id: uuidv4(),
    username,
    passwordHash,
    location: config.newPlayer.startingLocation,
    level: config.newPlayer.startingLevel,
    xp: 0,
    health: config.newPlayer.startingHealth,
    maxHealth: config.newPlayer.startingHealth,
    mana: config.newPlayer.startingMana,
    maxMana: config.newPlayer.startingMana,
    damage: config.newPlayer.startingDamage,
    defense: config.newPlayer.startingDefense,
    gold: config.newPlayer.startingGold,
    inventory: startingInventory,
    equipped: startingEquipment,
    questItems: {},
    materials: {},
    knownRecipes: [],
    activeQuests: {},
    completed: [],
    lastHarvest: {},
    lastWhisperFrom: '',
    friends: []
  };
  
  await savePlayer(player);
  return player;
}

export async function loadPlayer(username: string): Promise<Player | null> {
  const filePath = path.join(PERSIST_DIR, `${username}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Enrich inventory: convert item IDs to full Item objects
    if (data.inventory && Array.isArray(data.inventory)) {
      const enrichedInventory: Item[] = [];
      for (const itemId of data.inventory as any[]) {
        // If it's already an object, use it as-is (backward compatibility)
        if (typeof itemId === 'object') {
          enrichedInventory.push(itemId);
          continue;
        }
        
        // If it's a string ID, enrich it
        const item = gameState.gameData.items.get(itemId as string);
        if (item) {
          enrichedInventory.push({ ...item });
        } else {
          console.warn(`Item ID "${itemId}" not found for player ${username}`);
        }
      }
      data.inventory = enrichedInventory;
    }
    
    // Enrich equipped items: convert item IDs to full Item objects
    if (data.equipped) {
      const slots = ['weapon', 'armor', 'shield', 'accessory'] as const;
      for (const slot of slots) {
        const itemId = data.equipped[slot];
        if (itemId && typeof itemId === 'string') {
          const item = gameState.gameData.items.get(itemId);
          data.equipped[slot] = item ? { ...item } : null;
        }
      }
    }
    
    return data as Player;
  } catch (error) {
    console.error(`Error loading player ${username}:`, error);
    return null;
  }
}

export async function savePlayer(player: Player): Promise<void> {
  const filePath = path.join(PERSIST_DIR, `${player.username}.json`);
  
  // Remove socket before saving (runtime only)
  const { socket, ...playerData } = player;
  
  // Convert inventory items to IDs only
  const inventoryIds = player.inventory.map(item => item.id);
  
  // Convert equipped items to IDs only
  const equippedIds = {
    weapon: player.equipped.weapon?.id || null,
    armor: player.equipped.armor?.id || null,
    shield: player.equipped.shield?.id || null,
    accessory: player.equipped.accessory?.id || null
  };
  
  // Create save data with IDs instead of full objects
  const saveData = {
    ...playerData,
    inventory: inventoryIds,
    equipped: equippedIds
  };
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
  } catch (error) {
    console.error(`Error saving player ${player.username}:`, error);
  }
}

export async function authenticatePlayer(username: string, password: string): Promise<Player | null> {
  const player = await loadPlayer(username);
  
  if (!player) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, player.passwordHash);
  
  return isValid ? player : null;
}

export function playerExists(username: string): boolean {
  const filePath = path.join(PERSIST_DIR, `${username}.json`);
  return fs.existsSync(filePath);
}
