// Simple MUD Client
class SimpleMUDClient {
    constructor() {
        this.socket = io()
        this.commandHistory = []
        this.historyIndex = -1
        this.player = null
        this.isLoggedIn = false
        
        this.initializeElements()
        this.setupEventListeners()
        this.setupSocketEvents()
    }

    initializeElements() {
        // Get DOM elements
        this.gameOutput = document.getElementById('game-output')
        this.mainMenu = document.getElementById('main-menu')
        this.loginForm = document.getElementById('login-form')
        this.createForm = document.getElementById('create-form')
        this.commandArea = document.getElementById('command-area')
        this.playerInfo = document.getElementById('player-info')
        
        // Login form elements
        this.playerNameInput = document.getElementById('player-name-input')
        this.playerPasswordInput = document.getElementById('player-password-input')
        this.passwordContainer = document.getElementById('password-container')
        this.loginInfo = document.getElementById('login-info')
        
        // Create form elements
        this.createNameInput = document.getElementById('create-name-input')
        this.createPasswordInput = document.getElementById('create-password-input')
        this.createConfirmInput = document.getElementById('create-confirm-input')
        this.createInfo = document.getElementById('create-info')
        
        // Game elements
        this.commandInput = document.getElementById('command-input')
        this.connectionStatus = document.getElementById('connection-status')
        
        // Player info elements
        this.playerNameSpan = document.getElementById('player-name')
        this.playerLevelSpan = document.getElementById('player-level')
        this.playerHealthSpan = document.getElementById('player-health')
        this.playerMaxHealthSpan = document.getElementById('player-max-health')
        this.playerGoldSpan = document.getElementById('player-gold')
        this.playerLocationSpan = document.getElementById('player-location')
        this.mapContainer = document.getElementById('map-container')
        this.mapGrid = document.getElementById('map-grid')
        this.roomInfoArea = document.getElementById('area-name')
        this.roomInfoName = document.getElementById('room-name')
        this.roomInfoExits = document.getElementById('exits-list')
        
        // These elements were removed in the layout redesign
        // this.roomTitle = document.getElementById('room-title')
        // this.roomExits = document.getElementById('room-exits') 
        // this.combatStatus = document.getElementById('combat-status')
        // this.healthBarFill = document.getElementById('health-bar-fill')
        
        // Game state
        this.currentAreaMap = null
    }

    setupEventListeners() {
        // Login form
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkCharacter()
            }
        })

        this.playerNameInput.addEventListener('input', (e) => {
            // Reset form when name changes
            this.passwordContainer.style.display = 'none'
            this.loginInfo.textContent = ''
        })

        this.playerPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login()
            }
        })

        // Create form
        this.createNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createPasswordInput.focus()
            }
        })

        this.createPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createConfirmInput.focus()
            }
        })

        this.createConfirmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createCharacter()
            }
        })

        // Command input
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendCommand()
            }
        })

        // Command history navigation
        this.commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                this.navigateHistory(1)  // Up arrow goes to older commands
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                this.navigateHistory(-1) // Down arrow goes to newer commands
            }
        })

        // Auto-focus command input
        document.addEventListener('click', () => {
            if (this.isLoggedIn) {
                this.commandInput.focus()
            }
        })
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected', 'connected')
            this.addOutput('Connected to server', 'system-message')
        })

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected', 'disconnected')
            this.addOutput('Disconnected from server', 'error-message')
        })

        this.socket.on('gameState', (data) => {
            this.updateGameState(data)
        })

        this.socket.on('output', (message) => {
            this.addOutput(message)
        })

        this.socket.on('error', (message) => {
            this.addOutput(`Error: ${message}`, 'error-message')
            this.updateConnectionStatus('Connected', 'connected')
            // Keep user in login state if there was an error
        })

        this.socket.on('logout', () => {
            this.logout()
        })

        this.socket.on('forceLogout', () => {
            this.addOutput('Connection terminated - character logged in from another location.', 'error-message')
            this.logout()
            
            // Ensure socket reconnects after forced disconnection
            setTimeout(() => {
                if (!this.socket.connected) {
                    console.log('Attempting to reconnect after force logout...')
                    this.socket.connect()
                }
            }, 1000)
        })

        this.socket.on('loginResponse', (response) => {
            this.handleLoginResponse(response)
        })
        
        this.socket.on('gameState', (state) => {
            this.handleGameState(state)
        })

        this.socket.on('areaMap', (mapData) => {
            this.handleAreaMap(mapData)
        })

        this.socket.on('roomExits', (exitsData) => {
            this.handleRoomExits(exitsData)
        })
    }

    // Menu navigation functions
    showMainMenu() {
        this.mainMenu.style.display = 'flex'
        this.loginForm.style.display = 'none'
        this.createForm.style.display = 'none'
        this.resetForms()
    }

    showLoginForm() {
        this.mainMenu.style.display = 'none'
        this.loginForm.style.display = 'flex'
        this.createForm.style.display = 'none'
        this.resetForms()
        setTimeout(() => this.playerNameInput.focus(), 100)
    }

    showCreateForm() {
        this.mainMenu.style.display = 'none'
        this.loginForm.style.display = 'none'
        this.createForm.style.display = 'flex'
        this.resetForms()
        setTimeout(() => this.createNameInput.focus(), 100)
    }

    resetForms() {
        // Reset login form
        this.playerNameInput.value = ''
        this.playerPasswordInput.value = ''
        this.passwordContainer.style.display = 'none'
        this.loginInfo.textContent = ''
        
        // Reset create form
        this.createNameInput.value = ''
        this.createPasswordInput.value = ''
        this.createConfirmInput.value = ''
        this.createInfo.textContent = ''
    }

    checkCharacter() {
        const playerName = this.playerNameInput.value.trim()
        
        if (!playerName) {
            this.addOutput('Please enter a character name', 'error-message')
            return
        }

        if (playerName.length > 20) {
            this.addOutput('Character name too long (max 20 characters)', 'error-message')
            return
        }

        if (!/^[a-zA-Z0-9_]+$/.test(playerName)) {
            this.addOutput('Character name can only contain letters, numbers, and underscores', 'error-message')
            return
        }

        console.log('Socket connected:', this.socket.connected)
        
        if (!this.socket.connected) {
            this.addOutput('Connecting to server...', 'system-message')
            this.socket.connect()
            
            // Wait for connection before sending request
            this.socket.once('connect', () => {
                this.updateConnectionStatus('Checking character...', 'connecting')
                console.log('Emitting loginRequest for:', playerName)
                this.socket.emit('loginRequest', playerName)
            })
            return
        }
        
        this.updateConnectionStatus('Checking character...', 'connecting')
        console.log('Emitting loginRequest for:', playerName)
        this.socket.emit('loginRequest', playerName)
    }

    handleLoginResponse(response) {
        if (!response.success) {
            this.addOutput(`${response.error}`, 'error-message')
            this.updateConnectionStatus('Connected', 'connected')
            this.loginInfo.textContent = response.error
            return
        }

        const { needsPassword, playerName } = response
        
        if (needsPassword) {
            // Existing character with password
            this.passwordContainer.style.display = 'flex'
            this.loginInfo.textContent = 'Character found. Enter your password.'
            this.playerPasswordInput.focus()
        } else {
            // Existing character without password
            this.loginInfo.textContent = 'Character found (no password protection).'
            this.login()
        }

        this.updateConnectionStatus('Connected', 'connected')
    }

    handleGameState(state) {
        // Successfully logged in - show the game interface
        this.showGameInterface()
        
        // Update player info display
        if (state.player) {
            this.player = state.player
            this.updatePlayerInfo()
        }
        
        this.updateConnectionStatus('Connected', 'connected')
    }

    login() {
        const playerName = this.playerNameInput.value.trim()
        const password = this.playerPasswordInput.value

        if (!playerName) {
            this.addOutput('Please enter a character name', 'error-message')
            return
        }

        this.updateConnectionStatus('Logging in...', 'connecting')
        this.socket.emit('login', { playerName, password })
    }

    createCharacter() {
        const playerName = this.createNameInput.value.trim()
        const password = this.createPasswordInput.value
        const confirmPassword = this.createConfirmInput.value

        if (!playerName) {
            this.createInfo.textContent = 'Please enter a character name'
            this.createNameInput.focus()
            return
        }

        if (playerName.length > 20) {
            this.createInfo.textContent = 'Character name too long (max 20 characters)'
            this.createNameInput.focus()
            return
        }

        if (!/^[a-zA-Z0-9_]+$/.test(playerName)) {
            this.createInfo.textContent = 'Character name can only contain letters, numbers, and underscores'
            this.createNameInput.focus()
            return
        }

        if (!password || password.length < 3) {
            this.createInfo.textContent = 'Password must be at least 3 characters long'
            this.createPasswordInput.focus()
            return
        }

        if (password !== confirmPassword) {
            this.createInfo.textContent = 'Passwords do not match'
            this.createConfirmInput.focus()
            return
        }

        this.updateConnectionStatus('Creating character...', 'connecting')
        this.socket.emit('createCharacter', { playerName, password })
    }
    
    showGameInterface() {
        // Hide all menu forms, show game interface
        this.mainMenu.style.display = 'none'
        this.loginForm.style.display = 'none'
        this.createForm.style.display = 'none'
        this.commandArea.style.display = 'block'
        this.playerInfo.style.display = 'block'
        this.mapContainer.style.display = 'flex'
        document.getElementById('quick-buttons').style.display = 'flex'
        this.isLoggedIn = true
        
        // Focus command input
        setTimeout(() => {
            this.commandInput.focus()
        }, 100)
    }

    logout() {
        // Reset client state
        this.player = null
        this.isLoggedIn = false
        this.commandHistory = []
        this.historyIndex = -1
        this.currentAreaMap = null
        
        // Clear input
        this.commandInput.value = ''
        this.playerNameInput.value = ''
        this.playerPasswordInput.value = ''
        
        // Show main menu, hide game interface
        this.showMainMenu()
        this.commandArea.style.display = 'none'
        this.playerInfo.style.display = 'none'
        this.mapContainer.style.display = 'none'
        document.getElementById('quick-buttons').style.display = 'none'
        
        // Clear game output (optional - you might want to keep chat history)
        // this.gameOutput.innerHTML = '<div class="system-message">Welcome to Simple MUD!<br>Enter your character name to begin your adventure...</div>'
        
        // Add logout message
        this.addOutput('Successfully logged out. Enter a character name to login again.', 'system-message')
        
        // Focus name input with multiple attempts
        setTimeout(() => {
            this.playerNameInput.focus()
            console.log('Input focused after logout')
        }, 100)
        
        // Additional focus attempt
        setTimeout(() => {
            if (document.activeElement !== this.playerNameInput) {
                this.playerNameInput.focus()
                console.log('Input re-focused')
            }
        }, 500)
    }

    sendCommand() {
        const command = this.commandInput.value.trim()
        if (!command) return

        // Only allow commands when logged in
        if (!this.isLoggedIn) {
            this.addOutput('Please log in first', 'error-message')
            return
        }

        // Add to history
        this.commandHistory.unshift(command)
        if (this.commandHistory.length > 50) {
            this.commandHistory.pop()
        }
        this.historyIndex = -1

        // Echo command
        this.addOutput(`> ${command}`, 'command-echo')

        // Send to server
        this.socket.emit('command', command)

        // Clear input
        this.commandInput.value = ''
    }

    sendQuickCommand(command) {
        // Only allow commands when logged in (except logout)
        if (!this.isLoggedIn && command !== 'logout') {
            return
        }
        
        this.commandInput.value = command
        this.sendCommand()
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return

        this.historyIndex += direction
        
        if (this.historyIndex < 0) {
            this.historyIndex = -1
            this.commandInput.value = ''
        } else if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length - 1
        }
        
        if (this.historyIndex >= 0) {
            this.commandInput.value = this.commandHistory[this.historyIndex]
        }
    }

    addOutput(message, className = '') {
        const messageDiv = document.createElement('div')
        messageDiv.textContent = message
        messageDiv.className = `new-message ${className}`
        
        this.gameOutput.appendChild(messageDiv)
        this.gameOutput.scrollTop = this.gameOutput.scrollHeight
        
        // Remove animation class after animation completes
        setTimeout(() => {
            messageDiv.classList.remove('new-message')
        }, 300)
    }

    updateGameState(data) {
        if (data.player) {
            const previousRoom = this.player ? this.player.currentRoom : null
            this.player = data.player
            
            // Request area map if room changed
            if (this.player.currentRoom !== previousRoom) {
                this.requestAreaMap(this.player.currentRoom)
            }
            
            this.updatePlayerInfo()
        }

        if (data.room) {
            this.updateRoomInfo(data.room)
        }
    }

    updatePlayerInfo() {
        if (!this.player) return

        this.playerNameSpan.textContent = this.player.name
        this.playerLevelSpan.textContent = this.player.level
        this.playerHealthSpan.textContent = this.player.health
        this.playerMaxHealthSpan.textContent = this.player.maxHealth
        this.playerGoldSpan.textContent = this.player.gold
        this.playerLocationSpan.textContent = this.player.location

        // Visual feedback for combat state
        if (this.player.inCombat) {
            document.body.classList.add('in-combat')
            this.playerLocationSpan.textContent = `${this.player.location} [COMBAT]`
        } else {
            document.body.classList.remove('in-combat')
            this.playerLocationSpan.textContent = this.player.location
        }

        // Request area map update if location changed
        if (this.isLoggedIn && this.player && this.player.currentRoom) {
            this.requestAreaMap(this.player.currentRoom)
        }
    }

    updateRoomInfo(room) {
        // Room info is now shown in the main console output via the 'look' command
        // We could add subtle visual feedback here if needed
        return
    }

    updateConnectionStatus(status, className = '') {
        this.connectionStatus.textContent = status
        this.connectionStatus.className = className
    }

    requestAreaMap(currentRoom) {
        if (!currentRoom) return
        this.socket.emit('requestAreaMap', currentRoom)
    }

    requestRoomExits() {
        if (!this.player || !this.player.currentArea || !this.player.currentRoom) return
        this.socket.emit('requestRoomExits', {
            area: this.player.currentArea,
            room: this.player.currentRoom
        })
    }

    handleAreaMap(mapData) {
        this.currentAreaMap = mapData
        this.renderAreaMap()
    }

    renderAreaMap() {
        if (!this.currentAreaMap || !this.player) {
            this.mapGrid.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Loading map...</div>'
            return
        }

        if (!this.currentAreaMap.rooms || this.currentAreaMap.rooms.length === 0) {
            this.mapGrid.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No rooms in area</div>'
            return
        }

        const { rooms, gridSize, playerPosition } = this.currentAreaMap

        // Create grid container
        const grid = document.createElement('div')
        grid.className = 'room-grid'
        grid.style.gridTemplateColumns = `repeat(${gridSize.width}, 1fr)`
        grid.style.gridTemplateRows = `repeat(${gridSize.height}, 1fr)`

                // Create grid cells
        for (let y = 0; y < gridSize.height; y++) {
            for (let x = 0; x < gridSize.width; x++) {
                const cell = document.createElement('div')
                cell.className = 'room-cell'

                // Check if there's a room at this position
                const roomAtPosition = rooms.find(room => room.gridX === x && room.gridY === y)
                
                // Check if there's an exit cell at this position
                const exitAtPosition = this.currentAreaMap.exitCells?.find(exit => 
                    exit.gridX === x && exit.gridY === y
                )
                
                if (roomAtPosition) {
                    const isCurrentRoom = (playerPosition.x === x && playerPosition.y === y)
                    
                    if (isCurrentRoom) {
                        cell.className += ' current-room'
                        cell.title = `${roomAtPosition.name} (Current)`
                        cell.textContent = '●'
                    } else {
                        cell.className += ' other-room'
                        cell.title = roomAtPosition.name
                        cell.textContent = '○'
                    }
                } else if (exitAtPosition) {
                    cell.className += ' exit-cell'
                    const areaName = exitAtPosition.targetArea
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')
                    cell.title = `Exit to ${areaName}`
                    cell.textContent = '•'
                } else {
                    cell.className += ' empty'
                }

                grid.appendChild(cell)
            }
        }
        
        // Clear and update map
        this.mapGrid.innerHTML = ''
        this.mapGrid.appendChild(grid)
        
        // Update room information
        this.updateRoomInfo()
    }

    updateRoomInfo() {
        if (!this.player || !this.currentAreaMap) {
            this.roomInfoArea.textContent = 'Loading...'
            this.roomInfoName.textContent = 'Loading...'
            this.roomInfoExits.innerHTML = ''
            return
        }

        // Find current room data
        const currentRoom = this.currentAreaMap.rooms.find(room => 
            room.gridX === this.currentAreaMap.playerPosition.x && 
            room.gridY === this.currentAreaMap.playerPosition.y
        )

        if (!currentRoom) {
            this.roomInfoArea.textContent = 'Unknown Area'
            this.roomInfoName.textContent = 'Unknown Room'
            this.roomInfoExits.innerHTML = ''
            return
        }

        // Update area name (format: "town_area" -> "Town Area")
        const areaName = this.player.currentArea
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        this.roomInfoArea.textContent = areaName
        
        // Update room name
        this.roomInfoName.textContent = currentRoom.name
        
        // Request room exits from server
        this.requestRoomExits()
    }

    handleRoomExits(exitsData) {
        if (!exitsData || !exitsData.exits) {
            this.roomInfoExits.innerHTML = '<div class="exit-item">No exits</div>'
            return
        }

        const exitsList = Object.entries(exitsData.exits).map(([direction, roomInfo]) => {
            return `<div class="exit-item">
                <span class="exit-direction">${direction}:</span>
                <span class="exit-room">${roomInfo.name}</span>
            </div>`
        }).join('')

        this.roomInfoExits.innerHTML = exitsList || '<div class="exit-item">No exits</div>'
    }

    
}

// Global functions for HTML onclick handlers
window.showMainMenu = () => client.showMainMenu()
window.showLoginForm = () => client.showLoginForm()
window.showCreateForm = () => client.showCreateForm()
window.checkCharacter = () => client.checkCharacter()
window.login = () => client.login()
window.createCharacter = () => client.createCharacter()
window.logout = () => client.logout()
window.sendCommand = () => client.sendCommand()
window.sendQuickCommand = (command) => client.sendQuickCommand(command)

// Initialize client when page loads
let client
document.addEventListener('DOMContentLoaded', () => {
    client = new SimpleMUDClient()
    
    // Show main menu by default
    client.showMainMenu()
})



// Prevent accidental page refresh
window.addEventListener('beforeunload', (e) => {
    if (client && client.isLoggedIn) {
        e.preventDefault()
        e.returnValue = 'You are currently in the game. Are you sure you want to leave?'
        return e.returnValue
    }
})