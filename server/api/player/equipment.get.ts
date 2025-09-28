import DatabaseService from '../../database/supabase'
import ContentService from '../../database/content'
import SessionService from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and get session
    const session = await SessionService.requireAuth(event)
    const playerId = session.playerId

    // Get equipped items from database
    const equippedItems = await DatabaseService.getEquippedItems(playerId)
    
    // Enrich equipped items with content data
    const enrichedEquipment = equippedItems.map((equipped: any) => {
      const itemData = ContentService.getItem(equipped.item_id)
      if (itemData) {
        return {
          id: itemData.id,
          name: itemData.name,
          description: itemData.description,
          type: itemData.type,
          slot: equipped.slot_type,
          effects: itemData.effects || {},
          equippedAt: equipped.equipped_at
        }
      }
      return null
    }).filter(Boolean)

    return {
      success: true,
      equippedItems: enrichedEquipment
    }

  } catch (error) {
    console.error('Get equipment error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    return {
      success: false,
      message: 'Failed to get equipped items. Please try again.'
    }
  }
})