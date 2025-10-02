import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Player, Defaults } from './types';

const PLAYERS_DIR = path.join(__dirname, '../persist/players');

// Utility function to sanitize and format player names
export function sanitizePlayerName(name: string): { isValid: boolean; sanitized: string; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, sanitized: '', error: 'Name is required' };
  }
  
  // Remove all whitespace
  const trimmed = name.trim();
  
  if (trimmed.length < 3) {
    return { isValid: false, sanitized: '', error: 'Name must be at least 3 characters long' };
  }
  
  if (trimmed.length > 15) {
    return { isValid: false, sanitized: '', error: 'Name must be 15 characters or less' };
  }
  
  // Check if name contains only ASCII letters (a-z, A-Z)
  const asciiLettersOnly = /^[a-zA-Z]+$/;
  if (!asciiLettersOnly.test(trimmed)) {
    return { isValid: false, sanitized: '', error: 'Name can only contain letters (a-z, A-Z)' };
  }
  
  // Format: First letter uppercase, rest lowercase
  const sanitized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  
  return { isValid: true, sanitized };
}

// Ensure players directory exists
if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createPlayer(username: string, password: string, defaults: Defaults): Player {
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  const player: Player = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    salt,
    level: defaults.player.startingLevel,
    experience: defaults.player.startingExperience,
    gold: defaults.player.startingGold,
    health: defaults.player.startingHealth,
    maxHealth: defaults.player.startingMaxHealth,
    damage: defaults.player.baseDamage,
    defense: defaults.player.baseDefense,
    location: defaults.player.startingLocation,
    homestoneLocation: defaults.player.startingLocation,
    inventory: [],
    equipment: {},
    activeQuests: {},
    completedQuests: [],
    oneTimeEnemiesDefeated: [],
    oneTimeItemsPickedUp: [],
    friends: [],
    lastWhisperFrom: '',
    lastItemUse: 0,
    lastSeen: Date.now()
  };
  
  savePlayer(player);
  return player;
}

export function savePlayer(player: Player): void {
  // Save with lowercase filename for consistency
  const playerFile = path.join(PLAYERS_DIR, `${player.username.toLowerCase()}.json`);
  
  // Create a copy to save
  const { activeTrade, ...playerDataToSave } = player;
  
  // CRITICAL: If player has an active trade, restore items/gold to inventory before saving
  // This ensures items aren't lost if server crashes or shuts down during a trade
  if (activeTrade) {
    // Restore items that were in the trade window
    if (activeTrade.myItems && activeTrade.myItems.length > 0) {
      playerDataToSave.inventory = [...playerDataToSave.inventory, ...activeTrade.myItems];
    }
    // Restore gold that was in the trade window
    if (activeTrade.myGold && activeTrade.myGold > 0) {
      playerDataToSave.gold += activeTrade.myGold;
    }
  }
  
  fs.writeFileSync(playerFile, JSON.stringify(playerDataToSave, null, 2));
}

export function loadPlayer(username: string): Player | null {
  try {
    // Load with lowercase filename for consistency
    const playerFile = path.join(PLAYERS_DIR, `${username.toLowerCase()}.json`);
    if (!fs.existsSync(playerFile)) {
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(playerFile, 'utf8')) as Player;
    
    // activeTrade is runtime-only state, ensure it's never set on load
    data.activeTrade = undefined;
    
    return data;
  } catch (error) {
    console.error('Error loading player:', error);
    return null;
  }
}

export function validatePassword(player: Player, password: string): boolean {
  const hash = hashPassword(password, player.salt);
  return hash === player.passwordHash;
}

export function playerExists(username: string): boolean {
  // Check existence with lowercase to prevent duplicate names with different cases
  const playerFile = path.join(PLAYERS_DIR, `${username.toLowerCase()}.json`);
  return fs.existsSync(playerFile);
}