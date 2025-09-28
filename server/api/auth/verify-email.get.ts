import DatabaseService from '../../database/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { token } = query
  
  if (!token || typeof token !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Verification token is required'
    })
  }

  try {
    // Verify the email token
    const player = await DatabaseService.verifyEmail(token)
    
    // Create initial location entry for verified player
    await DatabaseService.createPlayerLocation(
      player.id,
      'town_square',
      'town_area',
      1,
      0
    )
    
    // Log the verification
    await DatabaseService.logAction(
      player.id,
      'email_verified',
      `Email verification completed for ${player.email}`,
      { 
        verification_completed_at: new Date().toISOString(),
        started_with_empty_inventory: true
      }
    )

    return {
      success: true,
      message: 'Email verified successfully! You can now login to your account.',
      player: {
        id: player.id,
        email: player.email,
        characterName: player.character_name,
        verified: true
      }
    }
    
  } catch (error: any) {
    console.error('Email verification error:', error)
    
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Email verification failed'
    })
  }
})