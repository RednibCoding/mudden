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
      return this.questList(player)
    }

    const action = args[0].toLowerCase()
    const questName = args.slice(1).join(' ')

    switch (action) {
      case 'list':
        return this.questList(player)
      case 'info':
      case 'i':
        return this.questInfo(player, questName)
      case 'accept':
      case 'a':
        return this.acceptQuest(player, questName)
      case 'abandon':
      case 'ab':
        return this.abandonQuest(player, questName)
      case 'complete':
      case 'c':
        return this.completeQuest(player, questName)
      case 'look':
      case 'l':
        return this.questLook(player, questName)
      default:
        return "Quest actions: list, info|i, accept|a, abandon|ab, complete|c, look|l"
    }
  }

  questLook(player, itemName) {
    if (!itemName) {
      return "Usage: quest look <item_name> - Look at quest reward items from your active quests"
    }

    const rewardItems = this.getQuestRewardItems(player)
    if (rewardItems.length === 0) {
      return "You have no quest reward items to examine from your active quests."
    }

    const bestMatch = this.findBestQuestRewardMatch(rewardItems, itemName)
    if (!bestMatch) {
      return `No quest reward item matching "${itemName}" found in your active quests.`
    }

    return this.formatQuestRewardItem(bestMatch.item, bestMatch.questName)
  }

  // Quest utility methods
  getQuestRewardItems(player) {
    const activeQuests = this.getActiveQuests(player)
    const rewardItems = []
    
    for (const quest of activeQuests) {
      if (quest.rewards?.items) {
        for (const itemId of quest.rewards.items) {
          const itemTemplate = this.worldManager.templateManager.getItem(itemId)
          if (itemTemplate) {
            rewardItems.push({ item: itemTemplate, questName: quest.name })
          }
        }
      }
    }
    
    return rewardItems
  }

  findBestQuestRewardMatch(rewardItems, itemName) {
    let bestMatch = null
    let bestScore = 0
    
    for (const rewardItem of rewardItems) {
      const score = this.calculateMatchScore(rewardItem.item.name, itemName)
      if (score > bestScore && score >= 60) {
        bestScore = score
        bestMatch = rewardItem
      }
    }
    
    return bestMatch
  }

  formatQuestRewardItem(item, questName) {
    let result = `\n=== ${item.name} (Quest Reward from "${questName}") ===\n`
    result += `${item.description}\n`
    
    if (item.type) result += `Type: ${item.type}\n`
    result += this.formatItemProperties(item)
    if (item.value) result += `Value: ${item.value} gold\n`
    
    return result
  }

  formatItemProperties(item) {
    let result = ''
    
    if (item.stats && Object.keys(item.stats).length > 0) {
      result += `Stats:\n`
      for (const [stat, value] of Object.entries(item.stats)) {
        result += `  ${stat}: ${value}\n`
      }
    }
    
    if (item.effects && Object.keys(item.effects).length > 0) {
      result += `Effects:\n`
      for (const [effect, value] of Object.entries(item.effects)) {
        result += `  ${effect}: +${value}\n`
      }
    }
    
    return result
  }

  questInfo(player, questName) {
    if (!questName) return "Usage: quest info <quest_name>"

    // Only search through the player's active quests
    const activeQuests = this.getActiveQuests(player)
    const quest = this.findBestMatch(activeQuests, questName)
    if (!quest) return `Quest "${questName}" not found in your active quests. Use 'quest list' to see your active quests.`

    return this.formatQuestInfo(player, quest)
  }

  formatQuestInfo(player, quest) {
    const playerQuest = this.getPlayerQuest(player, quest.id)
    const isCompleted = playerQuest?.status === QUEST_STATUS.COMPLETED
    const questTitle = isCompleted ? `${quest.name} (Completed)` : quest.name
    
    let result = `\n=== ${questTitle} ===\n${quest.description}\n`
    
    const npcName = this.worldManager.templateManager.getNPC(quest.giver)?.name || quest.giver
    result += `\nQuest Giver: ${npcName}\n`
    result += `Recommended Level: ${quest.level}\n`
    
    result += this.formatQuestObjectives(player, quest)
    result += this.formatQuestRewards(quest)
    
    return result
  }

  formatQuestObjectives(player, quest) {
    let result = `\nObjectives:\n`
    const playerQuest = this.getPlayerQuest(player, quest.id)
    
    quest.objectives.forEach((objective, index) => {
      const current = playerQuest?.objectives[index]?.current || 0
      const status = current >= objective.quantity ? '✓' : `${current}/${objective.quantity}`
      result += `• ${objective.description} ${status}\n`
    })
    
    return result
  }

  formatQuestRewards(quest) {
    const { rewards } = quest
    if (!rewards.experience && !rewards.gold && !rewards.items?.length) return ''
    
    let result = `\nRewards:\n`
    if (rewards.experience) result += `• ${rewards.experience} Experience\n`
    if (rewards.gold) result += `• ${rewards.gold} Gold\n`
    
    if (rewards.items?.length) {
      rewards.items.forEach(itemId => {
        const item = this.worldManager.templateManager.getItem(itemId)
        result += `• ${item?.name || itemId}\n`
      })
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
      const giverNpc = this.worldManager.templateManager.getNPC(quest.giver)
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
    
    player.activeQuests = player.activeQuests || []
    player.activeQuests.push(playerQuest)

    // Sync quest progress with player's current inventory
    player.syncQuestProgressWithInventory()

    // For collect quests where items are given by quest giver, add them to inventory
    let givenItemsMessage = ""
    for (const objective of quest.objectives) {
      if (objective.type === OBJECTIVE_TYPES.COLLECT && objective.givenByQuestGiver) {
        // Add the item to player's inventory
        player.addItem(objective.target, objective.quantity)
        
        const itemTemplate = this.worldManager.templateManager.getItem(objective.target)
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
          
          const itemTemplate = this.worldManager.templateManager.getItem(objective.target)
          const itemName = itemTemplate ? itemTemplate.name : objective.target
          removedItemsMessage += `\n${itemName} removed from inventory.`
        }
      }
    }

    // Remove quest from player's active quests
    player.activeQuests = player.activeQuests.filter(q => q.id !== quest.id)
    player.save()

    return `Quest abandoned: ${quest.name}${removedItemsMessage}`
  }

  // Helper methods
  getPlayerQuest(player, questId) {
    if (!player.activeQuests) return null
    return player.activeQuests.find(q => q.id === questId)
  }

  hasActiveQuest(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    return playerQuest && playerQuest.status === QUEST_STATUS.ACCEPTED
  }

  hasCompletedQuest(player, questId) {
    if (!player.completedQuests) return false
    return player.completedQuests.includes(questId)
  }

  getActiveQuests(player) {
    if (!player.activeQuests) return []
    return player.activeQuests
      .map(pq => this.worldManager.templateManager.getQuest(pq.id))
      .filter(Boolean)
  }

  getCompletedQuests(player) {
    if (!player.completedQuests) return []
    return player.completedQuests
      .map(questId => this.worldManager.templateManager.getQuest(questId))
      .filter(Boolean)
  }

  getAvailableQuests(player) {
    return this.worldManager.getAllQuests().filter(quest => 
      !this.hasActiveQuest(player, quest.id) && 
      !this.hasCompletedQuest(player, quest.id) &&
      this.meetsQuestPrerequisites(player, quest)
    )
  }

  meetsQuestPrerequisites(player, quest) {
    if (!quest.prerequisites) return true
    
    const { level, quests, items } = quest.prerequisites
    
    // Check level requirement
    if (level && player.level < level) return false
    
    // Check required quests
    if (quests && !quests.every(reqQuest => this.hasCompletedQuest(player, reqQuest))) {
      return false
    }
    
    // Check required items
    if (items && !items.every(reqItem => player.hasItem(reqItem))) {
      return false
    }
    
    return true
  }

  getQuestProgress(player, questId) {
    const playerQuest = this.getPlayerQuest(player, questId)
    const quest = this.worldManager.templateManager.getQuest(questId)
    
    if (!playerQuest || !quest) return "0%"

    const completed = quest.objectives.reduce((count, objective, index) => {
      const current = playerQuest.objectives[index]?.current || 0
      return count + (current >= objective.quantity ? 1 : 0)
    }, 0)

    return `${Math.floor((completed / quest.objectives.length) * 100)}%`
  }

  // Quest progression methods (called by other systems)
  updateQuestProgress(player, type, targetId, amount = 1) {
    if (!player.activeQuests) return false

    let updated = false

    for (const playerQuest of player.activeQuests) {
      if (playerQuest.status !== QUEST_STATUS.ACCEPTED) continue

      const quest = this.worldManager.templateManager.getQuest(playerQuest.id)
      if (!quest) continue

      quest.objectives.forEach((objective, index) => {
        if (objective.type === type && objective.target === targetId) {
          const current = playerQuest.objectives[index].current || 0
          playerQuest.objectives[index].current = Math.min(current + amount, objective.quantity)
          updated = true
        }
      })
    }

    if (updated) player.save()
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
      const npcTemplate = this.worldManager.templateManager.getNPC(turnInNpcId)
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
    const quest = this.worldManager.templateManager.getQuest(questId)
    
    if (!playerQuest || playerQuest.status !== QUEST_STATUS.ACCEPTED) {
      return { success: false, message: "Quest not found or not active." }
    }
    
    if (!quest) {
      return { success: false, message: "Quest template not found." }
    }

    if (!this.isQuestComplete(quest, playerQuest)) {
      return { success: false, message: "Quest objectives not completed yet." }
    }

    this.processQuestCompletion(player, quest, questId)
    const rewardMessage = this.giveQuestRewards(player, quest)
    
    player.save()

    return {
      success: true,
      message: quest.dialogue.complete,
      rewards: rewardMessage
    }
  }

  isQuestComplete(quest, playerQuest) {
    return quest.objectives.every((objective, index) => {
      const current = playerQuest.objectives[index]?.current || 0
      return current >= objective.quantity
    })
  }

  processQuestCompletion(player, quest, questId) {
    // Remove collect objective items
    quest.objectives.forEach(objective => {
      if (objective.type === OBJECTIVE_TYPES.COLLECT) {
        player.removeItem(objective.target, objective.quantity)
      }
    })

    // Move quest to completed
    player.activeQuests = player.activeQuests.filter(q => q.id !== questId)
    player.completedQuests = player.completedQuests || []
    player.completedQuests.push(questId)
  }

  giveQuestRewards(player, quest) {
    const rewards = []
    
    if (quest.rewards.experience) {
      const levelsGained = player.addExperience(quest.rewards.experience)
      rewards.push(`+${quest.rewards.experience} XP`)
      if (levelsGained > 0) {
        rewards.push(`(LEVEL UP! Now level ${player.level})`)
      }
    }
    
    if (quest.rewards.gold) {
      player.gold += quest.rewards.gold
      rewards.push(`+${quest.rewards.gold} gold`)
    }
    
    if (quest.rewards.items) {
      quest.rewards.items.forEach(itemId => {
        player.addItem(itemId, 1)
        const item = this.worldManager.templateManager.getItem(itemId)
        rewards.push(`+${item?.name || itemId}`)
      })
    }

    return rewards.join(' ')
  }
}

export default QuestCommands