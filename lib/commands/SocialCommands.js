import BaseCommand from './BaseCommand.js'

class SocialCommands extends BaseCommand {
  getCommands() {
    return {
      // Social
      'say': this.say.bind(this),
      'tell': this.tell.bind(this),
      'talk': this.talk.bind(this),
      'speak': this.talk.bind(this),
      'ask': this.ask.bind(this)
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
    
    if (npc.dialogue.responses && Object.keys(npc.dialogue.responses).length > 0) {
      result += `\nTopics you can ask about:\n`
      for (const topic of Object.keys(npc.dialogue.responses)) {
        result += `• ${topic}\n`
      }
      result += `\nUse: ask ${npc.name} about <topic>\n`
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
      
      if (topics.length > 0) {
        result += `\nTry asking about: ${topics.join(', ')}`
      }
      
      return result
    }
  }
}

export default SocialCommands