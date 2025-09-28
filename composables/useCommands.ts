import type { GameOutput } from './useGameState'



// Utility function to get user-friendly slot display names
const getSlotDisplayName = (slot: string): string => {
  const slotDisplayNames: { [key: string]: string } = {
    'main_hand': 'Main Hand',
    'off_hand': 'Off Hand', 
    'chest': 'Chest',
    'legs': 'Legs',
    'head': 'Head',
    'feet': 'Feet',
    'hands': 'Hands',
    'accessory': 'Accessory',
    'ring': 'Ring',
    'necklace': 'Necklace'
  }
  return slotDisplayNames[slot] || slot
}

export const useCommands = (
  addGameOutput: (message: string, type?: string) => void,
  currentRoom: any,
  player: any
) => {
  
  // Quest context for immersive quest acceptance
  let questContext: {
    npcId: string;
    npcName: string;
    availableQuests: Array<{index: number, id: string, title: string}>;
  } | null = null
  
  // Quest abandon context for numbered abandonment
  let questAbandonContext: {
    activeQuests: Array<{index: number, id: string, title: string}>;
  } | null = null
  
  // Fuzzy matching utility functions (moved inside composable)
  const calculateMatchScore = (target: string, search: string): number => {
    const targetLower = target.toLowerCase()
    const searchLower = search.toLowerCase()
    
    // Exact match gets highest score
    if (targetLower === searchLower) return 100
    
    // Check if target contains the search term
    if (targetLower.includes(searchLower)) return 80
    
    // Check for abbreviation match (e.g., "rst srd" matching "Rusty Sword")
    const searchParts = searchLower.split(' ').filter(part => part.length > 0)
    const targetWords = targetLower.split(/[\s_-]+/).filter(word => word.length > 0)
    
    if (searchParts.length === 0 || targetWords.length === 0) return 0
    
    let matchedParts = 0
    let totalScore = 0
    
    for (const searchPart of searchParts) {
      let bestWordScore = 0
      
      for (const targetWord of targetWords) {
        if (targetWord.startsWith(searchPart)) {
          // Prefix match gets high score
          bestWordScore = Math.max(bestWordScore, 70)
        } else if (targetWord.includes(searchPart)) {
          // Partial match gets medium score
          bestWordScore = Math.max(bestWordScore, 50)
        } else {
          // Check for subsequence match (e.g., "rst" in "rusty")
          let searchIndex = 0
          for (const char of targetWord) {
            if (searchIndex < searchPart.length && char === searchPart[searchIndex]) {
              searchIndex++
            }
          }
          if (searchIndex === searchPart.length) {
            bestWordScore = Math.max(bestWordScore, 30)
          }
        }
      }
      
      if (bestWordScore > 0) {
        matchedParts++
        totalScore += bestWordScore
      }
    }
    
    // Return average score only if all search parts found some match
    return matchedParts === searchParts.length ? totalScore / searchParts.length : 0
  }

  const findBestMatch = (items: any[], search: string, nameProperty: string = 'name'): any | null => {
    try {
      if (!search || items.length === 0) return null
      
      const matches = items
        .map(item => {
          try {
            const itemName = typeof item === 'string' ? item : item[nameProperty]
            if (!itemName || typeof itemName !== 'string') return { item, score: 0 }
            
            const score = calculateMatchScore(itemName, search)
            return { item, score, name: itemName }
          } catch (error) {
            console.warn('Error processing item in fuzzy match:', item, error)
            return { item, score: 0 }
          }
        })
        .filter(match => match.score > 25) // Minimum threshold for matches
        .sort((a, b) => b.score - a.score) // Sort by score descending
      
      return matches.length > 0 ? matches[0]?.item || null : null
    } catch (error) {
      console.error('Error in findBestMatch:', error)
      return null
    }
  }
  
  // Command execution result interface
  interface CommandResult {
    success?: boolean
    needsStateUpdate?: {
      playerData?: boolean
      roomData?: boolean
      position?: any
      room?: any
      areaData?: any
      exits?: any
      shouldLook?: boolean
    }
  }

  // Execute player commands
  const executeCommand = async (command: string, currentCommand: { value: string }): Promise<CommandResult> => {
    // Ensure command is a string
    const cmd = typeof command === 'string' ? command : currentCommand.value
    if (!cmd || !cmd.trim()) return { success: false }
    
    // Add command to output with preceding newline for readability
    addGameOutput(`\n> ${cmd}`, 'input')
    
    // Clear input
    currentCommand.value = ''
    
    // Parse command
    const parts = cmd.toLowerCase().trim().split(' ')
    const action = parts[0]
    const target = parts.slice(1).join(' ')
    
    let result: CommandResult = { success: true }

    // Clear quest context for most commands (except accept and ask about quests)
    if (action !== 'accept' && !(action === 'ask' && target.toLowerCase().includes('quest'))) {
      questContext = null
    }
    
    // Clear quest abandon context for most commands (except abandon and quest)
    if (action !== 'abandon' && action !== 'quest' && action !== 'quests') {
      questAbandonContext = null
    }

    try {
      // Handle different commands
      switch (action) {
        case 'help':
          handleHelp()
          break
          
        case 'look':
        case 'l':
          if (target) {
            handleLookAt(target)
          } else {
            await handleLook()
          }
          break
          
        case 'go':
        case 'north':
        case 'south':
        case 'east':
        case 'west':
        case 'n':
        case 's':
        case 'e':
        case 'w':
          const direction = action === 'go' ? target : action
          const moveResult = await handleMove(direction)
          if (moveResult) {
            result.needsStateUpdate = {
              position: moveResult.location?.position,
              room: {
                id: moveResult.id,
                title: moveResult.title,
                description: moveResult.description,
                items: moveResult.items || [],
                npcs: moveResult.npcs || [],
                enemies: moveResult.enemies || [],
                exits: moveResult.exits || {}
              },
              areaData: moveResult.areaData,
              exits: moveResult.exits,
              shouldLook: true
            }
          }
          break
          
        case 'inventory':
        case 'inv':
        case 'i':
          await handleInventory()
          break
          
        case 'take':
        case 'get':
          const takeResult = await handleTake(target)
          if (takeResult && takeResult.success) {
            result.needsStateUpdate = {
              playerData: true,
              roomData: true
            }
          }
          break
          
        case 'use':
          await handleUse(target)
          break
          
        case 'equip':
        case 'wield':
        case 'wear':
          const equipResult = await handleEquip(target)
          if (equipResult && equipResult.success) {
            result.needsStateUpdate = {
              playerData: true
            }
          }
          break
          
        case 'unequip':
        case 'unwield':
        case 'remove':
          const unequipResult = await handleUnequip(target)
          if (unequipResult && unequipResult.success) {
            result.needsStateUpdate = {
              playerData: true
            }
          }
          break
          
        case 'talk':
        case 'speak':
          await handleTalk(target)
          break
          
        case 'ask':
          await handleAsk(target)
          break
          
        case 'quest':
        case 'quests':
          await handleQuest(target)
          break
          
        case 'accept':
          await handleAcceptQuest(target)
          break
          
        case 'abandon':
          await handleAbandonQuest(target)
          break
          
        case 'stats':
          await handleStats()
          break
          
        default:
          addGameOutput("I don't understand that command. Type 'help' for available commands.", 'warning')
          result.success = false
          break
      }
    } catch (error) {
      console.error('Command execution error:', error)
      addGameOutput('An error occurred while processing your command.', 'error')
      result.success = false
    }
    
    return result
  }

  // Command handlers
  const handleLook = async (): Promise<void> => {
    if (!currentRoom.value) return
    
    addGameOutput(`\n=== ${currentRoom.value.title} ===`)
    addGameOutput(currentRoom.value.description)
    
    // Show exits
    const exits = Object.keys(currentRoom.value.exits)
    if (exits.length > 0) {
      addGameOutput(`\nExits: ${exits.join(', ')}`)
    }
    
    // Show items
    if (currentRoom.value.items && currentRoom.value.items.length > 0) {
      // Check if items are enriched objects or just IDs
      if (typeof currentRoom.value.items[0] === 'object' && currentRoom.value.items[0].name) {
        const itemNames = currentRoom.value.items.map((item: any) => item.name)
        addGameOutput(`\nYou see: ${itemNames.join(', ')}`)
      } else {
        // Fallback for raw IDs
        addGameOutput(`\nYou see: ${currentRoom.value.items.join(', ')} (IDs)`)
      }
    }
    
    // Show NPCs
    if (currentRoom.value.npcs && currentRoom.value.npcs.length > 0) {
      // Check if NPCs are enriched objects or just IDs
      if (typeof currentRoom.value.npcs[0] === 'object' && currentRoom.value.npcs[0].name) {
        const npcNames = currentRoom.value.npcs.map((npc: any) => npc.name)
        addGameOutput(`\nPeople here: ${npcNames.join(', ')}`)
      } else {
        // Fallback for raw IDs
        addGameOutput(`\nPeople here: ${currentRoom.value.npcs.join(', ')} (IDs)`)
      }
    }
    
    // Show enemies
    if (currentRoom.value.enemies && currentRoom.value.enemies.length > 0) {
      addGameOutput(`\nEnemies: ${currentRoom.value.enemies.join(', ')}`, 'warning')
    }
  }

  const handleLookAt = (itemName: string): void => {
    try {
      if (!itemName) {
        addGameOutput("Look at what?", 'warning')
        return
      }
      
      // Check inventory first using fuzzy matching
      const inventoryItems = player.value.inventory.map((invItem: any) => {
        try {
          if (typeof invItem === 'string') {
            return { name: invItem, item: invItem }
          } else if (invItem && invItem.item) {
            return { name: invItem.item.name, item: invItem }
          }
          return null
        } catch (error) {
          console.warn('Error processing inventory item:', invItem, error)
          return null
        }
      }).filter(Boolean)
    
    const inventoryItem = findBestMatch(inventoryItems, itemName, 'name')
    
    if (inventoryItem) {
      // inventoryItem has structure: { name: "Iron Sword", item: originalInventoryItem }
      const matchedName = inventoryItem.name || 'Unknown Item'
      const originalItem = inventoryItem.item
      
      // Show feedback if the match wasn't exact
      if (matchedName && matchedName.toLowerCase() !== itemName.toLowerCase()) {
        addGameOutput(`("${matchedName}")`, "input")
      }
      
      if (typeof originalItem === 'string') {
        // Simple string item
        addGameOutput(`You examine the ${matchedName}.`)
      } else if (originalItem && originalItem.item) {
        // Enriched inventory item structure: { item: { name, description, etc }, quantity, etc }
        const itemData = originalItem.item
        addGameOutput(`\n=== ${matchedName} ===`)
        if (itemData.description) {
          addGameOutput(itemData.description)
        } else {
          addGameOutput("A well-crafted item.")
        }
        if (itemData.type) {
          addGameOutput(`Type: ${itemData.type}`)
        }
        if (itemData.slot) {
          const displaySlot = getSlotDisplayName(itemData.slot)
          addGameOutput(`Slot: ${displaySlot}`)
        }
        if (itemData.effects && Object.keys(itemData.effects).length > 0) {
          const effectsText = Object.entries(itemData.effects)
            .map(([key, value]) => `${key}: +${value}`)
            .join(', ')
          addGameOutput(`Effects: ${effectsText}`)
        }
        if (itemData.value && itemData.value > 0) {
          addGameOutput(`Value: ${itemData.value} gold`)
        }
        if (itemData.weight && itemData.weight > 0) {
          addGameOutput(`Weight: ${itemData.weight} lbs`)
        }
      } else {
        // Fallback
        addGameOutput(`You examine the ${matchedName}.`)
      }
      return
    }
    
    // Check room items using fuzzy matching
    if (currentRoom.value && currentRoom.value.items && currentRoom.value.items.length > 0) {
      const roomItems = currentRoom.value.items.map((item: any) => {
        if (typeof item === 'string') {
          return { name: item, item: item }
        } else if (item && item.name) {
          return { name: item.name, item: item }
        }
        return null
      }).filter(Boolean)
      
      const roomItem = findBestMatch(roomItems, itemName, 'name')
      
      if (roomItem) {
        const matchedItemName = roomItem.name || roomItem.item || 'Unknown Item'
        // Show feedback if the match wasn't exact
        if (matchedItemName && matchedItemName.toLowerCase() !== itemName.toLowerCase()) {
          addGameOutput(`("${matchedItemName}"`, "input")
        }
        addGameOutput(`You examine the ${matchedItemName} in the room.`)
        addGameOutput("It looks interesting, but you'd need to take it to examine it more closely.")
        return
      }
    }
    
    // Check NPCs using fuzzy matching
    if (currentRoom.value && currentRoom.value.npcs && currentRoom.value.npcs.length > 0) {
      const npcs = currentRoom.value.npcs.map((npc: any) => {
        if (typeof npc === 'string') {
          return { name: npc, npc: npc }
        } else if (npc && npc.name) {
          return { name: npc.name, npc: npc }
        }
        return null
      }).filter(Boolean)
      
      const matchedNpc = findBestMatch(npcs, itemName, 'name')
      
      if (matchedNpc) {
        const npcName = matchedNpc.name || matchedNpc.npc || 'Unknown Person'
        // Show feedback if the match wasn't exact
        if (npcName && npcName.toLowerCase() !== itemName.toLowerCase()) {
          addGameOutput(`("${npcName}")`, "input")
        }
        addGameOutput(`You look at the ${npcName}.`)
        addGameOutput("They seem to be going about their business.")
        return
      }
    }
    
    addGameOutput(`You don't see a '${itemName}' here or in your inventory.`, 'warning')
    } catch (error) {
      console.error('Error in handleLookAt:', error)
      addGameOutput('An error occurred while looking at the item.', 'error')
    }
  }

  const handleMove = async (direction: string): Promise<any> => {
    try {
      // Send movement request to server
      const response = await $fetch('/api/player/move', {
        method: 'POST',
        body: { direction }
      }) as any
      
      if (!response.success) {
        addGameOutput(response.message, 'warning')
        return null
      }
      
      // Show movement message
      addGameOutput(response.message)
      
      return response.newLocation
      
    } catch (error) {
      console.error('Movement error:', error)
      addGameOutput('Movement failed. Please try again.', 'error')
      return null
    }
  }

  const handleInventory = async (): Promise<void> => {
    if (player.value.inventory.length === 0) {
      addGameOutput("Your inventory is empty.")
      return
    }

    // Fetch equipped items to mark them as equipped in inventory display
    let equippedItemIds: string[] = []
    try {
      const equippedResponse = await $fetch('/api/player/equipment') as any
      if (equippedResponse.success && equippedResponse.equippedItems) {
        equippedItemIds = equippedResponse.equippedItems.map((item: any) => item.id)
      }
    } catch (error) {
      console.error('Failed to fetch equipped items for inventory display:', error)
      // Continue without equipped indicators if fetch fails
    }
    
    addGameOutput("\n=== Your Inventory ===")
    player.value.inventory.forEach((invItem: any) => {
      // Get item ID for equipped check
      let itemId: string
      let itemName: string
      let quantity = ''
      
      if (typeof invItem === 'string') {
        itemId = invItem
        itemName = invItem
      } else if (invItem && invItem.item && invItem.item.id) {
        itemId = invItem.item.id
        itemName = invItem.item.name || invItem.item.id
        quantity = invItem.quantity > 1 ? ` (${invItem.quantity})` : ''
      } else if (invItem && invItem.name) {
        itemId = invItem.id || invItem.item_id || invItem.name
        itemName = invItem.name
        quantity = invItem.quantity > 1 ? ` (${invItem.quantity})` : ''
      } else {
        addGameOutput(`- Unknown item`)
        return
      }
      
      // Check if item is equipped
      const isEquipped = equippedItemIds.includes(itemId)
      const equippedIndicator = isEquipped ? ' (equipped)' : ''
      
      addGameOutput(`- ${itemName}${quantity}${equippedIndicator}`)
    })
  }

  const handleTake = async (itemName: string): Promise<any> => {
    if (!itemName) {
      addGameOutput("Take what?", 'warning')
      return null
    }
    
    // First, try to find the best matching item in the room using fuzzy matching
    if (currentRoom.value.items && currentRoom.value.items.length > 0) {
      const roomItems = currentRoom.value.items.map((item: any) => {
        if (typeof item === 'string') {
          return { name: item, id: item }
        } else if (item && item.name) {
          return { name: item.name, id: item.id || item.name }
        }
        return null
      }).filter(Boolean)
      
      const bestMatch = findBestMatch(roomItems, itemName, 'name')
      
      if (bestMatch) {
        // bestMatch has structure { name: string, id: string }
        const matchedItemId = bestMatch.id || bestMatch.name || 'unknown'
        const matchedItemName = bestMatch.name || 'Unknown Item'
        
        // Show feedback if the match wasn't exact
        if (matchedItemName && matchedItemName.toLowerCase() !== itemName.toLowerCase()) {
          addGameOutput(`("${matchedItemName}")`, "input")
        }
        
        try {
          // Send take request to server with the matched item ID (more efficient)
          const response = await $fetch('/api/player/take', {
            method: 'POST',
            body: { itemId: matchedItemId }
          })
          
          if (response.success) {
            addGameOutput(response.message, 'success')
            return response
          } else {
            addGameOutput(response.message, 'warning')
            return null
          }
        } catch (error) {
          console.error('Take error:', error)
          addGameOutput('Failed to take item. Please try again.', 'error')
          return null
        }
      } else {
        addGameOutput(`You don't see anything like "${itemName}" here.`, 'warning')
        return null
      }
    } else {
      addGameOutput("There's nothing here to take.", 'warning')
      return null
    }
  }

  const handleUse = async (itemName: string): Promise<void> => {
    if (!itemName) {
      addGameOutput("Use what?", 'warning')
      return
    }
    
    // TODO: Implement item usage logic
    addGameOutput(`You attempt to use the ${itemName}.`)
  }

  const handleTalk = async (npcName: string): Promise<void> => {
    if (!npcName) {
      addGameOutput("Talk to whom?", 'warning')
      return
    }

    // Clear quest context when talking to any NPC (will be refreshed if asking about quests)
    questContext = null

    // Check if there are NPCs in current room
    if (!currentRoom.value || !currentRoom.value.npcs || currentRoom.value.npcs.length === 0) {
      addGameOutput("There's no one here to talk to.", 'warning')
      return
    }

    // Client-side fuzzy matching for NPCs using enriched data
    const normalizedInput = npcName.toLowerCase().trim()
    let matchedNpcId: string | null = null
    let matchedNpcName: string | null = null

    // currentRoom.value.npcs should always be an array of enriched NPC objects
    for (const npcData of currentRoom.value.npcs) {
      const npcNameLower = npcData.name.toLowerCase()
      const npcIdLower = npcData.id.toLowerCase()
      
      // Check for exact match first
      if (npcNameLower === normalizedInput || npcIdLower === normalizedInput) {
        matchedNpcId = npcData.id
        matchedNpcName = npcData.name
        break
      }
      
      // Check for partial match
      if (npcNameLower.includes(normalizedInput) || npcIdLower.includes(normalizedInput) ||
          normalizedInput.includes(npcNameLower) || normalizedInput.includes(npcIdLower)) {
        matchedNpcId = npcData.id
        matchedNpcName = npcData.name
        // Don't break - continue looking for exact match
      }
    }

    if (!matchedNpcId) {
      addGameOutput(`There's no "${npcName}" here to talk to.`, 'warning')
      return
    }

    // Show feedback if the match wasn't exact
    if (matchedNpcName && matchedNpcName.toLowerCase() !== npcName.toLowerCase()) {
      addGameOutput(`("${matchedNpcName}")`, "input")
    }

    try {
      // Send talk request to server with exact NPC ID
      const response = await $fetch('/api/player/talk', {
        method: 'POST',
        body: { npcId: matchedNpcId }
      }) as any

      if (response.success) {
        // Display NPC greeting
        addGameOutput(`${response.npc.name}: "${response.dialogue.greeting}"`)
        
        // Show available topics if any
        if (response.dialogue.topics && response.dialogue.topics.length > 0) {
          const topicsList = response.dialogue.topics.join(', ')
          addGameOutput(`Topics: ${topicsList}`)
        }
      } else {
        addGameOutput(response.message, 'warning')
      }
    } catch (error) {
      console.error('Talk error:', error)
      addGameOutput('Failed to talk to NPC. Please try again.', 'error')
    }
  }

  const handleAsk = async (input: string): Promise<void> => {
    // Parse "ask [npc] about [topic]" format
    const parts = input.split(' about ')
    if (parts.length !== 2) {
      addGameOutput("Use format: ask [npc] about [topic]", 'warning')
      return
    }

    const npcName = parts[0]?.trim() || ''
    const topic = parts[1]?.trim() || ''

    if (!npcName || !topic) {
      addGameOutput("Use format: ask [npc] about [topic]", 'warning')
      return
    }

    // Check if there are NPCs in current room
    if (!currentRoom.value || !currentRoom.value.npcs || currentRoom.value.npcs.length === 0) {
      addGameOutput("There's no one here to ask.", 'warning')
      return
    }

    // Client-side fuzzy matching for NPCs using enriched data
    const normalizedInput = npcName.toLowerCase().trim()
    let matchedNpcId: string | null = null
    let matchedNpcName: string | null = null

    // currentRoom.value.npcs should always be an array of enriched NPC objects
    for (const npcData of currentRoom.value.npcs) {
      const npcNameLower = npcData.name.toLowerCase()
      const npcIdLower = npcData.id.toLowerCase()
      
      // Check for exact match first
      if (npcNameLower === normalizedInput || npcIdLower === normalizedInput) {
        matchedNpcId = npcData.id
        matchedNpcName = npcData.name
        break
      }
      
      // Check for partial match
      if (npcNameLower.includes(normalizedInput) || npcIdLower.includes(normalizedInput) ||
          normalizedInput.includes(npcNameLower) || normalizedInput.includes(npcIdLower)) {
        matchedNpcId = npcData.id
        matchedNpcName = npcData.name
        // Don't break - continue looking for exact match
      }
    }

    if (!matchedNpcId) {
      addGameOutput(`There's no "${npcName}" here to ask.`, 'warning')
      return
    }

    // Show feedback if the match wasn't exact
    if (matchedNpcName && matchedNpcName.toLowerCase() !== npcName.toLowerCase()) {
      addGameOutput(`("${matchedNpcName}")`, "input")
    }

    try {
      // Send ask request to server with exact NPC ID
      const response = await $fetch('/api/player/ask', {
        method: 'POST',
        body: { npcId: matchedNpcId, topic }
      }) as any

      if (response.success) {
        // Special formatting for quest topics - no quotes needed
        if (response.topic === 'quests') {
          addGameOutput(`${response.npc.name}:${response.response}`)
          // Store quest context for immersive acceptance
          if (response.availableQuests && response.availableQuests.length > 0) {
            questContext = {
              npcId: response.npc.id,
              npcName: response.npc.name,
              availableQuests: response.availableQuests
            }
          }
        } else {
          addGameOutput(`${response.npc.name}: "${response.response}"`)
        }
      } else {
        addGameOutput(response.message, 'warning')
      }
    } catch (error) {
      console.error('Ask error:', error)
      addGameOutput('Failed to ask NPC. Please try again.', 'error')
    }
  }

  const handleQuest = async (subCommand?: string): Promise<void> => {
    if (!subCommand || subCommand === 'list') {
      // Show active quests
      try {
        const response: any = await $fetch('/api/player/quest/list', {
          method: 'POST',
          body: {
            playerId: player.value.id
          }
        })

        if (response.success) {
          if (!response.activeQuests || response.activeQuests.length === 0) {
            addGameOutput("You have no active quests.")
            questAbandonContext = null
          } else {
            addGameOutput("\n=== Active Quests ===")
            const questsForAbandon = []
            
            for (let i = 0; i < response.activeQuests.length; i++) {
              const quest = response.activeQuests[i]
              const questNumber = i + 1
              addGameOutput(`${questNumber}. ${quest.title || quest.id}`)
              
              // Store quest info for abandonment context
              questsForAbandon.push({
                index: questNumber,
                id: quest.id,
                title: quest.title || quest.id
              })
              
              // Display objectives with progress
              if (quest.objectives) {
                Object.keys(quest.objectives).forEach(objType => {
                  if (Array.isArray(quest.objectives[objType])) {
                    quest.objectives[objType].forEach((obj: any) => {
                      const current = quest.progress?.[objType]?.[obj.item || obj.enemy] || 0
                      const target = obj.quantity || obj.target || 1
                      addGameOutput(`   ${obj.description}: ${current}/${target}`)
                    })
                  }
                })
              }
            }
            
            // Store context for abandonment
            questAbandonContext = {
              activeQuests: questsForAbandon
            }
          }
        }
      } catch (error) {
        console.error('Quest list error:', error)
        addGameOutput('Failed to retrieve quest list.', 'error')
      }
    } else {
      addGameOutput("Use 'quest' or 'quest list' to see your active quests.", 'warning')
    }
  }

  const handleAcceptQuest = async (input: string): Promise<void> => {
    let questId: string | null = null

    // Handle numbered quest selection (e.g., "accept 1", "accept 2")
    if (/^\d+$/.test(input)) {
      const questNumber = parseInt(input)
      if (questContext && questContext.availableQuests.length > 0) {
        const selectedQuest = questContext.availableQuests.find(q => q.index === questNumber)
        if (selectedQuest) {
          questId = selectedQuest.id
        } else {
          addGameOutput(`Invalid quest number. Available quests: 1-${questContext.availableQuests.length}`, 'warning')
          return
        }
      } else {
        addGameOutput("No quest available. Ask an NPC about quests first.", 'warning')
        return
      }
    }
    // Handle context-aware acceptance (e.g., just "accept" when only one quest)
    else if (!input && questContext && questContext.availableQuests.length === 1) {
      questId = questContext.availableQuests[0]?.id || null
    }
    // Handle direct quest ID (legacy support)
    else if (input && !/^\d+$/.test(input)) {
      questId = input
    }
    else if (!input) {
      if (questContext && questContext.availableQuests.length > 1) {
        addGameOutput(`Multiple quests available from ${questContext.npcName}. Use 'accept 1', 'accept 2', etc.`, 'warning')
        return
      } else {
        addGameOutput("No quest available. Ask an NPC about quests first.", 'warning')
        return
      }
    }

    if (!questId) {
      addGameOutput("Unable to determine which quest to accept.", 'warning')
      return
    }

    try {
      const response: any = await $fetch('/api/player/quest/accept', {
        method: 'POST',
        body: {
          playerId: player.value.id,
          questId: questId
        }
      })

      if (response.success) {
        addGameOutput(response.message, 'success')
        if (response.quest) {
          addGameOutput(`\n${response.quest.description}`)
          addGameOutput("\nObjectives:")
          
          // Handle the objectives structure {gather: [...], kill: [...], fetch: [...]}
          const objectives = response.quest.objectives
          if (objectives) {
            Object.keys(objectives).forEach(objType => {
              if (Array.isArray(objectives[objType])) {
                objectives[objType].forEach((obj: any) => {
                  addGameOutput(`• ${obj.description} (0/${obj.quantity || obj.target || 1})`)
                })
              }
            })
          }
        }
        // Clear quest context after successful acceptance
        questContext = null
      } else {
        addGameOutput(response.message, 'warning')
      }
    } catch (error) {
      console.error('Quest accept error:', error)
      addGameOutput('Failed to accept quest.', 'error')
    }
  }

  const handleAbandonQuest = async (input: string): Promise<void> => {
    let questId: string | null = null

    // Handle numbered quest selection (e.g., "abandon 1", "abandon 2")
    if (/^\d+$/.test(input)) {
      const questNumber = parseInt(input)
      if (questAbandonContext && questAbandonContext.activeQuests.length > 0) {
        const selectedQuest = questAbandonContext.activeQuests.find(q => q.index === questNumber)
        if (selectedQuest) {
          questId = selectedQuest.id
        } else {
          addGameOutput(`Invalid quest number. Available quests: 1-${questAbandonContext.activeQuests.length}`, 'warning')
          return
        }
      } else {
        addGameOutput("No quest available. Use 'quest' to see your active quests first.", 'warning')
        return
      }
    }
    // Handle context-aware abandonment (e.g., just "abandon" when only one quest)
    else if (!input && questAbandonContext && questAbandonContext.activeQuests.length === 1) {
      questId = questAbandonContext.activeQuests[0]?.id || null
    }
    // Handle direct quest ID (legacy support)
    else if (input && !/^\d+$/.test(input)) {
      questId = input.trim()
    }
    else if (!input) {
      if (questAbandonContext && questAbandonContext.activeQuests.length > 1) {
        addGameOutput(`Multiple active quests. Use 'abandon 1', 'abandon 2', etc.`, 'warning')
        return
      } else {
        addGameOutput("No quest available. Use 'quest' to see your active quests first.", 'warning')
        return
      }
    }

    if (!questId) {
      addGameOutput("Unable to determine which quest to abandon.", 'warning')
      return
    }

    try {
      const response: any = await $fetch('/api/player/quest/abandon', {
        method: 'POST',
        body: {
          playerId: player.value.id,
          questId: questId
        }
      })

      if (response.success) {
        addGameOutput(response.message, 'success')
        
        // Clear abandon context after successful abandonment
        questAbandonContext = null
        
        // Note: Player data will be refreshed on next command or page reload
      } else {
        addGameOutput(response.message, 'warning')
      }
    } catch (error) {
      console.error('Quest abandon error:', error)
      addGameOutput('Failed to abandon quest.', 'error')
    }
  }

  const handleHelp = (): void => {
    addGameOutput("\n=== MUDDEN - Available Commands ===")
    addGameOutput("")
    
    // Movement commands
    addGameOutput("MOVEMENT:")
    addGameOutput("  look, l              - Examine your surroundings")
    addGameOutput("  go [direction]       - Move in a direction")
    addGameOutput("  north, n             - Go north")
    addGameOutput("  south, s             - Go south") 
    addGameOutput("  east, e              - Go east")
    addGameOutput("  west, w              - Go west")
    addGameOutput("")
    
    // Inventory commands
    addGameOutput("INVENTORY:")
    addGameOutput("  inventory, inv, i    - View your items")
    addGameOutput("  take [item]          - Pick up an item")
    addGameOutput("  get [item]           - Same as take")
    addGameOutput("  use [item]           - Use an item from inventory")
    addGameOutput("  equip [item]         - Equip a weapon or armor")
    addGameOutput("  unequip [item]       - Unequip a weapon or armor")
    addGameOutput("")
    
    // Social commands
    addGameOutput("SOCIAL:")
    addGameOutput("  talk [npc]           - Start conversation with an NPC")
    addGameOutput("  ask [npc] about [topic] - Ask NPC about a specific topic")
    addGameOutput("  speak [npc]          - Same as talk")
    addGameOutput("")
    
    // Quest commands
    addGameOutput("QUESTS:")
    addGameOutput("  quest, quests        - Show your active quests (numbered for abandonment)")
    addGameOutput("  ask [npc] about quests - See available quests from an NPC")
    addGameOutput("  accept [number]      - Accept a quest (numbered from 'ask about quests')")
    addGameOutput("  abandon [number]     - Abandon an active quest (numbered from 'quest')") 
    addGameOutput("")
    
    // Information commands
    addGameOutput("INFO:")
    addGameOutput("  stats                - Show detailed character stats")
    addGameOutput("  help                 - Show this help menu")
    addGameOutput("")
    
    // Tips
    addGameOutput("TIPS:")
    addGameOutput("  - Use the quick command buttons below for easy access")
    addGameOutput("  - Commands are case-insensitive") 
    addGameOutput("  - You can use abbreviations (n for north, inv for inventory)")
    addGameOutput("  - Explore rooms to find items you can take!")
    addGameOutput("")
    addGameOutput("=== Welcome to your adventure! ===")
  }

  const handleStats = async (): Promise<void> => {
    addGameOutput("\n=== Character Stats ===")
    addGameOutput(`Name: ${player.value.name}`)
    addGameOutput(`Level: ${player.value.level}`)
    addGameOutput(`Health: ${player.value.health}/${player.value.maxHealth}`)
    addGameOutput(`Experience: ${player.value.experience}`)
    addGameOutput(`Gold: ${player.value.gold}`)
    addGameOutput(`Location: ${currentRoom.value?.title || 'Unknown'}`)
    
    // Show equipped items from the new equipment system
    try {
      const equippedResponse = await $fetch('/api/player/equipment') as any
      if (equippedResponse.success && equippedResponse.equippedItems.length > 0) {
        addGameOutput("\n=== Equipped Items ===")
        equippedResponse.equippedItems.forEach((equippedItem: any) => {
          const effects = equippedItem.effects || {}
          const effectsText = Object.entries(effects)
            .map(([key, value]) => `${key}: +${value}`)
            .join(', ')
          const displaySlot = equippedItem.slot ? getSlotDisplayName(equippedItem.slot) : ''
          const slotText = displaySlot ? ` [${displaySlot}]` : ''
          addGameOutput(`${equippedItem.name}${slotText}${effectsText ? ` (${effectsText})` : ''}`)
        })
      }
    } catch (error) {
      console.error('Failed to load equipped items for stats:', error)
    }
  }

  const handleEquip = async (itemName: string): Promise<any> => {
    try {
      if (!itemName) {
        addGameOutput("Equip what?", 'warning')
        return null
      }

      // Use fuzzy matching to find the item in inventory
      const inventoryItems = player.value.inventory.map((invItem: any) => {
        try {
          if (typeof invItem === 'string') {
            return { name: invItem, item: invItem }
          } else if (invItem && invItem.item) {
            return { name: invItem.item.name, item: invItem, itemId: invItem.item.id }
          }
          return null
        } catch (error) {
          console.warn('Error processing inventory item for equip:', invItem, error)
          return null
        }
      }).filter(Boolean)

      const inventoryMatch = findBestMatch(inventoryItems, itemName, 'name')

      if (!inventoryMatch) {
        addGameOutput(`You don't have '${itemName}' in your inventory.`, 'warning')
        return null
      }

      const itemId = inventoryMatch.itemId || inventoryMatch.item.id || inventoryMatch.item
      const matchedName = inventoryMatch.name

      // Show feedback if the match wasn't exact
      if (matchedName && matchedName.toLowerCase() !== itemName.toLowerCase()) {
        addGameOutput(`("${matchedName}")`, "input")
      }

      // Send equip request to server
      const response = await $fetch('/api/player/equip', {
        method: 'POST',
        body: { itemId }
      })

      if (response.success) {
        addGameOutput(response.message, 'success')
        return response
      } else {
        addGameOutput(response.message, 'warning')
        return null
      }

    } catch (error) {
      console.error('Equip error:', error)
      addGameOutput('Failed to equip item. Please try again.', 'error')
      return null
    }
  }

  const handleUnequip = async (itemName: string): Promise<any> => {
    try {
      if (!itemName) {
        addGameOutput("Unequip what?", 'warning')
        return null
      }

      // Get equipped items from the API
      const equippedResponse = await $fetch('/api/player/equipment') as any
      if (!equippedResponse.success || !equippedResponse.equippedItems || equippedResponse.equippedItems.length === 0) {
        addGameOutput("You don't have any items equipped.", 'warning')
        return null
      }

      // Use fuzzy matching to find the item to unequip
      const equippedItems = equippedResponse.equippedItems.map((equippedItem: any) => ({
        name: equippedItem.name,
        itemId: equippedItem.id,
        slot: equippedItem.slot
      }))

      const equippedMatch = findBestMatch(equippedItems, itemName, 'name')

      if (!equippedMatch) {
        addGameOutput(`You don't have '${itemName}' equipped.`, 'warning')
        return null
      }

      const itemId = equippedMatch.itemId
      const matchedName = equippedMatch.name

      // Show feedback if the match wasn't exact
      if (matchedName && matchedName.toLowerCase() !== itemName.toLowerCase()) {
        addGameOutput(`("${matchedName}")`, "input")
      }

      // Send unequip request to server
      const response = await $fetch('/api/player/unequip', {
        method: 'POST',
        body: { itemId }
      })

      if (response.success) {
        addGameOutput(response.message, 'success')
        return response
      } else {
        addGameOutput(response.message, 'warning')
        return null
      }

    } catch (error) {
      console.error('Unequip error:', error)
      addGameOutput('Failed to unequip item. Please try again.', 'error')
      return null
    }
  }

  return {
    executeCommand,
    handleMove,
    handleTake,
    handleLook,
    handleEquip,
    handleUnequip
  }
}