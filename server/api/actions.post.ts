import { ContentService } from '../database/content'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action, target, playerId, playerData } = body

  try {
    switch (action) {
      case 'take':
        return await handleTakeItem(target, playerData)
      case 'use':
        return await handleUseItem(target, playerData)
      case 'talk':
        return await handleTalkToNpc(target, playerData)
      case 'move':
        return await handleMove(target, playerData)
      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid action'
        })
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})

async function handleTakeItem(itemId: string, playerData: any) {
  const currentRoom = ContentService.getRoom(playerData.currentRoom)
  
  if (!currentRoom || !currentRoom.items.includes(itemId)) {
    return {
      success: false,
      message: "That item isn't here."
    }
  }
  
  const item = ContentService.getItem(itemId)
  
  if (!item) {
    return {
      success: false,
      message: "That item doesn't exist."
    }
  }
  
  if (!item.canTake) {
    return {
      success: false,
      message: "You can't take that."
    }
  }
  
  // Remove item from room, add to player inventory
  currentRoom.items = currentRoom.items.filter(i => i !== itemId)
  
  return {
    success: true,
    message: `You take the ${item.name}.`,
    item: item,
    roomUpdate: currentRoom
  }
}

async function handleUseItem(itemId: string, playerData: any) {
  const item = ContentService.getItem(itemId)
  
  if (!item) {
    return {
      success: false,
      message: "That item doesn't exist."
    }
  }
  
  if (!item.canUse) {
    return {
      success: false,
      message: "You can't use that."
    }
  }
  
  let message = `You use the ${item.name}.`
  let effects = {}
  
  // Apply item effects
  if (item.effects) {
    if (item.effects.health) {
      effects.health = item.effects.health
      message += ` You recover ${item.effects.health} health.`
    }
    if (item.effects.stamina) {
      effects.stamina = item.effects.stamina
      message += ` You recover ${item.effects.stamina} stamina.`
    }
  }
  
  return {
    success: true,
    message,
    effects,
    consumeItem: item.type === 'consumable'
  }
}

async function handleTalkToNpc(npcId: string, playerData: any) {
  const currentRoom = ContentService.getRoom(playerData.currentRoom)
  
  if (!currentRoom || !currentRoom.npcs.includes(npcId)) {
    return {
      success: false,
      message: "There's no one here by that name."
    }
  }
  
  const npc = ContentService.getNPC(npcId)
  
  if (!npc) {
    return {
      success: false,
      message: "That person doesn't exist."
    }
  }
  
  return {
    success: true,
    message: `You talk to the ${npc.name}.`,
    dialogue: npc.dialogue,
    npc: npc
  }
}

async function handleMove(direction: string, playerData: any) {
  const currentRoom = ContentService.getRoom(playerData.currentRoom)
  
  if (!currentRoom || !currentRoom.exits[direction]) {
    return {
      success: false,
      message: "You can't go that way."
    }
  }
  
  const newRoomId = currentRoom.exits[direction]
  const newRoom = ContentService.getRoom(newRoomId)
  
  if (!newRoom) {
    return {
      success: false,
      message: "That location doesn't exist."
    }
  }
  
  return {
    success: true,
    message: `You head ${direction}...`,
    newRoom: newRoom,
    newRoomId: newRoomId
  }
}