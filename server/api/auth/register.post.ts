import bcrypt from 'bcrypt'
import crypto from 'crypto'
import DatabaseService from '../../database/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { email, password, characterName } = body
  
  if (!email || !password || !characterName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password, and character name are required'
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format'
    })
  }

  // Validate password strength
  if (password.length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 6 characters long'
    })
  }

  try {
    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create player with verification token
    const player = await DatabaseService.createPlayerWithVerification(
      email.toLowerCase().trim(),
      passwordHash,
      characterName.trim(),
      verificationToken,
      verificationExpires
    )
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken, characterName)
    
    // Log the registration
    await DatabaseService.logAction(
      player.id,
      'player_registered',
      `Player registered with email ${email}`,
      { 
        email: email,
        verification_token_sent: true,
        verification_expires: verificationExpires
      }
    )

    return {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      playerId: player.id
    }
    
  } catch (error: any) {
    console.error('Registration error:', error)
    
    // Handle duplicate email
    if (error.code === '23505') {
      if (error.constraint === 'players_email_key') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Email address already registered'
        })
      }
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Registration failed. Please try again.'
    })
  }
})

// Email sending function
async function sendVerificationEmail(email: string, token: string, characterName: string) {
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`
  
  // For development - just log the verification URL
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🔗 EMAIL VERIFICATION URL (Development Mode):')
    console.log(`   ${verificationUrl}`)
    console.log(`   Player: ${characterName} (${email})`)
    console.log('   Click the link above to verify your account\n')
    return
  }
  
  // TODO: Implement actual email sending in production
  // You would use nodemailer or another email service here
  // For now, we'll just log it in development
  console.log(`Would send verification email to ${email} with token ${token}`)
}