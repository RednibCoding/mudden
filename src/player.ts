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
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
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
    deaths: 0,
    combats: 0,
    lastLogin: Date.now(),
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
      for (const itemIdOrObj of data.inventory) {
        // If it's already an object, use it as-is (backward compatibility)
        if (typeof itemIdOrObj === 'object' && itemIdOrObj !== null) {
          enrichedInventory.push(itemIdOrObj as Item);
          continue;
        }
        
        // If it's a string ID, enrich it
        if (typeof itemIdOrObj === 'string') {
          const item = gameState.gameData.items.get(itemIdOrObj);
          if (item) {
            enrichedInventory.push({ ...item });
          } else {
            console.warn(`Item ID "${itemIdOrObj}" not found for player ${username}`);
          }
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

export async function savePlayer(player: Player, forceNew: boolean = false): Promise<void> {
  const filePath = path.join(PERSIST_DIR, `${player.username}.json`);
  
  // If forceNew, replace the in-memory player with this fresh one
  if (forceNew && gameState.players.has(player.username)) {
    console.log(`[SAVE] Replacing in-memory player ${player.username} with fresh data`);
    gameState.players.set(player.username, player);
  }
  
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
    if (forceNew) {
      console.log(`[SAVE] Fresh player saved - activeQuests:`, Object.keys(saveData.activeQuests || {}));
    }
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
  
  if (isValid) {
    // Update last login timestamp
    player.lastLogin = Date.now();
  }
  
  return isValid ? player : null;
}

export function playerExists(username: string): boolean {
  const filePath = path.join(PERSIST_DIR, `${username}.json`);
  return fs.existsSync(filePath);
}

export async function cleanupInactivePlayers(config: any): Promise<number> {
  if (!config.server.autoDeleteInactivePlayers) {
    return 0;
  }
  
  const maxInactiveMs = config.server.inactivePlayerDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;
  
  if (!fs.existsSync(PERSIST_DIR)) {
    return 0;
  }
  
  const files = fs.readdirSync(PERSIST_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(PERSIST_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Check if player has lastLogin field (for backward compatibility)
      if (data.lastLogin !== undefined) {
        const inactiveMs = now - data.lastLogin;
        
        if (inactiveMs > maxInactiveMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`  Deleted inactive player: ${data.username} (last login: ${Math.floor(inactiveMs / (24 * 60 * 60 * 1000))} days ago)`);
        }
      }
    } catch (error) {
      console.error(`Error processing player file ${file}:`, error);
    }
  }
  
  return deletedCount;
}

export async function resetPlayer(username: string, currentPassword: string): Promise<{ success: boolean; message: string }> {
  // Case-insensitive exact match
  const files = fs.readdirSync(PERSIST_DIR).filter(f => f.endsWith('.json'));
  const actualFile = files.find(f => f.toLowerCase() === `${username.toLowerCase()}.json`);
  
  if (!actualFile) {
    return { success: false, message: 'Account not found.' };
  }
  
  const actualUsername = actualFile.replace('.json', '');
  const filePath = path.join(PERSIST_DIR, actualFile);
  
  try {
    // Load and verify password
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const isValid = await bcrypt.compare(currentPassword, data.passwordHash);
    
    if (!isValid) {
      return { success: false, message: 'Invalid password.' };
    }
    
    console.log(`[RESET] Resetting player ${actualUsername}`);
    console.log(`[RESET] Old active quests:`, Object.keys(data.activeQuests || {}));
    
    // Store the password hash to preserve it
    const originalPasswordHash = data.passwordHash;
    
    // Create completely fresh player (this creates all new stats, quests, materials, etc.)
    console.log(`[RESET] Creating fresh player...`);
    const freshPlayer = await createPlayer(actualUsername, currentPassword);
    
    console.log(`[RESET] Fresh player active quests:`, Object.keys(freshPlayer.activeQuests));
    
    // Override the new password hash with the original one
    freshPlayer.passwordHash = originalPasswordHash;
    
    // Save with forceNew=true to replace in-memory player and save to disk
    console.log(`[RESET] Saving with forceNew=true...`);
    await savePlayer(freshPlayer, true);
    
    console.log(`[RESET] Reset complete!`);
    
    return { success: true, message: 'Account reset successfully. Please log in again.' };
  } catch (error) {
    console.error(`Error resetting player ${actualUsername}:`, error);
    return { success: false, message: 'Error resetting account.' };
  }
}

export async function deletePlayer(username: string, currentPassword: string): Promise<{ success: boolean; message: string }> {
  // Case-insensitive exact match
  const files = fs.readdirSync(PERSIST_DIR).filter(f => f.endsWith('.json'));
  const actualFile = files.find(f => f.toLowerCase() === `${username.toLowerCase()}.json`);
  
  if (!actualFile) {
    return { success: false, message: 'Account not found.' };
  }
  
  const actualUsername = actualFile.replace('.json', '');
  const filePath = path.join(PERSIST_DIR, actualFile);
  
  try {
    // Load and verify password
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const isValid = await bcrypt.compare(currentPassword, data.passwordHash);
    
    if (!isValid) {
      return { success: false, message: 'Invalid password.' };
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return { success: true, message: 'Account deleted permanently.' };
  } catch (error) {
    console.error(`Error deleting player ${actualUsername}:`, error);
    return { success: false, message: 'Error deleting account.' };
  }
}
