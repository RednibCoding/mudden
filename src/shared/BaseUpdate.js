/**
 * Base Update Class - parent class for all game updates
 * Updates are sent from server to client to communicate game state changes
 */
export class BaseUpdate {
    constructor(playerId, type, data = {}) {
        this.playerId = playerId;
        this.type = type;
        this.data = data;
        this.timestamp = Date.now();
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