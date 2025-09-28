import { readFileSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const areaId = getRouterParam(event, 'areaId')
  
  if (!areaId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Area ID is required'
    })
  }

  try {
    const mapPath = join(process.cwd(), 'data', 'maps', `${areaId}.json`)
    const mapData = JSON.parse(readFileSync(mapPath, 'utf-8'))
    
    return {
      success: true,
      data: mapData
    }
  } catch (error) {
    console.error('Error loading map:', error)
    throw createError({
      statusCode: 404,
      statusMessage: `Map not found for area: ${areaId}`
    })
  }
})