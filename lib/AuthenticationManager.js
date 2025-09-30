import Player from './Player.js'

class AuthenticationManager {
  constructor(io) {
    this.io = io
  }

  /**
   * Validate and format character name consistently
   * @param {string} playerName - Raw player name input
   * @returns {object} - {success: boolean, cleanName?: string, error?: string}
   */
  validateAndFormatName(playerName) {
    const trimmedName = playerName?.trim()
    
    if (!trimmedName) {
      return { success: false, error: 'Character name cannot be empty' }
    }
    
    if (trimmedName.length < 3 || trimmedName.length > 12) {
      return { success: false, error: 'Character name must be between 3 and 12 characters long' }
    }
    
    if (!/^[a-zA-Z]+$/.test(trimmedName)) {
      return { success: false, error: 'Character name can only contain regular letters' }
    }
    
    // Convert to proper case (first letter uppercase, rest lowercase)
    const cleanName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1).toLowerCase()
    
    return { success: true, cleanName }
  }

  /**
   * Validate password requirements
   * @param {string} password - Password to validate
   * @returns {object} - {success: boolean, error?: string}
   */
  validatePassword(password) {
    if (!password || password.trim().length < 3) {
      return { success: false, error: 'Password must be at least 3 characters long' }
    }
    
    return { success: true }
  }

  /**
   * Handle login request (check if character exists and needs password)
   * @param {Socket} socket - Socket connection
   * @param {string} playerName - Character name to check
   */
  handleLoginRequest(socket, playerName) {
    console.log(`Login request received for: ${playerName}`)
    
    try {
      // Validate and format name
      const nameValidation = this.validateAndFormatName(playerName)
      if (!nameValidation.success) {
        socket.emit('loginResponse', { success: false, error: nameValidation.error })
        return
      }
      
      const cleanName = nameValidation.cleanName
      const characterExists = Player.characterExists(cleanName)
      
      if (!characterExists) {
        socket.emit('loginResponse', { 
          success: false, 
          error: `Character "${cleanName}" does not exist. Use "Create Character" to make a new character.` 
        })
        return
      }
      
      const needsPassword = Player.needsPassword(cleanName)
      
      socket.emit('loginResponse', {
        success: true,
        characterExists: true,
        needsPassword,
        playerName: cleanName
      })

    } catch (error) {
      console.error('Login request error:', error)
      socket.emit('loginResponse', { success: false, error: 'Failed to check login' })
    }
  }

  /**
   * Handle character creation
   * @param {Socket} socket - Socket connection
   * @param {object} creationData - {playerName, password}
   * @returns {Player|null} - Created player or null if failed
   */
  handleCharacterCreation(socket, creationData) {
    try {
      const { playerName, password } = creationData
      
      // Validate character name
      const nameValidation = this.validateAndFormatName(playerName)
      if (!nameValidation.success) {
        socket.emit('error', nameValidation.error)
        return null
      }
      
      const cleanName = nameValidation.cleanName
      
      // Check for case-insensitive duplicate names
      if (Player.characterExistsCaseInsensitive(cleanName)) {
        socket.emit('error', `A character with that name already exists. Please choose a different name.`)
        return null
      }

      // Validate password
      const passwordValidation = this.validatePassword(password)
      if (!passwordValidation.success) {
        socket.emit('error', passwordValidation.error)
        return null
      }

      // Create new character
      const newPlayer = new Player(cleanName)
      newPlayer.setPassword(password)
      newPlayer._justCreated = true // Flag for welcome message
      newPlayer.save()
      
      console.log(`New character created: ${cleanName}`)
      return newPlayer

    } catch (error) {
      console.error('Character creation error:', error)
      socket.emit('error', 'Failed to create character')
      return null
    }
  }

  /**
   * Handle login with password verification
   * @param {Socket} socket - Socket connection
   * @param {object} loginData - {playerName, password}
   * @returns {Player|null} - Logged in player or null if failed
   */
  handleLogin(socket, loginData) {
    try {
      const { playerName, password } = loginData
      
      // Validate and format name
      const nameValidation = this.validateAndFormatName(playerName)
      if (!nameValidation.success) {
        socket.emit('error', nameValidation.error)
        return null
      }
      
      const cleanName = nameValidation.cleanName

      // Check if character exists
      if (!Player.characterExists(cleanName)) {
        socket.emit('error', `Character "${cleanName}" does not exist. Use "Create Character" to make a new character.`)
        return null
      }
      
      let player
      
      if (Player.needsPassword(cleanName)) {
        if (!password) {
          socket.emit('error', 'Password required for this character')
          return null
        }
        
        // Load player and verify password
        const tempPlayer = Player.load(cleanName)
        if (!tempPlayer.verifyPassword(password)) {
          socket.emit('error', 'Incorrect password')
          return null
        }
        
        player = tempPlayer
      } else {
        // Existing character without password
        player = Player.load(cleanName)
      }

      return player

    } catch (error) {
      console.error('Login error:', error)
      socket.emit('error', 'Failed to log in')
      return null
    }
  }
}

export default AuthenticationManager