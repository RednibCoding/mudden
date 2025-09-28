import bcrypt from 'bcrypt'
import DatabaseService from '../../database/supabase'
import SessionService from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password } = body
    
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required'
      })
    }
    
    // Get player by email
    const player = await DatabaseService.getPlayerByEmail(email.toLowerCase().trim())
    
    if (!player) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password'
      })
    }
    
    // Check if email is verified
    if (!player.email_verified) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Please verify your email address before logging in'
      })
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, player.password_hash)
    if (!passwordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password'
      })
    }
    
    // Create session token
    const sessionToken = SessionService.createSession(
      player.id,
      player.character_name
    )
    
    // Set session cookie
    SessionService.setSessionCookie(event, sessionToken)
    
    // Log the action
    await DatabaseService.logAction(
      player.id,
      'player_login',
      `Player ${player.character_name} logged in successfully`
    )
    
    return {
      success: true,
      message: 'Login successful',
      player: {
        id: player.id,
        characterName: player.character_name,
        level: player.level
      }
    }
    
  } catch (error: any) {
    console.error('Error in POST /api/auth/login:', error)
    
    // Re-throw known errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Login failed'
    })
  }
})