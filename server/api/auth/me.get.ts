import SessionService from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Get session from request
    const session = await SessionService.getUserSession(event)
    
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No active session'
      })
    }
    
    // Return user info from session
    return {
      success: true,
      data: {
        playerId: session.playerId,
        characterName: session.characterName,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      }
    }
    
  } catch (error: any) {
    // Don't log auth check failures as errors (they're expected)
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
})