/**
 * Player Manager - handles player data, authentication, and state
 * Provides clean interface for player operations
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ErrorCodes } from '../../shared/ErrorCodes.js';

export class PlayerManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        this.players = new Map(); // playerId -> player data
        this.playersByName = new Map(); // playerName -> playerId
        this.playersDir = 'persist/players';
        
        // Load player defaults from template
        this.playerDefaults = this.loadPlayerDefaults();
        
        // Ensure players directory exists
        if (!fs.existsSync(this.playersDir)) {
            fs.mkdirSync(this.playersDir, { recursive: true });
        }
        
        console.log('PlayerManager initialized');
    }

    /**
     * Authenticate player and load their data
     * @param {string} playerId - Socket ID
     * @param {string} username - Player name
     * @param {string} password - Player password
     * @returns {Object} Authentication result
     */
    authenticatePlayer(playerId, username, password) {
        const playerFile = path.join(this.playersDir, `${username}.json`);
        
        try {
            if (fs.existsSync(playerFile)) {
                // Existing player - verify password
                const playerData = JSON.parse(fs.readFileSync(playerFile, 'utf8'));
                
                if (!this.verifyPassword(password, playerData.passwordHash, playerData.salt)) {
                    return { success: false, errorCode: ErrorCodes.INVALID_CREDENTIALS };
                }
                
                // Check for duplicate login - prepare to disconnect existing session
                let existingPlayerId = null;
                if (this.playersByName.has(username.toLowerCase())) {
                    existingPlayerId = this.playersByName.get(username.toLowerCase());
                    console.log(`Duplicate login for ${username}. Will disconnect existing session: ${existingPlayerId}`);
                    
                    // Clean up the existing session data
                    this.players.delete(existingPlayerId);
                    this.playersByName.delete(username.toLowerCase());
                }
                
                // Load player data
                this.players.set(playerId, {
                    ...playerData,
                    id: playerId,
                    lastActivity: Date.now()
                });
                this.playersByName.set(username.toLowerCase(), playerId);
                
                return { 
                    success: true, 
                    isNewPlayer: false, 
                    player: playerData, 
                    existingPlayerId: existingPlayerId 
                };
            } else {
                // New player - create account
                // Character names must be unique, but this is already enforced by file system
                // Check if someone with this name is currently logged in (shouldn't happen)
                let existingPlayerId = null;
                if (this.playersByName.has(username.toLowerCase())) {
                    existingPlayerId = this.playersByName.get(username.toLowerCase());
                    console.warn(`WARNING: Creating new character ${username} but name is in active session: ${existingPlayerId}`);
                    
                    // Clean up the existing session data
                    this.players.delete(existingPlayerId);
                    this.playersByName.delete(username.toLowerCase());
                }
                
                const salt = crypto.randomBytes(32).toString('hex');
                const passwordHash = this.hashPassword(password, salt);
                
                const newPlayer = {
                    name: username,
                    passwordHash,
                    salt,
                    ...this.playerDefaults,
                    created: Date.now(),
                    lastLogin: Date.now()
                };
                
                // Save new player
                fs.writeFileSync(playerFile, JSON.stringify(newPlayer, null, 2));
                
                // Load into memory
                this.players.set(playerId, {
                    ...newPlayer,
                    id: playerId,
                    lastActivity: Date.now()
                });
                this.playersByName.set(username.toLowerCase(), playerId);
                
                return { 
                    success: true, 
                    isNewPlayer: true, 
                    player: newPlayer, 
                    existingPlayerId: existingPlayerId 
                };
            }
        } catch (error) {
            console.error('Error authenticating player:', error);
            return { success: false, errorCode: ErrorCodes.AUTHENTICATION_FAILED };
        }
    }

    /**
     * Remove player from active players
     * @param {string} playerId - Socket ID
     */
    disconnectPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            // Save player data before disconnect
            this.savePlayer(playerId);
            
            // Remove from active players
            console.log(`Cleaning up player ${player.name} (${playerId}) from playersByName and players maps`);
            this.playersByName.delete(player.name.toLowerCase());
            this.players.delete(playerId);
            
            console.log(`Player ${player.name} disconnected and cleaned up`);
        } else {
            console.log(`No player data found for playerId: ${playerId} during disconnect`);
        }
    }

    /**
     * Get player data
     * @param {string} playerId - Socket ID
     * @returns {Object|null} Player data
     */
    getPlayer(playerId) {
        return this.players.get(playerId) || null;
    }

    /**
     * Get all players in a specific room
     * @param {string} location - Room ID
     * @returns {string[]} Array of player IDs
     */
    getPlayersInRoom(location) {
        const playersInRoom = [];
        for (const [playerId, player] of this.players) {
            if (player.location === location) {
                playersInRoom.push(playerId);
            }
        }
        return playersInRoom;
    }

    /**
     * Get player by name
     * @param {string} playerName - Player name
     * @returns {Object|null} Player object or null if not found
     */
    getPlayerByName(playerName) {
        const playerId = this.playersByName.get(playerName.toLowerCase());
        if (playerId) {
            return this.players.get(playerId) || null;
        }
        return null;
    }

    /**
     * Move player to new location
     * @param {string} playerId - Socket ID
     * @param {string} newLocation - Room ID
     */
    movePlayer(playerId, newLocation) {
        const player = this.players.get(playerId);
        if (player) {
            player.location = newLocation;
            player.lastActivity = Date.now();
        }
    }

    /**
     * Save player data to file
     * @param {string} playerId - Socket ID
     */
    savePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        try {
            const playerFile = path.join(this.playersDir, `${player.name}.json`);
            const saveData = { ...player };
            
            // Remove runtime-only properties
            delete saveData.id;
            delete saveData.lastActivity;
            
            // Update last login
            saveData.lastLogin = Date.now();
            
            fs.writeFileSync(playerFile, JSON.stringify(saveData, null, 2));
        } catch (error) {
            console.error(`Error saving player ${player.name}:`, error);
        }
    }

    /**
     * Hash password with salt
     * @param {string} password - Plain password
     * @param {string} salt - Salt string
     * @returns {string} Hashed password
     */
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    }

    /**
     * Verify password against hash
     * @param {string} password - Plain password
     * @param {string} hash - Stored hash
     * @param {string} salt - Salt string
     * @returns {boolean} Password valid
     */
    verifyPassword(password, hash, salt) {
        const testHash = this.hashPassword(password, salt);
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
    }

    /**
     * Load player defaults from template file
     * @returns {Object} Player defaults
     */
    loadPlayerDefaults() {
        try {
            const defaultsFile = 'templates/player_defaults.json';
            if (fs.existsSync(defaultsFile)) {
                const defaults = JSON.parse(fs.readFileSync(defaultsFile, 'utf8'));
                console.log(`Loaded player defaults: starting location = ${defaults.startingLocation}`);
                return {
                    location: defaults.startingLocation,
                    level: defaults.level,
                    health: defaults.health,
                    maxHealth: defaults.maxHealth,
                    inventory: { ...defaults.inventory },
                    equipment: { ...defaults.equipment },
                    stats: { ...defaults.stats },
                    experience: defaults.experience,
                    gold: defaults.gold
                };
            } else {
                console.warn('Player defaults file not found, using fallback defaults');
                return {
                    location: 'town_area.town_square',
                    level: 1,
                    health: 100,
                    maxHealth: 100,
                    inventory: { items: [], maxSlots: 20 },
                    equipment: { main_hand: null, off_hand: null, head: null, chest: null, legs: null, feet: null, hands: null },
                    stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                    experience: 0,
                    gold: 50
                };
            }
        } catch (error) {
            console.error('Error loading player defaults:', error);
            throw new Error('Failed to load player defaults');
        }
    }

    /**
     * Get online player count
     * @returns {number} Number of online players
     */
    getOnlineCount() {
        return this.players.size;
    }
}