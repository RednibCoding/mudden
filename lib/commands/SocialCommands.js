import BaseCommand from './BaseCommand.js'

class SocialCommands extends BaseCommand {
  getCommands() {
    return {
      // Social
      'say': this.say.bind(this),
      'tell': this.tell.bind(this),
      'talk': this.talk.bind(this),
      'speak': this.talk.bind(this),
      'ask': this.ask.bind(this),
      'turn in': this.turnIn.bind(this),
      'turn': this.turnIn.bind(this)
    }
  }

  say(player, args) {
    if (args.length === 0) {
      return "Say what?"
    }

    const message = args.join(' ')
    const playersInRoom = this.getPlayersInRoom(player.currentArea, player.currentRoom, player)
    
    // Send message to all players in the same room
    playersInRoom.forEach(otherPlayer => {
      if (otherPlayer.socket) {
        otherPlayer.socket.emit('message', `${player.name} says: "${message}"`)
      }
    })
    
    return `You say: "${message}"`
  }

  tell(player, args) {
    if (args.length < 2) {
      return "Usage: tell <player> <message>"
    }

    const targetName = args[0]
    const message = args.slice(1).join(' ')
    
    const targetPlayer = this.findPlayerByName(targetName)
    
    if (!targetPlayer) {
      return `Player "${targetName}" is not online.`
    }
    
    if (targetPlayer === player) {
      return "You can't send a message to yourself."
    }
    
    // Send private message
    if (targetPlayer.socket) {
      targetPlayer.socket.emit('message', `${player.name} tells you: "${message}"`)
    }
    
    return `You tell ${targetPlayer.name}: "${message}"`
  }

  talk(player, args) {
    if (args.length === 0) {
      return "Talk to whom?"
    }

    const npcName = args.join(' ')
    const room = this.getCurrentRoom(player)
    
    if (!room || !room.npcs) {
      return "There's nobody here to talk to."
    }

    // Find NPC in the room
    const npc = this.findBestMatch(room.npcs, npcName)
    if (!npc) {
      return `You don't see "${npcName}" here.`
    }

    let result = `\n=== Talking to ${npc.name} ===\n`
    result += `${npc.dialogue.greeting}\n`
    
    // Check for available quests
    if (npc.quests && npc.quests.length > 0) {
      const questSystem = this.gameWorld.questSystem
      if (questSystem) {
        const availableQuests = npc.quests
          .map(qId => this.gameWorld.getQuest(qId))
          .filter(q => q && questSystem.getAvailableQuests(player).includes(q))
        
        const activeQuests = npc.quests
          .map(qId => this.gameWorld.getQuest(qId))
          .filter(q => q && questSystem.hasActiveQuest(player, q.id))
        
        const completableQuests = activeQuests.filter(q => {
          const playerQuest = questSystem.getPlayerQuest(player, q.id)
          return q.objectives.every((objective, index) => {
            const current = playerQuest.objectives[index]?.current || 0
            return current >= objective.quantity
          })
        })

        if (availableQuests.length > 0) {
          result += `\n[!] ${npc.name} has quests available!\n`
        }
        
        if (completableQuests.length > 0) {
          result += `\n[✓] You can turn in completed quests here!\n`
        }
      }
    }
    
    if (npc.dialogue.responses && Object.keys(npc.dialogue.responses).length > 0) {
      result += `\nTopics you can ask about:\n`
      for (const topic of Object.keys(npc.dialogue.responses)) {
        result += `• ${topic}\n`
      }
      
      // Add quest topic if NPC has quests
      if (npc.quests && npc.quests.length > 0) {
        result += `• quests\n`
      }
    }

    return result
  }

  ask(player, args) {
    if (args.length < 3 || args[1].toLowerCase() !== 'about') {
      return "Usage: ask <npc> about <topic>"
    }

    const npcName = args[0]
    const topic = args.slice(2).join(' ').toLowerCase()
    const room = this.getCurrentRoom(player)
    
    if (!room || !room.npcs) {
      return "There's nobody here to ask."
    }

    // Find NPC in the room
    const npc = this.findBestMatch(room.npcs, npcName)
    if (!npc) {
      return `You don't see "${npcName}" here.`
    }

    if (!npc.dialogue.responses) {
      return `${npc.name} doesn't seem interested in conversation.`
    }

    // Handle quest topic specially
    if (topic === 'quests' || topic === 'quest') {
      return this.handleQuestTopic(player, npc)
    }

    // Find matching topic (fuzzy match)
    const topics = Object.keys(npc.dialogue.responses)
    let bestMatch = null
    let bestScore = 0

    for (const availableTopic of topics) {
      const score = this.calculateMatchScore(availableTopic, topic)
      if (score > bestScore && score >= 60) { // Require at least 60% match
        bestScore = score
        bestMatch = availableTopic
      }
    }

    if (bestMatch) {
      let result = `\n${npc.name} says: "${npc.dialogue.responses[bestMatch]}"\n`
      return result
    } else {
      let result = `${npc.name} shrugs and says: "I don't know anything about that."\n`
      
      const allTopics = [...topics]
      if (npc.quests && npc.quests.length > 0) {
        allTopics.push('quests')
      }
      
      if (allTopics.length > 0) {
        result += `\nTry asking about: ${allTopics.join(', ')}`
      }
      
      return result
    }
  }

  handleQuestTopic(player, npc) {
    const questSystem = this.gameWorld.questSystem
    if (!questSystem) {
      return `${npc.name} says: "I don't have any tasks for you right now."`
    }

    // Check for delivery quests where this NPC is the target
    const allActiveQuests = questSystem.getActiveQuests(player)
    for (const quest of allActiveQuests) {
      for (const objective of quest.objectives) {
        if (objective.type === 'deliver' && objective.target === npc.name.toLowerCase().replace(/\s+/g, '_')) {
          // Check if player has the delivery item
          const playerItem = player.inventory.find(item => item.id === objective.item)
          if (playerItem && playerItem.quantity >= objective.quantity) {
            // Complete the delivery
            const turnInResult = questSystem.turnInQuest(player, quest.id)
            if (turnInResult.success) {
              let result = `\n${npc.name} says: "${turnInResult.message}"\n`
              if (turnInResult.rewards) {
                result += `\nRewards: ${turnInResult.rewards}\n`
              }
              return result
            }
          }
        }
      }
    }

    if (!npc.quests || npc.quests.length === 0) {
      return `${npc.name} says: "I don't have any tasks for you right now."`
    }

    // Check for completable quests first
    const completableQuests = npc.quests
      .map(qId => this.gameWorld.getQuest(qId))
      .filter(q => {
        if (!q || !questSystem.hasActiveQuest(player, q.id)) return false
        const playerQuest = questSystem.getPlayerQuest(player, q.id)
        
        if (q.type === 'delivery') {
          return q.objectives.every((objective, index) => {
            if (objective.type === 'deliver') {
              const playerItem = player.inventory.find(item => item.id === objective.item)
              return playerItem && playerItem.quantity >= objective.quantity
            }
            const current = playerQuest.objectives[index]?.current || 0
            return current >= objective.quantity
          })
        } else {
          return q.objectives.every((objective, index) => {
            const current = playerQuest.objectives[index]?.current || 0
            return current >= objective.quantity
          })
        }
      })

    if (completableQuests.length > 0) {
      if (completableQuests.length === 1) {
        // Auto turn in if only one quest is completable
        const quest = completableQuests[0]
        const turnInResult = questSystem.turnInQuest(player, quest.id)
        
        if (turnInResult.success) {
          let result = `\n${npc.name} says: "${turnInResult.message}"\n`
          if (turnInResult.rewards) {
            result += `\nRewards: ${turnInResult.rewards}\n`
          }
          return result
        }
      } else {
        // Show list of completable quests for player to choose
        let result = `\n${npc.name} says: "You've completed multiple tasks! Which one would you like to turn in?"\n\nCompleted Quests:\n`
        completableQuests.forEach(quest => {
          result += `• ${quest.name} - Use 'turn in ${quest.name}'\n`
        })
        return result
      }
    }

    // Check for available quests
    const availableQuests = npc.quests
      .map(qId => this.gameWorld.getQuest(qId))
      .filter(q => q && questSystem.getAvailableQuests(player).includes(q))

    if (availableQuests.length > 0) {
      if (availableQuests.length === 1) {
        // Show single quest details
        const quest = availableQuests[0]
        let result = `\n${npc.name} says: "${quest.dialogue.offer}"\n`
        result += `\nQuest: ${quest.name}\n`
        result += `${quest.description}\n`
        return result
      } else {
        // Show all available quests
        let result = `\n${npc.name} says: "I have several tasks that need doing. Which one interests you?"\n\nAvailable Quests:\n`
        availableQuests.forEach(quest => {
          result += `• ${quest.name} - ${quest.description}\n`
        })
        result += `\nUse 'quest info <quest name>' for details or 'quest accept <quest name>' to accept.`
        return result
      }
    }

    // Check for active quests
    const activeQuests = npc.quests
      .map(qId => this.gameWorld.getQuest(qId))
      .filter(q => q && questSystem.hasActiveQuest(player, q.id))

    if (activeQuests.length > 0) {
      const quest = activeQuests[0]
      return `\n${npc.name} says: "${quest.dialogue.progress}"\n`
    }

    return `${npc.name} says: "I don't have any tasks for you right now."`
  }

  turnIn(player, args) {
    if (args.length === 0) {
      return "Turn in what quest? Use 'turn in <quest name>' or just 'talk' to an NPC to see available options."
    }

    const questName = args.join(' ')
    const room = this.getCurrentRoom(player)
    
    if (!room.npcs || room.npcs.length === 0) {
      return "There's no one here to turn in quests to."
    }

    // Find NPC with the specified completed quest
    for (const npc of room.npcs) {
      if (!npc.quests) continue

      const npcQuests = npc.quests
        .map(qId => this.gameWorld.getQuest(qId))
        .filter(q => q && this.calculateMatchScore(q.name, questName) >= 0.3)

      if (npcQuests.length > 0) {
        const quest = npcQuests[0] // Use best match
        
        // Check if quest is completable
        const playerQuest = player.quests.find(pq => pq.id === quest.id && pq.status === 'accepted')
        if (!playerQuest) {
          return `You don't have an active quest called "${quest.name}".`
        }

        // Check if quest is actually complete
        const isComplete = quest.objectives.every((objective, index) => {
          if (quest.type === 'delivery' && objective.type === 'deliver') {
            const playerItem = player.inventory.find(item => item.id === objective.item)
            return playerItem && playerItem.quantity >= objective.quantity
          }
          const current = playerQuest.objectives[index]?.current || 0
          return current >= objective.quantity
        })

        if (!isComplete) {
          return `Quest "${quest.name}" is not yet complete.`
        }

        // Turn in the quest - delegate to QuestCommands
        const turnInResult = this.updateQuestProgress(player, 'turnin', quest.id)
        return this.processQuestTurnIn(player, quest, npc)
      }
    }

    return `No NPC here has a completed quest called "${questName}".`
  }

  // Helper method to process quest turn-in
  processQuestTurnIn(player, quest, npc) {
    const playerQuest = player.quests.find(pq => pq.id === quest.id)
    
    // Remove delivery items from inventory
    if (quest.type === 'delivery') {
      quest.objectives.forEach(objective => {
        if (objective.type === 'deliver') {
          player.removeItem(objective.item, objective.quantity)
        }
      })
    }

    // Give rewards
    let rewardsText = ''
    if (quest.rewards) {
      if (quest.rewards.experience) {
        const levelsGained = player.addExperience(quest.rewards.experience)
        rewardsText += `+${quest.rewards.experience} experience`
        if (levelsGained > 0) {
          rewardsText += ` (LEVEL UP! Now level ${player.level})`
        }
      }
      if (quest.rewards.gold) {
        player.gold += quest.rewards.gold
        rewardsText += rewardsText ? `, +${quest.rewards.gold} gold` : `+${quest.rewards.gold} gold`
      }
      if (quest.rewards.items && quest.rewards.items.length > 0) {
        quest.rewards.items.forEach(itemId => {
          player.addItem(itemId, 1)
          const item = this.gameWorld.getItem(itemId)
          const itemName = item ? item.name : itemId
          rewardsText += rewardsText ? `, ${itemName}` : itemName
        })
      }
    }

    // Mark quest as completed
    playerQuest.status = 'completed'
    playerQuest.completedAt = Date.now()
    player.save()

    let result = `\n${npc.name} says: "${quest.dialogue.complete}"\n`
    if (rewardsText) {
      result += `\nRewards: ${rewardsText}\n`
    }
    
    return result
  }
}

export default SocialCommands