import { DatabaseService } from '../../database/supabase'
import ContentService from '../../database/content'
import SessionService from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Only allow POST requests
    if (event.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }

    // Require authentication and get session
    const session = await SessionService.requireAuth(event)
    const playerId = session.playerId

    // Get request body
    const body = await readBody(event)
    const { itemId } = body

    if (!itemId) {
      return {
        success: false,
        message: 'Item ID is required'
      }
    }

    // Load items data to get item information
    const item = ContentService.getItem(itemId)
    
    if (!item) {
      return {
        success: false,
        message: 'Item not found'
      }
    }

    // Check if player has this item equipped
    const inventoryCheck = await DatabaseService.checkPlayerHasItemEquipped(playerId, itemId)
    if (!inventoryCheck) {
      return {
        success: false,
        message: "You don't have that item equipped"
      }
    }

    // Unequip the item
    const result = await DatabaseService.unequipSpecificItem(playerId, itemId)
    if (!result) {
      return {
        success: false,
        message: 'Failed to unequip item'
      }
    }

    // Log the action
    await DatabaseService.logAction(playerId, 'unequip_item', `Unequipped ${item.name}`, { itemId, itemName: item.name })

    return {
      success: true,
      message: `You unequip the ${item.name}`,
      unequippedItem: {
        id: itemId,
        name: item.name,
        type: item.type,
        effects: item.effects
      }
    }

  } catch (error) {
    console.error('Unequip item error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    return {
      success: false,
      message: 'Failed to unequip item. Please try again.'
    }
  }
})