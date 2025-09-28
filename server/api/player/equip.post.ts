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

    // Check if item is equippable
    if (!['weapon', 'armor'].includes(item.type)) {
      return {
        success: false,
        message: `You cannot equip a ${item.type}`
      }
    }

    // Check if player has this item in inventory
    const inventoryCheck = await DatabaseService.checkPlayerHasItem(playerId, itemId)
    if (!inventoryCheck) {
      return {
        success: false,
        message: "You don't have that item in your inventory"
      }
    }

    // Determine equipment slot - all items should have a slot field
    const equipmentSlot = item.slot || (item.type === 'weapon' ? 'main_hand' : 'armor')

    // Check what's currently equipped in this slot
    const currentEquipped = await DatabaseService.findEquippedItemInSlot(playerId, equipmentSlot)
    let replacedItem = null
    
    if (currentEquipped) {
      replacedItem = currentEquipped.items
      // Unequip the item being replaced
      await DatabaseService.unequipSpecificItem(playerId, currentEquipped.item_id)
    }

    // Equip the new item
    const result = await DatabaseService.equipItem(playerId, itemId)
    if (!result) {
      return {
        success: false,
        message: 'Failed to equip item'
      }
    }

    // Log the action
    await DatabaseService.logAction(playerId, 'equip_item', `Equipped ${item.name}`, { itemId, itemName: item.name })

    // Create appropriate message based on whether something was replaced
    let message = `You equip the ${item.name}`
    if (replacedItem) {
      message = `You unequip the ${replacedItem.name} and equip the ${item.name}`
    }

    return {
      success: true,
      message,
      equippedItem: {
        id: itemId,
        name: item.name,
        type: item.type,
        effects: item.effects
      },
      replacedItem: replacedItem ? {
        id: replacedItem.id,
        name: replacedItem.name,
        type: replacedItem.type
      } : null
    }

  } catch (error) {
    console.error('Equip item error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    return {
      success: false,
      message: 'Failed to equip item. Please try again.'
    }
  }
})