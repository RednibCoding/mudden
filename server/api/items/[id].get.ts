import { ContentService } from '../../database/content'

export default defineEventHandler(async (event) => {
  const itemId = getRouterParam(event, 'id')
  
  if (!itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item ID is required'
    })
  }
  
  const item = ContentService.getItem(itemId)
  
  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Item not found'
    })
  }
  
  return {
    success: true,
    data: item
  }
})