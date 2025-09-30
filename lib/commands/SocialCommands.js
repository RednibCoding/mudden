import BaseCommand from './BaseCommand.js'
import { QUEST_STATUS } from '../constants/QuestConstants.js'

class SocialCommands extends BaseCommand {
  getCommands() {
    return {
      'tell': this.tell.bind(this),
      'say': this.say.bind(this),
      'ask': this.ask.bind(this),
      'talk': this.talk.bind(this)
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
      const socket = global.getPlayerSocket(otherPlayer.name)
      if (socket) {
        socket.emit('output', `[SAY] ${player.name} says: "${message}"`)
      }
    })
    
    return `[SAY] You say: "${message}"`
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

    // Handle quest topic specially (with fuzzy matching)
    const questScore = Math.max(
      this.calculateMatchScore('quests', topic),
      this.calculateMatchScore('quest', topic)
    )
    if (questScore >= 60) {
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

    // Check if this NPC can receive any completed quests (using turnInNpc)
    const allActiveQuests = questSystem.getActiveQuests(player)
    for (const quest of allActiveQuests) {
      // Check if this NPC is the turnInNpc for any quest
      const turnInNpcId = quest.turnInNpc || quest.giver
      if (turnInNpcId === npc.id) {
        // Check if quest is complete
        const playerQuest = questSystem.getPlayerQuest(player, quest.id)
        const isComplete = quest.objectives.every((objective, index) => {
          const current = playerQuest.objectives[index]?.current || 0
          return current >= objective.quantity
        })
        
        if (isComplete) {
          // Auto-complete the quest
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

    if (!npc.quests || npc.quests.length === 0) {
      return `${npc.name} says: "I don't have any tasks for you right now."`
    }

    // Check for completable quests first (where this NPC is the turnInNpc)
    const completableQuests = npc.quests
      .map(qId => this.gameWorld.getQuest(qId))
      .filter(q => {
        if (!q || !questSystem.hasActiveQuest(player, q.id)) return false
        
        // Only show if this NPC is the one who can complete the quest
        const turnInNpcId = q.turnInNpc || q.giver
        if (turnInNpcId !== npc.id) return false
        
        const playerQuest = questSystem.getPlayerQuest(player, q.id)
        return q.objectives.every((objective, index) => {
          const current = playerQuest.objectives[index]?.current || 0
          return current >= objective.quantity
        })
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
        let result = `\n${npc.name} says: "You've completed multiple tasks! Which one would you like to complete?"\n\nCompleted Quests:\n`
        completableQuests.forEach(quest => {
          result += `• ${quest.name} - Use 'quest complete ${quest.name}'\n`
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




}

export default SocialCommands