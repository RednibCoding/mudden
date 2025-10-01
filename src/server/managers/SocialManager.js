import { ErrorCodes } from '../../shared/ErrorCodes.js';

/**
 * Social Manager - handles social interactions between players
 * Manages chat, messaging, and social features
 */
export class SocialManager {
    constructor() {
        // Could store chat history, blocked players, etc. in the future
        this.chatHistory = new Map(); // roomId -> array of recent messages
        this.maxHistoryPerRoom = 50;
    }

    /**
     * Broadcast a message to all players in a room
     * @param {string} speakerId - Socket ID of the speaking player
     * @param {string} message - Message content
     * @param {Object} playerManager - Player manager instance
     * @returns {Object} Result with message data for all room players
     */
    broadcastSay(speakerId, message, playerManager) {
        const speaker = playerManager.getPlayer(speakerId);
        if (!speaker) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // Get all players in the same room
        const playersInRoom = playerManager.getPlayersInRoom(speaker.location);
        
        // Store message in chat history
        this.addToChatHistory(speaker.location, {
            type: 'say',
            speaker: speaker.name,
            message: message,
            timestamp: Date.now()
        });

        // Prepare message data for each player
        const messageData = [];
        for (const roomPlayerId of playersInRoom) {
            if (roomPlayerId === speakerId) {
                // Confirmation message for the speaker
                messageData.push({
                    playerId: roomPlayerId,
                    type: 'say_self',
                    message: message,
                    speaker: speaker.name
                });
            } else {
                // Message for other players
                messageData.push({
                    playerId: roomPlayerId,
                    type: 'say_other',
                    message: message,
                    speaker: speaker.name
                });
            }
        }

        return {
            success: true,
            messageData: messageData,
            location: speaker.location
        };
    }

    /**
     * Send a private message to a specific player
     * @param {string} senderId - Socket ID of the sender
     * @param {string} targetPlayerName - Name of the target player
     * @param {string} message - Message content
     * @param {Object} playerManager - Player manager instance
     * @returns {Object} Result with message data for sender and recipient
     */
    sendTell(senderId, targetPlayerName, message, playerManager) {
        const sender = playerManager.getPlayer(senderId);
        if (!sender) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // Find target player by name
        const targetPlayer = playerManager.getPlayerByName(targetPlayerName);
        if (!targetPlayer) {
            return { 
                success: false, 
                errorCode: ErrorCodes.PLAYER_NOT_FOUND,
                targetPlayer: targetPlayerName
            };
        }

        // Prepare message data for both players
        const messageData = [
            // Message for the recipient
            {
                playerId: targetPlayer.id,
                type: 'tell_received',
                message: message,
                sender: sender.name
            },
            // Confirmation for the sender
            {
                playerId: senderId,
                type: 'tell_sent',
                message: message,
                recipient: targetPlayer.name
            }
        ];

        return {
            success: true,
            messageData: messageData,
            sender: sender.name,
            recipient: targetPlayer.name
        };
    }

    /**
     * Broadcast an emote action to all players in a room
     * @param {string} actorId - Socket ID of the acting player
     * @param {string} action - Emote action text
     * @param {Object} playerManager - Player manager instance
     * @returns {Object} Result with emote data for all room players
     */
    broadcastEmote(actorId, action, playerManager) {
        const actor = playerManager.getPlayer(actorId);
        if (!actor) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // Get all players in the same room
        const playersInRoom = playerManager.getPlayersInRoom(actor.location);
        
        // Store emote in chat history
        this.addToChatHistory(actor.location, {
            type: 'emote',
            actor: actor.name,
            action: action,
            timestamp: Date.now()
        });

        // Prepare emote data for all players in room
        const messageData = [];
        for (const roomPlayerId of playersInRoom) {
            messageData.push({
                playerId: roomPlayerId,
                type: 'emote',
                action: action,
                actor: actor.name
            });
        }

        return {
            success: true,
            messageData: messageData,
            location: actor.location
        };
    }

    /**
     * Get recent chat history for a room
     * @param {string} roomId - Room identifier
     * @param {number} limit - Maximum number of messages to return
     * @returns {Array} Array of recent messages
     */
    getChatHistory(roomId, limit = 10) {
        const history = this.chatHistory.get(roomId) || [];
        return history.slice(-limit);
    }

    /**
     * Add a message to room chat history
     * @param {string} roomId - Room identifier
     * @param {Object} messageData - Message data object
     * @private
     */
    addToChatHistory(roomId, messageData) {
        if (!this.chatHistory.has(roomId)) {
            this.chatHistory.set(roomId, []);
        }
        
        const history = this.chatHistory.get(roomId);
        history.push(messageData);
        
        // Trim history if it exceeds max size
        if (history.length > this.maxHistoryPerRoom) {
            history.splice(0, history.length - this.maxHistoryPerRoom);
        }
    }

    /**
     * Clear chat history for a room (admin function)
     * @param {string} roomId - Room identifier
     */
    clearChatHistory(roomId) {
        this.chatHistory.delete(roomId);
    }

    /**
     * Get all active chat rooms with recent activity
     * @returns {Array} Array of room IDs with recent messages
     */
    getActiveChatRooms() {
        return Array.from(this.chatHistory.keys()).filter(roomId => {
            const history = this.chatHistory.get(roomId);
            return history && history.length > 0;
        });
    }
    
    /**
     * Handle talking to an NPC (initial greeting)
     * @param {string} playerId - Socket ID of the player
     * @param {string} npcId - NPC identifier
     * @param {Object} playerManager - Player manager instance
     * @param {Object} worldManager - World manager instance  
     * @param {Object} templateManager - Template manager instance
     * @returns {Object} Result with NPC greeting and available topics
     */
    processTalkToNpc(playerId, npcId, playerManager, worldManager, templateManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // Get the room and check if NPC is present
        const room = worldManager.getRoom(player.location);
        if (!room || !room.npcs || !room.npcs.includes(npcId)) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_FOUND };
        }

        // Get NPC template
        const npcTemplate = templateManager.getNPC(npcId);
        if (!npcTemplate) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_FOUND };
        }

        // Check if NPC has dialogue
        if (!npcTemplate.dialogue || !npcTemplate.dialogue.greeting) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_RESPONSIVE };
        }

        // Get available topics (keys from responses)
        const availableTopics = npcTemplate.dialogue.responses ? 
            Object.keys(npcTemplate.dialogue.responses) : [];

        return {
            success: true,
            npcName: npcTemplate.name,
            message: npcTemplate.dialogue.greeting,
            availableTopics: availableTopics
        };
    }
    
    /**
     * Handle asking an NPC about a specific topic
     * @param {string} playerId - Socket ID of the player
     * @param {string} npcId - NPC identifier
     * @param {string} topic - Topic to ask about
     * @param {Object} playerManager - Player manager instance
     * @param {Object} worldManager - World manager instance  
     * @param {Object} templateManager - Template manager instance
     * @returns {Object} Result with NPC response to the topic
     */
    processAskNpc(playerId, npcId, topic, playerManager, worldManager, templateManager) {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, errorCode: ErrorCodes.PLAYER_NOT_FOUND };
        }

        // Get the room and check if NPC is present
        const room = worldManager.getRoom(player.location);
        if (!room || !room.npcs || !room.npcs.includes(npcId)) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_FOUND };
        }

        // Get NPC template
        const npcTemplate = templateManager.getNPC(npcId);
        if (!npcTemplate) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_FOUND };
        }

        // Check if NPC has dialogue responses
        if (!npcTemplate.dialogue || !npcTemplate.dialogue.responses) {
            return { success: false, errorCode: ErrorCodes.NPC_NOT_RESPONSIVE };
        }

        // Find response for the topic (case-insensitive)
        const topicLower = topic.toLowerCase();
        const response = npcTemplate.dialogue.responses[topicLower];
        
        if (!response) {
            return {
                success: false,
                errorCode: ErrorCodes.INVALID_TOPIC,
                npcId: npcId,
                topic: topic
            };
        }

        return {
            success: true,
            npcName: npcTemplate.name,
            topic: topic,
            message: response
        };
    }
}