// Import client-side constants
import { ErrorCodes } from './ErrorCodes.js';
import { UpdateTypes } from './UpdateTypes.js';
import { CommandTypes } from './CommandTypes.js';

/**
 * Mudden v2 Client - Clean Architecture Implementation
 * Uses local constants to avoid server dependency
 */
class MuddenClient {
    constructor() {
        // Connect to WebSocket server (adjust URL as needed)
        this.socket = io('http://localhost:3000');
        this.gameState = new GameState();
        this.commandHandler = new CommandHandler(this.socket, this.gameState);
        this.updateHandler = new UpdateHandler(this.gameState);
        
        this.setupSocketEventHandlers();
        this.setupUIEventHandlers();
        
        console.log('Mudden v2 Client initialized');
    }
    
    setupSocketEventHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            document.getElementById('connectionStatus').textContent = 'Connected';
            document.getElementById('connectionStatus').className = 'connected';
            this.addToOutput('🟢 Connected to Mudden v2 server!', 'success');
        });

        this.socket.on('disconnect', () => {
            document.getElementById('connectionStatus').textContent = 'Disconnected';
            document.getElementById('connectionStatus').className = 'disconnected';
            this.addToOutput('🔴 Disconnected from server.', 'error');
            this.showAuthForm();
        });

        // Authentication
        this.socket.on('authResult', (result) => {
            this.handleAuthResult(result);
        });

        // Game updates
        this.socket.on('gameUpdate', (updates) => {
            for (const update of updates) {
                this.updateHandler.handleUpdate(update);
            }
        });
    }
    
    setupUIEventHandlers() {
        // Auto-focus username field on load
        document.addEventListener('DOMContentLoaded', () => {
            this.showAuthForm();
            document.getElementById('username').focus();
        });
        
        // Add authentication function to global scope for onclick handler
        window.authenticate = () => this.authenticate();
        
        // Add command handling functions to global scope
        window.sendCommand = () => this.sendCommand();
        window.handleKeyPress = (event) => this.handleKeyPress(event);
    }
    
    authenticate() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.addToOutput('❌ Please enter both username and password', 'error');
            return;
        }
        
        this.addToOutput(`🔐 Authenticating as ${username}...`, 'info');
        this.socket.emit('authenticate', { username, password });
    }
    
    handleAuthResult(result) {
        if (result.success) {
            this.gameState.isAuthenticated = true;
            this.gameState.updatePlayer({
                name: result.player.name,
                level: result.player.level || 1,
                health: result.player.health || 100,
                maxHealth: result.player.maxHealth || 100,
                experience: result.player.experience || 0,
                location: result.player.location || 'town_square'
            });
            
            this.hideAuthForm();
            this.showGameUI();
            
            if (result.isNewPlayer) {
                this.addToOutput(`🎉 Welcome to Mudden, ${this.gameState.player.name}! New character created.`, 'success');
            } else {
                this.addToOutput(`👋 Welcome back, ${this.gameState.player.name}!`, 'success');
            }
            
            // Request initial room state
            this.commandHandler.sendGameCommand('look');
        } else {
            this.addToOutput(`❌ Authentication failed: ${result.error}`, 'error');
        }
    }
    
    sendCommand() {
        const input = document.getElementById('commandInput');
        const command = input.value.trim();
        if (command && this.gameState.isAuthenticated) {
            this.commandHandler.sendGameCommand(command);
            input.value = '';
        }
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.sendCommand();
        }
    }
    
    addToOutput(text, className = '') {
        const output = document.getElementById('gameOutput');
        const span = document.createElement('span');
        if (className) {
            span.className = className;
        }
        span.textContent = text + '\n';
        output.appendChild(span);
        output.scrollTop = output.scrollHeight;
    }
    
    showAuthForm() {
        document.getElementById('authForm').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        this.hideGameUI();
        this.gameState.isAuthenticated = false;
        this.gameState.player.name = '';
    }

    hideAuthForm() {
        document.getElementById('authForm').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.getElementById('commandInput').focus();
    }
    
    showGameUI() {
        document.getElementById('playerStats').style.display = 'block';
        document.getElementById('equipment').style.display = 'block';
        document.getElementById('quickInventory').style.display = 'block';
        this.gameState.refreshUI();
    }
    
    hideGameUI() {
        document.getElementById('playerStats').style.display = 'none';
        document.getElementById('equipment').style.display = 'none';
        document.getElementById('quickInventory').style.display = 'none';
    }
}

/**
 * Game State Management
 */
class GameState {
    constructor() {
        this.isAuthenticated = false;
        this.player = {
            name: '',
            level: 1,
            health: 100,
            maxHealth: 100,
            experience: 0,
            expToNext: 100,
            location: ''
        };
        this.inventory = [];
        this.equipment = {};
        this.itemNames = {};
    }
    
    updatePlayer(playerData) {
        Object.assign(this.player, playerData);
        this.refreshUI();
    }
    
    updateInventory(inventoryData) {
        this.inventory = inventoryData;
        this.refreshInventoryUI();
    }
    
    updateEquipment(equipmentData) {
        this.equipment = equipmentData;
        this.refreshEquipmentUI();
    }
    
    updateItemNames(itemNames) {
        this.itemNames = itemNames || {};
    }
    
    refreshUI() {
        if (!this.isAuthenticated) return;
        
        // Update player info
        document.getElementById('playerInfo').textContent = 
            `Player: ${this.player.name} (Level ${this.player.level})`;
        
        // Update health bar
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('healthBar').style.width = healthPercent + '%';
        document.getElementById('healthText').textContent = 
            `${this.player.health}/${this.player.maxHealth}`;
        
        // Update level
        document.getElementById('playerLevel').textContent = this.player.level;
        
        // Update experience bar
        const expPercent = (this.player.experience / this.player.expToNext) * 100;
        document.getElementById('expBar').style.width = expPercent + '%';
        document.getElementById('expText').textContent = 
            `${this.player.experience}/${this.player.expToNext}`;
    }
    
    refreshInventoryUI() {
        const inventoryList = document.getElementById('inventoryList');
        if (this.inventory.length === 0) {
            inventoryList.innerHTML = '<div style="color: #888;">Empty</div>';
            return;
        }
        
        inventoryList.innerHTML = this.inventory.map(item => {
            const displayName = this.itemNames && this.itemNames[item.id] ? this.itemNames[item.id] : item.id;
            return `<div title="${item.id}">${displayName} (${item.quantity})</div>`;
        }).join('');
    }
    
    refreshEquipmentUI() {
        const slots = ['main_hand', 'off_hand', 'head', 'chest', 'legs', 'feet', 'hands'];
        slots.forEach(slot => {
            const element = document.getElementById(`slot-${slot}`);
            if (element) {
                element.textContent = this.equipment[slot] ? this.equipment[slot].id : 'None';
            }
        });
    }
}

/**
 * Command Handler - handles client-side command parsing and sending
 */
class CommandHandler {
    constructor(socket, gameState) {
        this.socket = socket;
        this.gameState = gameState;
    }
    
    sendGameCommand(commandText) {
        // Parse command and send appropriate format using CommandTypes
        const parts = commandText.toLowerCase().split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        let commandData = null;

        switch (cmd) {
            case 'move':
            case 'go':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.MOVE,
                        direction: args[0]
                    };
                }
                break;
                
            case 'north':
            case 'south':
            case 'east':
            case 'west':
            case 'n':
            case 's':
            case 'e':
            case 'w':
                const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west' };
                commandData = {
                    type: CommandTypes.MOVE,
                    direction: dirMap[cmd] || cmd
                };
                break;
                
            case 'take':
            case 'get':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.TAKE_ITEM,
                        itemId: args[0],
                        quantity: args[1] ? parseInt(args[1]) : 1
                    };
                }
                break;
                
            case 'look':
            case 'l':
                commandData = {
                    type: CommandTypes.LOOK
                };
                break;
                
            case 'say':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.SAY,
                        message: args.join(' ')
                    };
                }
                break;
                
            case 'equip':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.EQUIP_ITEM,
                        itemId: args[0],
                        slot: args[1] || null
                    };
                }
                break;
                
            case 'inventory':
            case 'inv':
            case 'i':
                commandData = {
                    type: CommandTypes.SHOW_INVENTORY
                };
                break;
                
            case 'drop':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.DROP_ITEM,
                        itemId: args[0],
                        quantity: args[1] ? parseInt(args[1]) : 1
                    };
                }
                break;
                
            case 'tell':
            case 't':
                if (args.length > 1) {
                    commandData = {
                        type: CommandTypes.TELL,
                        targetPlayer: args[0],
                        message: args.slice(1).join(' ')
                    };
                }
                break;
                
            case 'emote':
            case 'em':
                if (args.length > 0) {
                    commandData = {
                        type: CommandTypes.EMOTE,
                        action: args.join(' ')
                    };
                }
                break;
                
            default:
                client.addToOutput(`❓ Unknown command: ${cmd}. Type a command or check the help above.`, 'error');
                return;
        }

        if (commandData) {
            this.socket.emit('gameCommand', commandData);
            client.addToOutput(`> ${commandText}`);
        }
    }
}

/**
 * Update Handler - processes game updates using UpdateTypes constants
 */
class UpdateHandler {
    constructor(gameState) {
        this.gameState = gameState;
        
        // Error message mapping - client controls presentation and language
        this.errorMessages = {
            [ErrorCodes.UNKNOWN_ERROR]: 'An unknown error occurred',
            [ErrorCodes.INVALID_COMMAND]: 'Invalid command',
            [ErrorCodes.PLAYER_NOT_FOUND]: 'Player not found',
            [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
            
            [ErrorCodes.NO_EXIT]: (data) => `You cannot go ${data.direction || 'that way'} from here`,
            [ErrorCodes.EXIT_BLOCKED]: 'That exit is blocked',
            [ErrorCodes.INSUFFICIENT_LEVEL]: 'Your level is too low',
            [ErrorCodes.ROOM_NOT_FOUND]: 'Room not found',
            
            [ErrorCodes.ITEM_NOT_FOUND]: (data) => `Item ${data.itemId || 'unknown'} not found`,
            [ErrorCodes.ITEM_NOT_IN_INVENTORY]: (data) => `You don't have ${data.itemId || 'that item'} in your inventory`,
            [ErrorCodes.INVENTORY_FULL]: 'Your inventory is full',
            [ErrorCodes.INSUFFICIENT_QUANTITY]: (data) => `You don't have ${data.quantity || 1} of that item`,
            [ErrorCodes.ITEM_NOT_USABLE]: (data) => `${data.itemId || 'That item'} cannot be used`,
            
            [ErrorCodes.ITEM_NOT_EQUIPPABLE]: (data) => `${data.itemId || 'That item'} cannot be equipped`,
            [ErrorCodes.WRONG_EQUIPMENT_SLOT]: 'Wrong equipment slot',
            [ErrorCodes.SLOT_ALREADY_OCCUPIED]: 'Equipment slot is already occupied'
        };

        // Success message mapping for actions
        this.actionMessages = {
            take: (data) => `You take ${data.quantity || 1} ${this.getItemDisplayName(data.itemId, data.itemNames)}`,
            drop: (data) => `You drop ${data.quantity || 1} ${this.getItemDisplayName(data.itemId, data.itemNames)}`,
            use: (data) => `You use ${this.getItemDisplayName(data.itemId, data.itemNames)}`,
            equip: (data) => `You equip ${this.getItemDisplayName(data.itemId, data.itemNames)}`,
            unequip: (data) => `You unequip ${this.getItemDisplayName(data.itemId, data.itemNames)}`
        };
    }
    
    handleUpdate(update) {
        switch (update.type) {
            case UpdateTypes.ROOM_STATE_CHANGED:
                this.handleRoomStateChanged(update);
                break;
                
            case UpdateTypes.INVENTORY_CHANGED:
                this.handleInventoryChanged(update);
                break;
                
            case UpdateTypes.EQUIPMENT_CHANGED:
                this.handleEquipmentChanged(update);
                break;
                
            case UpdateTypes.MESSAGE_RECEIVED:
                if (update.data.message) {
                    client.addToOutput(`💬 ${update.data.message}`);
                }
                break;
            
            case UpdateTypes.SOCIAL_MESSAGE:
                this.handleSocialMessage(update);
                break;
                
            case UpdateTypes.COMMAND_ERROR:
                this.handleCommandError(update);
                break;
                
            case UpdateTypes.SERVER_MESSAGE:
                this.handleServerMessage(update);
                break;
                
            default:
                client.addToOutput(`🔧 Unknown update: ${JSON.stringify(update)}`);
        }
    }
    
    handleRoomStateChanged(update) {
        if (update.data.name) {
            client.addToOutput(`\n📍 === ${update.data.name} ===`, 'info');
            client.addToOutput(update.data.description);
            
            if (update.data.exits && update.data.exits.length > 0) {
                client.addToOutput(`🚪 Exits: ${update.data.exits.join(', ')}`, 'info');
            }
            
            if (update.data.items && update.data.items.length > 0) {
                const itemList = update.data.items.map(i => {
                    const name = update.data.itemNames && update.data.itemNames[i.id] ? update.data.itemNames[i.id] : i.id;
                    return `${name} (${i.quantity})`;
                }).join(', ');
                client.addToOutput(`📦 Items: ${itemList}`, 'info');
            }
            
            if (update.data.npcs && update.data.npcs.length > 0) {
                client.addToOutput(`👥 NPCs: ${update.data.npcs.join(', ')}`, 'info');
            }
            
            if (update.data.players && update.data.players.length > 1) {
                const otherPlayers = update.data.players.filter(p => p !== client.socket.id);
                if (otherPlayers.length > 0) {
                    client.addToOutput(`👤 Players: ${otherPlayers.length} other player(s)`, 'info');
                }
            }
        }
        if (update.data.message) {
            client.addToOutput(update.data.message);
        }
        if (update.data.itemNames) {
            this.gameState.updateItemNames(update.data.itemNames);
        }
    }
    
    handleInventoryChanged(update) {
        if (update.data.action && this.actionMessages[update.data.action]) {
            const message = this.actionMessages[update.data.action](update.data);
            client.addToOutput(`🎒 ${message}`, 'success');
        }
        if (update.data.inventory) {
            this.gameState.updateInventory(update.data.inventory);
        }
        if (update.data.itemNames) {
            this.gameState.updateItemNames(update.data.itemNames);
        }
    }
    
    handleEquipmentChanged(update) {
        if (update.data.message) {
            client.addToOutput(`⚔️ ${update.data.message}`, 'success');
        }
        if (update.data.equipment) {
            this.gameState.updateEquipment(update.data.equipment);
        }
    }
    
    handleSocialMessage(update) {
        if (update.data.type === 'say_self') {
            client.addToOutput(`💬 You say: "${update.data.message}"`, 'success');
        } else if (update.data.type === 'say_other') {
            client.addToOutput(`💬 ${update.data.speaker} says: "${update.data.message}"`);
        } else if (update.data.type === 'tell_received') {
            client.addToOutput(`📞 ${update.data.sender} tells you: "${update.data.message}"`, 'info');
        } else if (update.data.type === 'tell_sent') {
            client.addToOutput(`📞 You tell ${update.data.recipient}: "${update.data.message}"`, 'success');
        } else if (update.data.type === 'emote') {
            client.addToOutput(`🎭 ${update.data.actor} ${update.data.action}`, 'emote');
        }
    }
    
    handleCommandError(update) {
        if (update.data.errorCode) {
            const errorMessage = this.formatErrorMessage(update.data.errorCode, update.data);
            client.addToOutput(`❌ ${errorMessage}`, 'error');
        } else if (update.data.message) {
            // Fallback for legacy string messages
            client.addToOutput(`❌ ERROR: ${update.data.message}`, 'error');
        }
    }
    
    handleServerMessage(update) {
        if (update.data.action && this.actionMessages[update.data.action]) {
            const message = this.actionMessages[update.data.action](update.data);
            client.addToOutput(`📢 ${message}`, 'info');
        } else if (update.data.message) {
            // Fallback for legacy string messages
            client.addToOutput(`📢 ${update.data.message}`, 'info');
        }
    }
    
    getItemDisplayName(itemId, itemNames) {
        return (itemNames && itemNames[itemId]) ? itemNames[itemId] : itemId;
    }
    
    formatErrorMessage(errorCode, data = {}) {
        const message = this.errorMessages[errorCode];
        if (typeof message === 'function') {
            return message(data);
        }
        return message || `Unknown error (${errorCode})`;
    }
}

// Initialize client when the page loads
let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new MuddenClient();
});