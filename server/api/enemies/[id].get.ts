import { readFileSync } from 'fs'
import { join } from 'path'

const enemiesData = JSON.parse(
  readFileSync(join(process.cwd(), 'data/enemies.json'), 'utf-8')
)

export default defineEventHandler(async (event) => {
  const enemyId = getRouterParam(event, 'id')
  
  if (!enemyId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enemy ID is required'
    })
  }
  
  const enemy = enemiesData.enemies[enemyId]
  
  if (!enemy) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Enemy not found'
    })
  }
  
  return {
    success: true,
    data: enemy
  }
})