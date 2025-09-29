import BaseCommand from './BaseCommand.js'
import { QUEST_STATUS, OBJECTIVE_TYPES } from '../constants/QuestConstants.js'

class QuestCommands extends BaseCommand {
  getCommands() {
    return {
      // Quest system
      'quest': this.quest.bind(this),
      'q': this.quest.bind(this)  // Short alias for quest commands
    }
  }

  questList(player) {
    let result = `\n=== Quest Journal ===\n`
    
    // Show active quests
    const activeQuests = this.getActiveQuests(player)
    if (activeQuests.length > 0) {
      result += `\nActive Quests:\n`
      activeQuests.forEach(quest => {
        const progress = this.getQuestProgress(player, quest.id)
        result += `• ${quest.name} (${progress})\n`
      })
    }
    
    // Show completed quests (last 5)
    const completedQuests = this.getCompletedQuests(player).slice(-5)
    if (completedQuests.length > 0) {
      result += `\nRecently Completed:\n`
      completedQuests.forEach(quest => {
        result += `• ${quest.name} ✓\n`
      })
    }
    
    if (activeQuests.length === 0 && completedQuests.length === 0) {
      result += `\nYour quest journal is empty. Talk to NPCs to discover quests!\n`
    }
    
    return result
  }

  quest(player, args) {
    if (args.length === 0) {
      return "Usage: quest <list|info|accept|abandon|complete> [quest_name]"
    }

    const action = args[0].toLowerCase()
    const questName = args.slice(1).join(' ')

    switch (action) {
      case 'list':
        return this.questList(player)
      case 'info':
        return this.questInfo(player, questName)
      case 'accept':
        return this.acceptQuest(player, questName)
      case 'abandon':
        return this.abandonQuest(player, questName)
      case 'complete':
        return this.completeQuest(player, questName)
      default:
        return "Quest actions: list, info, accept, abandon, complete"
    }
  }

  questInfo(player, questName) {
    if (!questName) {
      return "Usage: quest info <quest_name>"
    }

    // Find quest by name (fuzzy matching)
    const allQuests = this.gameWorld.getAllQuests()
    const quest = this.findBestMatch(allQuests, questName)
    
    if (!quest) {
      return `Quest "${questName}" not found.`
    }

    // Store quest info for reward item inspection using CtxStateManager
    this.setCtxState(player, 'viewingQuestRewards', quest.rewards?.items || [])

    let result = `\n=== ${quest.name} ===\n`
    result += `${quest.description}\n`
    result += `\nQuest Giver: ${this.gameWorld.getNPC(quest.giver)?.name || quest.giver}\n`
    result += `Recommended Level: ${quest.level}\n`

    // Show objectives
    result += `\nObjectives:\n`
    quest.objectives.forEach((objective, index) => {
      const playerQuest = this.getPlayerQuest(player, quest.id)
      const current = playerQuest ? (playerQuest.objectives[index]?.current || 0) : 0
      const status = current >= objective.quantity ? '✓' : `${current}/${objective.quantity}`
      result += `• ${objective.description} ${status}\n`
    })

    // Show rewards
    if (quest.rewards.experience || quest.rewards.gold || quest.rewards.items?.length) {
      result += `\nRewards:\n`
      if (quest.rewards.experience) result += `• ${quest.rewards.experience} Experience\n`
      if (quest.rewards.gold) result += `• ${quest.rewards.gold} Gold\n`
      if (quest.rewards.items?.length) {
        quest.rewards.items.forEach(itemId => {
          const item = this.gameWorld.getItem(itemId)
          result += `• ${item?.name || itemId}\n`
        })
      }
    }

    return result
  }

  acceptQuest(player, questName) {
    if (!questName) {
      return "Usage: quest accept <quest_name>"
    }

    // Find available quest
    const availableQuests = this.getAvailableQuests(player)
    const quest = this.findBestMatch(availableQuests, questName)
    
    if (!quest) {
      return `No available quest "${questName}" found. Check with quest givers!`
    }

    // Check if quest giver is in current room
    const currentRoom = this.getCurrentRoom(player)
    if (!currentRoom || !currentRoom.npcs) {
      return "There's no one here to give you quests."
    }

    const questGiver = currentRoom.npcs.find(npc => npc.id === quest.giver)
    if (!questGiver) {
      const giverNpc = this.gameWorld.getNPC(quest.giver)
      const giverName = giverNpc ? giverNpc.name : quest.giver
      return `You need to be with ${giverName} to accept this quest.`
    }

    // Check if already accepted
    if (this.hasActiveQuest(player, quest.id)) {
      return `You already have "${quest.name}" in progress.`
    }

    // Add quest to player and check existing inventory
    const playerQuest = {
      id: quest.id,
      status: 'accepted',
      acceptedAt: Date.now(),
      objectives: quest.objectives.map(obj => ({ ...obj, current: 0 }))
    }
    
    player.quests = player.quests || []
    player.quests.push(playerQuest)

    // Sync quest progress with player's current inventory
    player.syncQuestProgressWithInventory()

    // For collect quests where items are given by quest giver, add them to inventory
    let givenItemsMessage = ""
    for (const objective of quest.objectives) {
      if (objective.type === OBJECTIVE_TYPES.COLLECT && objective.givenByQuestGiver) {
        // Add the item to player's inventory
        player.addItem(objective.target, objective.quantity)
        
        const itemTemplate = this.gameWorld.getItem(objective.target)
        const itemName = itemTemplate ? itemTemplate.name : objective.target
        givenItemsMessage += `\nYou received: ${itemName}`
      }
    }

    player.save()

    let result = `Quest accepted: ${quest.name}`

    if (givenItemsMessage) {
      result += givenItemsMessage
    }
    
    return result
  }

  abandonQuest(player, questName) {
    if (!questName) {
      return "Usage: quest abandon <quest_name>"
    }

    // Find active quest
    const activeQuests = this.getActiveQuests(player)
    const quest = this.findBestMatch(activeQuests, questName)
    
    if (!quest) {
      return `No active quest "${questName}" found.`
    }

    // Handle quest item removal for items given by quest giver
    let removedItemsMessage = ""
    for (const objective of quest.objectives) {
      if (objective.type === OBJECTIVE_TYPES.COLLECT && objective.givenByQuestGiver) {
        // Find and remove quest-given items from inventory
        const playerItem = player.inventory.find(item => item.id === objective.target)
        if (playerItem) {
          const removeQuantity = Math.min(playerItem.quantity, objective.quantity)
          player.removeItem(objective.target, removeQuantity)
          
          const itemTemplate = this.gameWorld.getItem(objective.target)
          const itemName = itemTemplate ? itemTemplate.name : objective.target
          removedItemsMessage += `\n${itemName} removed from inventory.`
        }
      }
    }

    // Remove quest from player
    player.quests = player.quests.filter(q => q.id !== quest.id)
    player.save()

    return `Quest abandoned: ${quest.name}${removedItemsMessage}`
  }

  // Helper methods
  getPlayerQuest(player, questId) {
    if (!player.quests) return null
    return player.quests.find(q => q.id === questId)
  }

  hasActiveQuest(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    return playerQuest && playerQuest.status === QUEST_STATUS.ACCEPTED
  }

  hasCompletedQuest(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    return playerQuest && playerQuest.status === QUEST_STATUS.COMPLETED
  }

  getActiveQuests(player) {
    if (!player.quests) return []
    return player.quests
      .filter(pq => pq.status === QUEST_STATUS.ACCEPTED)
      .map(pq => this.gameWorld.getQuest(pq.id))
      .filter(Boolean)
  }

  getCompletedQuests(player) {
    if (!player.quests) return []
    return player.quests
      .filter(pq => pq.status === QUEST_STATUS.COMPLETED)
      .map(pq => this.gameWorld.getQuest(pq.id))
      .filter(Boolean)
  }

  getAvailableQuests(player) {
    const allQuests = this.gameWorld.getAllQuests()
    return allQuests.filter(quest => {
      // Not already accepted or completed
      if (this.hasActiveQuest(player, quest.id) || this.hasCompletedQuest(player, quest.id)) {
        return false
      }

      // Check prerequisites
      if (quest.prerequisites) {
        // Level requirement
        if (quest.prerequisites.level && player.level < quest.prerequisites.level) {
          return false
        }

        // Required quests
        if (quest.prerequisites.quests) {
          for (const reqQuest of quest.prerequisites.quests) {
            if (!this.hasCompletedQuest(player, reqQuest)) {
              return false
            }
          }
        }

        // Required items
        if (quest.prerequisites.items) {
          for (const reqItem of quest.prerequisites.items) {
            if (!player.hasItem(reqItem)) {
              return false
            }
          }
        }
      }

      return true
    })
  }

  getQuestProgress(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    if (!playerQuest) return "0%"

    const quest = this.gameWorld.getQuest(questId)
    if (!quest) return "0%"

    let completed = 0
    let total = quest.objectives.length

    quest.objectives.forEach((objective, index) => {
      const current = playerQuest.objectives[index]?.current || 0
      if (current >= objective.quantity) {
        completed++
      }
    })

    const percentage = Math.floor((completed / total) * 100)
    return `${percentage}%`
  }

  // Quest progression methods (called by other systems)
  updateQuestProgress(player, type, target, quantity = 1) {
    if (!player.quests) return

    let updated = false

    for (const playerQuest of player.quests) {
      if (playerQuest.status !== QUEST_STATUS.ACCEPTED) continue

      const quest = this.gameWorld.getQuest(playerQuest.id)
      if (!quest) continue

      quest.objectives.forEach((objective, index) => {
        if (objective.type === type && objective.target === target) {
          const current = playerQuest.objectives[index].current || 0
          playerQuest.objectives[index].current = Math.min(current + quantity, objective.quantity)
          updated = true
        }
      })

      // Check if quest is complete
      const isComplete = quest.objectives.every((objective, index) => {
        const current = playerQuest.objectives[index]?.current || 0
        return current >= objective.quantity
      })

      if (isComplete && playerQuest.status === QUEST_STATUS.ACCEPTED) {
        // Don't auto-complete, let player turn in
        // But we could add a notification here
      }
    }

    if (updated) {
      player.save()
    }

    return updated
  }

  // Complete quest (new unified command)
  completeQuest(player, questName) {
    // Find matching quest by name
    const activeQuests = this.getActiveQuests(player)
    const quest = this.findBestMatch(activeQuests, questName)
    
    if (!quest) {
      return `Quest "${questName}" not found in your active quests.`
    }

    // Check if appropriate NPC is in current room
    const currentRoom = this.getCurrentRoom(player)
    if (!currentRoom || !currentRoom.npcs) {
      return "There's no one here to turn in quests to."
    }

    // Use turnInNpc if specified, otherwise use quest giver
    const turnInNpcId = quest.turnInNpc || quest.giver
    const turnInNpc = currentRoom.npcs.find(npc => npc.id === turnInNpcId)
    
    if (!turnInNpc) {
      const npcTemplate = this.gameWorld.getNPC(turnInNpcId)
      const npcName = npcTemplate ? npcTemplate.name : turnInNpcId
      return `You need to be with ${npcName} to turn in this quest.`
    }

    // Delegate to turnInQuest for all validation and completion logic
    const result = this.turnInQuest(player, quest.id)
    
    if (result.success) {
      let message = `\n${quest.name} completed!\n`
      message += `"${result.message}"\n`
      if (result.rewards) {
        message += `\nRewards: ${result.rewards}\n`
      }
      return message
    } else {
      return result.message
    }
  }

  // Turn in quest (called from NPC interaction)
  turnInQuest(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    if (!playerQuest || playerQuest.status !== QUEST_STATUS.ACCEPTED) {
      return { success: false, message: "Quest not found or not active." }
    }

    const quest = this.gameWorld.getQuest(questId)
    if (!quest) {
      return { success: false, message: "Quest template not found." }
    }

    // Check if all objectives are complete
    const isComplete = quest.objectives.every((objective, index) => {
      const current = playerQuest.objectives[index]?.current || 0
      return current >= objective.quantity
    })

    if (!isComplete) {
      return { success: false, message: "Quest objectives not completed yet." }
    }

    // Remove items from inventory for all collect objectives
    for (const objective of quest.objectives) {
      if (objective.type === OBJECTIVE_TYPES.COLLECT) {
        console.log(`DEBUG: Removing ${objective.quantity}x ${objective.target} from inventory`)
        console.log(`DEBUG: Player has item before removal:`, player.hasItem(objective.target, objective.quantity))
        const removed = player.removeItem(objective.target, objective.quantity)
        console.log(`DEBUG: Item removal result:`, removed)
        console.log(`DEBUG: Player has item after removal:`, player.hasItem(objective.target, objective.quantity))
      }
    }

    // Mark quest as completed
    playerQuest.status = QUEST_STATUS.COMPLETED
    playerQuest.completedAt = Date.now()

    // Give rewards
    let rewardMessage = ""
    
    if (quest.rewards.experience) {
      player.experience = (player.experience || 0) + quest.rewards.experience
      rewardMessage += `+${quest.rewards.experience} XP `
    }
    
    if (quest.rewards.gold) {
      player.gold += quest.rewards.gold
      rewardMessage += `+${quest.rewards.gold} gold `
    }
    
    if (quest.rewards.items) {
      quest.rewards.items.forEach(itemId => {
        player.addItem(itemId, 1)
        const item = this.gameWorld.getItem(itemId)
        rewardMessage += `+${item?.name || itemId} `
      })
    }

    player.save()

    return {
      success: true,
      message: quest.dialogue.complete,
      rewards: rewardMessage.trim()
    }
  }
}

export default QuestCommands