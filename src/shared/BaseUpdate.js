/**
 * Base Update Class - parent class for all game updates
 * Updates are sent from server to client to communicate game state changes
 */
export class BaseUpdate {
    /**
     * Create a new update
     * @param {string|string[]} playerId - Single player ID or array of player IDs
     * @param {string} type - Update type
     * @param {Object} data - Update data
     */
    constructor(playerId, type, data = {}) {
        this.playerId = playerId;
        this.type = type;
        this.data = data;
        this.timestamp = Date.now();
        
        // Provide affectedPlayers for UpdateDistributor compatibility
        this.affectedPlayers = Array.isArray(playerId) ? playerId : [playerId];
    }
    
    /**
     * Serialize update for network transmission
     * @returns {Object} Serializable update data
     */
    serialize() {
        return {
            playerId: this.playerId,
            type: this.type,
            data: this.data,
            timestamp: this.timestamp
        };
    }
}