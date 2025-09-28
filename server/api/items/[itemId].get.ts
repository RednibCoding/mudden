import ContentService from '../../database/content'

export default defineEventHandler(async (event) => {
  try {
    const itemId = getRouterParam(event, 'itemId')
    
    if (!itemId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item ID is required'
      })
    }
    
    // Get item from JSON content
    const item = ContentService.getItem(itemId)
    
    if (!item) {
      throw createError({
        statusCode: 404,
        statusMessage: `Item not found: ${itemId}`
      })
    }
    
    return {
      success: true,
      data: item
    }
    
  } catch (error: any) {
    console.error('Error in GET /api/items/[itemId]:', error)
    
    // Re-throw known errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Failed to load item data'
    })
  }
})