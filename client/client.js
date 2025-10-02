// Mudden Client JavaScript
class MudClient {
    constructor() {
        this.socket = null;
        this.authenticated = false;
        this.commandHistory = [];
        this.historyIndex = -1;
        
        this.initializeElements();
        this.setupEventListeners();
        this.connect();
    }
    
    initializeElements() {
        this.loginScreen = document.getElementById('login-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('login-btn');
        this.registerBtn = document.getElementById('register-btn');
        this.loginError = document.getElementById('login-error');
        this.output = document.getElementById('output');
        this.commandInput = document.getElementById('command-input');
        this.logoutBtn = document.getElementById('logout-btn');
    }
    
    setupEventListeners() {
        // Login form
        this.loginBtn.addEventListener('click', () => this.login());
        this.registerBtn.addEventListener('click', () => this.register());
        
        // Logout button
        this.logoutBtn.addEventListener('click', () => this.logout());
        
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.passwordInput.focus();
            }
        });
        
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
        
        // Command input
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendCommand();
            }
        });
        
        this.commandInput.addEventListener('keydown', (e) => {
            // Command history navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
        
        // Focus command input when clicking anywhere in game area
        document.addEventListener('click', (e) => {
            // Only focus if game screen is visible and we're not clicking on form elements
            if (this.authenticated && !this.loginScreen.style.display !== 'none') {
                const target = e.target;
                
                // Don't refocus if clicking on input elements or buttons
                if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
                    // Don't focus if user has selected text
                    const selection = window.getSelection();
                    if (selection.toString().length === 0) {
                        this.commandInput.focus();
                    }
                }
            }
        });
    }
    
    connect() {
        this.socket = io('http://localhost:3000', {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000
        });
        
        this.socket.on('connect', () => {
            this.addMessage('Connected to Mudden server.', 'success');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.addMessage('Disconnected from server.', 'error');
            this.authenticated = false;
            this.showLoginScreen();
            
            // Auto-reconnect after a short delay if not a voluntary disconnect
            if (reason !== 'io client disconnect') {
                this.addMessage('Attempting to reconnect...', 'system');
            }
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            this.addMessage(`Reconnected to server (attempt ${attemptNumber}).`, 'success');
        });
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            this.addMessage(`Reconnection attempt ${attemptNumber}...`, 'system');
        });
        
        this.socket.on('reconnect_failed', () => {
            this.addMessage('Failed to reconnect to server. Please refresh the page.', 'error');
        });
        
        this.socket.on('message', (msg) => {
            this.handleServerMessage(msg);
        });
        
        this.socket.on('connect_error', (error) => {
            this.addMessage('Connection failed: ' + error.message, 'error');
        });
    }
    
    login() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!username || !password) {
            this.showLoginError('Please enter username and password');
            return;
        }
        
        this.socket.emit('message', {
            type: 'login',
            data: { username, password }
        });
    }
    
    register() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!username || !password) {
            this.showLoginError('Please enter username and password');
            return;
        }
        
        if (password.length < 4) {
            this.showLoginError('Password must be at least 4 characters');
            return;
        }
        
        this.socket.emit('message', {
            type: 'register',
            data: { username, password }
        });
    }
    
    sendCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;
        
        // Add to history only if different from the previous command
        if (this.commandHistory.length === 0 || this.commandHistory[0] !== command) {
            this.commandHistory.unshift(command);
            if (this.commandHistory.length > 50) {
                this.commandHistory.pop();
            }
        }
        this.historyIndex = -1;
        
        // Display command
        this.addMessage('\n> ' + command, 'echo');
        
        // Send to server
        this.socket.emit('message', {
            type: 'command',
            data: { command }
        });
        
        // Clear input
        this.commandInput.value = '';
    }
    
    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;
        
        this.historyIndex -= direction;
        
        if (this.historyIndex < 0) {
            this.historyIndex = -1;
            this.commandInput.value = '';
        } else if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length - 1;
        }
        
        if (this.historyIndex >= 0) {
            this.commandInput.value = this.commandHistory[this.historyIndex];
        }
    }
    
    handleServerMessage(msg) {
        switch (msg.type) {
            case 'auth':
                if (msg.data.success) {
                    this.authenticated = true;
                    this.showGameScreen();
                    this.addMessage('Welcome to Mudden!', 'success');
                    this.addMessage('Type "help" for available commands.', 'system');
                    // Auto-look when entering game
                    setTimeout(() => {
                        this.socket.emit('message', {
                            type: 'command',
                            data: { command: 'look' }
                        });
                    }, 500);
                } else {
                    this.showLoginError('Authentication failed');
                }
                break;
                
            case 'message':
                this.addMessage(msg.data.text, msg.data.type || 'normal');
                break;
                
            case 'error':
                this.addMessage('Error: ' + msg.data, 'error');
                if (!this.authenticated) {
                    this.showLoginError(msg.data);
                }
                break;
                
            case 'quit':
                // Handle server-initiated logout (quit/logout commands)
                this.authenticated = false;
                this.showLoginScreen();
                setTimeout(() => {
                    this.connect();
                }, 500);
                break;
                
            case 'update':
                // Handle game state updates
                break;
        }
    }
    
    addMessage(text, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.style.fontWeight = type === 'pvp-combat' ? 'bold' : 'normal';
        messageDiv.textContent = type == 'pvp-combat' ? "  " + text : text;
        
        this.output.appendChild(messageDiv);
        this.output.scrollTop = this.output.scrollHeight;
        
        // Limit message history
        while (this.output.children.length > 1000) {
            this.output.removeChild(this.output.firstChild);
        }
    }
    
    logout() {
        if (this.authenticated) {
            this.socket.disconnect();
            this.authenticated = false;
            this.showLoginScreen();
            
            // Reconnect after logout to allow immediate re-login
            setTimeout(() => {
                this.connect();
            }, 500);
        }
    }
    
    showLoginScreen() {
        this.loginScreen.style.display = 'flex';
        this.gameScreen.style.display = 'none';
        this.logoutBtn.style.display = 'none';
        this.usernameInput.focus();
        this.clearLoginError();
    }
    
    showGameScreen() {
        this.loginScreen.style.display = 'none';
        this.gameScreen.style.display = 'flex';
        this.logoutBtn.style.display = 'block';
        this.commandInput.focus();
    }
    
    showLoginError(message) {
        this.loginError.textContent = message;
    }
    
    clearLoginError() {
        this.loginError.textContent = '';
    }
}

// Initialize client when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MudClient();
});