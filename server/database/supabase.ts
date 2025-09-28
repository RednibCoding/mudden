import { createClient } from '@supabase/supabase-js'
import ContentService from './content'

// Supabase configuration - use Service Role for server-side operations
const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
}

// Create Supabase client with Service Role (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Database utility functions
export class DatabaseService {
  
  // Player operations
  static async createPlayer(email: string, characterName: string, passwordHash: string) {
    const { data, error } = await supabase
      .from('players')
      .insert({
        email,
        character_name: characterName,
        password_hash: passwordHash
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async createPlayerWithVerification(email: string, passwordHash: string, characterName: string, verificationToken: string, verificationExpires: Date) {
    const { data, error } = await supabase
      .from('players')
      .insert({
        email,
        character_name: characterName,
        password_hash: passwordHash,
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires.toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async verifyEmail(token: string) {
    // Find player with valid token
    const { data: player, error: findError } = await supabase
      .from('players')
      .select('*')
      .eq('email_verification_token', token)
      .gt('email_verification_expires', new Date().toISOString())
      .single()

    if (findError || !player) {
      throw new Error('Invalid or expired verification token')
    }

    // Update player as verified
    const { data, error } = await supabase
      .from('players')
      .update({
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null
      })
      .eq('id', player.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  

  static async getPlayerByEmail(email: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Player not found
      }
      throw error
    }
    return data
  }

  static async getPlayerById(playerId: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  static async updatePlayerLocation(playerId: string, currentRoom: string, currentArea: string, positionX: number, positionY: number) {
    const { data, error } = await supabase
      .from('player_locations')
      .update({
        current_room: currentRoom,
        current_area: currentArea,
        position_x: positionX,
        position_y: positionY,
        last_moved: new Date().toISOString(),
        is_online: true
      })
      .eq('player_id', playerId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updatePlayerStats(playerId: string, health: number, gold: number, experience: number, level: number) {
    const { data, error } = await supabase
      .from('players')
      .update({
        health,
        gold,
        experience,
        level,
        last_login: new Date().toISOString()
      })
      .eq('id', playerId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Inventory operations
  static async getPlayerInventory(playerId: string) {
    const { data, error } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_id', playerId)

    if (error) throw error
    return data
  }

  static async addToInventory(playerId: string, itemId: string, quantity: number = 1) {
    // Validate item exists in content data
    if (!ContentService.validateItemId(itemId)) {
      throw new Error(`Invalid item ID: ${itemId}`)
    }

    // First try to update existing item
    const { data: existing } = await supabase
      .from('player_inventory')
      .select('quantity')
      .eq('player_id', playerId)
      .eq('item_id', itemId)
      .single()

    if (existing) {
      // Update existing item quantity
      const { data, error } = await supabase
        .from('player_inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('player_id', playerId)
        .eq('item_id', itemId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // Insert new item
      const { data, error } = await supabase
        .from('player_inventory')
        .insert({
          player_id: playerId,
          item_id: itemId,
          quantity
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  static async removeFromInventory(playerId: string, itemId: string, quantity: number = 1) {
    const { data: existing } = await supabase
      .from('player_inventory')
      .select('quantity')
      .eq('player_id', playerId)
      .eq('item_id', itemId)
      .single()

    if (!existing) {
      throw new Error('Item not found in inventory')
    }

    if (existing.quantity <= quantity) {
      // Remove item completely
      const { error } = await supabase
        .from('player_inventory')
        .delete()
        .eq('player_id', playerId)
        .eq('item_id', itemId)

      if (error) throw error
      return null
    } else {
      // Reduce quantity
      const { data, error } = await supabase
        .from('player_inventory')
        .update({ quantity: existing.quantity - quantity })
        .eq('player_id', playerId)
        .eq('item_id', itemId)
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  // Equipment operations using new player_equipment table
  static async getEquippedItems(playerId: string) {
    const { data, error } = await supabase
      .from('player_equipment')
      .select('*')
      .eq('player_id', playerId)

    if (error) throw error
    return data || []
  }

  static async checkPlayerHasItem(playerId: string, itemId: string) {
    const { data, error } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_id', playerId)
      .eq('item_id', itemId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
    return data
  }

  static async checkPlayerHasItemEquipped(playerId: string, itemId: string) {
    const { data, error } = await supabase
      .from('player_equipment')
      .select('*')
      .eq('player_id', playerId)
      .eq('item_id', itemId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
    return data
  }

  static async findEquippedItemInSlot(playerId: string, slotType: string) {
    const { data, error } = await supabase
      .from('player_equipment')
      .select('*')
      .eq('player_id', playerId)
      .eq('slot_type', slotType)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
    return data
  }

  static async equipItem(playerId: string, itemId: string, slotType: string) {
    // First check if player owns the item
    const inventoryItem = await this.checkPlayerHasItem(playerId, itemId)
    if (!inventoryItem) {
      throw new Error('Item not found in inventory')
    }

    // Unequip any existing item in this slot
    const existingItem = await this.findEquippedItemInSlot(playerId, slotType)
    if (existingItem) {
      await this.unequipItemFromSlot(playerId, slotType)
    }

    // Equip the new item
    const { data, error } = await supabase
      .from('player_equipment')
      .insert({
        player_id: playerId,
        item_id: itemId,
        slot_type: slotType
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async unequipSpecificItem(playerId: string, itemId: string) {
    const { data, error } = await supabase
      .from('player_equipment')
      .delete()
      .eq('player_id', playerId)
      .eq('item_id', itemId)
      .select()

    if (error) throw error
    return data
  }

  static async unequipItemFromSlot(playerId: string, slotType: string) {
    const { data, error } = await supabase
      .from('player_equipment')
      .delete()
      .eq('player_id', playerId)
      .eq('slot_type', slotType)
      .select()

    if (error) throw error
    return data
  }

  // Quest operations
  static async getPlayerQuests(playerId: string, status?: string) {
    let query = supabase
      .from('player_quests')
      .select('*')
      .eq('player_id', playerId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }

  static async getPlayerQuest(playerId: string, questId: string, status?: string) {
    let query = supabase
      .from('player_quests')
      .select('*')
      .eq('player_id', playerId)
      .eq('quest_id', questId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.single()
    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
    return data
  }

  static async startQuest(playerId: string, questId: string, initialProgress = {}) {
    const { data, error } = await supabase
      .from('player_quests')
      .insert({
        player_id: playerId,
        quest_id: questId,
        status: 'active',
        progress: initialProgress,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateQuestProgress(playerId: string, questId: string, progress: any) {
    const { data, error } = await supabase
      .from('player_quests')
      .update({ 
        progress,
        updated_at: new Date().toISOString()
      })
      .eq('player_id', playerId)
      .eq('quest_id', questId)
      .eq('status', 'active')
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async completeQuest(playerId: string, questId: string, rewards: any) {
    // Update quest status to completed
    const { data: questData, error: questError } = await supabase
      .from('player_quests')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('player_id', playerId)
      .eq('quest_id', questId)
      .eq('status', 'active')
      .select()
      .single()

    if (questError) throw questError

    // Record completion in history
    const { data: completionData, error: completionError } = await supabase
      .from('quest_completions')
      .insert({
        player_id: playerId,
        quest_id: questId,
        rewards_given: rewards,
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (completionError) throw completionError

    return { quest: questData, completion: completionData }
  }

  static async abandonQuest(playerId: string, questId: string) {
    const { data, error } = await supabase
      .from('player_quests')
      .delete()
      .eq('player_id', playerId)
      .eq('quest_id', questId)
      .eq('status', 'active')
      .select()

    if (error) throw error
    return data
  }

  static async getQuestCompletionCount(playerId: string, questId: string) {
    const { data, error } = await supabase
      .from('quest_completions')
      .select('completion_count')
      .eq('player_id', playerId)
      .eq('quest_id', questId)

    if (error) throw error
    return data?.length || 0
  }

  // Action logging
  static async logAction(playerId: string, actionType: string, description: string, actionData?: any) {
    const { data, error } = await supabase
      .from('game_actions')
      .insert({
        player_id: playerId,
        action_type: actionType,
        description,
        action_data: actionData
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Area operations
  static async getGameArea(areaId: string) {
    const { data, error } = await supabase
      .from('game_areas')
      .select('*')
      .eq('id', areaId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  static async updateGameArea(areaId: string, areaData: any) {
    const { data, error } = await supabase
      .from('game_areas')
      .upsert({
        id: areaId,
        area_data: areaData
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get player with enriched inventory (convenience method)
  static async getPlayerWithInventory(playerId: string) {
    const player = await this.getPlayerById(playerId)
    if (!player) return null

    const inventoryData = await this.getPlayerInventory(playerId)
    
    // Enrich inventory with item details from JSON
    const enrichedInventory = ContentService.enrichInventoryItems(inventoryData)
    
    return {
      ...player,
      inventory: enrichedInventory
    }
  }

  // Player location operations
  static async createPlayerLocation(playerId: string, room: string, area: string, x: number = 0, y: number = 0) {
    const { data, error } = await supabase
      .from('player_locations')
      .insert({
        player_id: playerId,
        current_room: room,
        current_area: area,
        position_x: x,
        position_y: y,
        is_online: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  }



  static async getPlayersInRoom(room: string) {
    const { data, error } = await supabase
      .from('player_locations')
      .select(`
        player_id,
        position_x,
        position_y,
        is_online,
        players!inner(
          character_name,
          level
        )
      `)
      .eq('current_room', room)
      .eq('is_online', true)

    if (error) throw error
    return data
  }

  static async setPlayerOffline(playerId: string) {
    const { data, error } = await supabase
      .from('player_locations')
      .update({ is_online: false })
      .eq('player_id', playerId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getPlayerLocation(playerId: string) {
    const { data, error } = await supabase
      .from('player_locations')
      .select('*')
      .eq('player_id', playerId)
      .single()

    if (error) throw error
    return data
  }

  // Room item tracking methods
  static async isItemTakenFromRoom(playerId: string, roomId: string, itemId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('room_items_taken')
      .select('id')
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('item_id', itemId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error
    }

    return !!data
  }

  static async markItemTakenFromRoom(playerId: string, roomId: string, itemId: string) {
    const { data, error } = await supabase
      .from('room_items_taken')
      .insert({
        player_id: playerId,
        room_id: roomId,
        item_id: itemId
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Health check
  static async healthCheck() {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id')
        .limit(1)

      if (error) throw error
      return { status: 'healthy', playerCount: data?.length || 0 }
    } catch (error: any) {
      return { status: 'error', error: error?.message || 'Unknown error' }
    }
  }
}

export default DatabaseService