import { readFileSync } from 'fs'
import { join } from 'path'

import ContentService from '../../database/content'

export default defineEventHandler(async (event) => {
  const areaId = getRouterParam(event, 'areaId')
  
  if (!areaId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Area ID is required'
    })
  }

  try {
    const mapData = ContentService.getCompleteAreaData(areaId)
    
    if (!mapData) {
      throw createError({
        statusCode: 404,
        statusMessage: `Area not found: ${areaId}`
      })
    }
    
    return {
      success: true,
      data: mapData
    }
  } catch (error: any) {
    console.error('Error loading area:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load area: ${areaId}`
    })
  }
})