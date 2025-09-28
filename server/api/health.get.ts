import DatabaseService from '../database/supabase'

export default defineEventHandler(async (event) => {
  try {
    const health = await DatabaseService.healthCheck()
    
    return {
      success: true,
      database: health,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Database health check failed'
    })
  }
})