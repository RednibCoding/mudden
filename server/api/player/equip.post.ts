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

    // Determine equipment slot - use item.slot or default based on type
    let equipmentSlot = item.slot
    if (!equipmentSlot) {
      // Default slot mapping for items without explicit slot
      const slotMap: { [key: string]: string } = {
        'weapon': 'main_hand',
        'armor': 'chest',
        'helmet': 'head',
        'boots': 'feet',
        'gloves': 'hands'
      }
      equipmentSlot = slotMap[item.type] || 'main_hand'
    }

    // Check what's currently equipped in this slot
    const currentEquipped = await DatabaseService.findEquippedItemInSlot(playerId, equipmentSlot)
    let replacedItem = null
    
    if (currentEquipped) {
      // Get the replaced item data from content service
      const replacedItemData = ContentService.getItem(currentEquipped.item_id)
      if (replacedItemData) {
        replacedItem = replacedItemData
      }
    }

    // Equip the new item (this handles unequipping the old item automatically)
    const result = await DatabaseService.equipItem(playerId, itemId, equipmentSlot)
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
        slot: equipmentSlot,
        effects: item.effects
      },
      replacedItem: replacedItem ? {
        id: replacedItem.id,
        name: replacedItem.name,
        type: replacedItem.type,
        slot: replacedItem.slot
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