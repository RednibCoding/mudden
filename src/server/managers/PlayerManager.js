/**
 * Player Manager - handles player data, authentication, and state
 * Provides clean interface for player operations
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class PlayerManager {
    constructor() {
        this.players = new Map(); // playerId -> player data
        this.playersByName = new Map(); // playerName -> playerId
        this.playersDir = 'persist/players';
        
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
                    return { success: false, error: 'Invalid username or password' };
                }
                
                // Check for duplicate login
                if (this.playersByName.has(username.toLowerCase())) {
                    return { success: false, error: 'Player is already logged in' };
                }
                
                // Load player data
                this.players.set(playerId, {
                    ...playerData,
                    id: playerId,
                    lastActivity: Date.now()
                });
                this.playersByName.set(username.toLowerCase(), playerId);
                
                return { success: true, isNewPlayer: false, player: playerData };
            } else {
                // New player - create account
                const salt = crypto.randomBytes(32).toString('hex');
                const passwordHash = this.hashPassword(password, salt);
                
                const newPlayer = {
                    name: username,
                    passwordHash,
                    salt,
                    location: 'town_square', // Default starting location
                    level: 1,
                    health: 100,
                    maxHealth: 100,
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
                
                return { success: true, isNewPlayer: true, player: newPlayer };
            }
        } catch (error) {
            console.error('Error authenticating player:', error);
            return { success: false, error: 'Authentication failed' };
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
            this.playersByName.delete(player.name.toLowerCase());
            this.players.delete(playerId);
            
            console.log(`Player ${player.name} disconnected`);
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
     * Get online player count
     * @returns {number} Number of online players
     */
    getOnlineCount() {
        return this.players.size;
    }
}