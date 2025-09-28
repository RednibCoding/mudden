import { ContentService } from '../../database/content'

export default defineEventHandler(async (event) => {
  const npcId = getRouterParam(event, 'id')
  
  if (!npcId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'NPC ID is required'
    })
  }
  
  const npc = ContentService.getNPC(npcId)
  
  if (!npc) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NPC not found'
    })
  }
  
  return {
    success: true,
    data: npc
  }
})