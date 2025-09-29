import BaseCommand from './BaseCommand.js'

class CombatCommands extends BaseCommand {
  getCommands() {
    return {
      // Combat
      'attack': this.attack.bind(this),
      'fight': this.attack.bind(this),
      'kill': this.attack.bind(this),
      'defend': this.defend.bind(this),
      'guard': this.defend.bind(this),
      'flee': this.flee.bind(this),
      'run': this.flee.bind(this)
    }
  }

  attack(player, args) {
    const room = this.getCurrentRoom(player)
    
    // Check if already in combat
    let combat = this.combatSessions[player.name]
    
    if (combat) {
      // Continue existing combat
      return this.performAttack(player, combat)
    }
    
    // Start new combat
    if (args.length === 0) {
      if (!room.enemies || room.enemies.length === 0) {
        return "Attack what? There are no enemies here."
      }
      // Attack first enemy if no target specified
      const target = room.enemies[0]
      return this.startCombat(player, target)
    }
    
    const targetName = args.join(' ')
    
    // Find enemy using fuzzy matching
    if (room.enemies && room.enemies.length > 0) {
      const enemy = this.findBestMatch(room.enemies, targetName)
      if (enemy) {
        return this.startCombat(player, enemy)
      }
    }
    
    return `You don't see "${targetName}" here to attack.`
  }

  startCombat(player, enemy) {
    // Create combat session
    this.combatSessions[player.name] = {
      player: player,
      enemy: { ...enemy, health: enemy.maxHealth || 30 },
      playerDefending: false
    }
    
    return `You attack the ${enemy.name}!\n\n${this.performAttack(player, this.combatSessions[player.name])}`
  }

  performAttack(player, combat) {
    const enemy = combat.enemy
    let result = ""
    
    // Calculate player damage
    let playerDamage = Math.floor(Math.random() * 10) + 5
    
    // Check for equipped weapon in main_hand
    if (player.equipment && player.equipment.main_hand) {
      const weaponTemplate = this.gameWorld.getItem(player.equipment.main_hand)
      if (weaponTemplate && weaponTemplate.effects && weaponTemplate.effects.damage) {
        playerDamage += weaponTemplate.effects.damage
      }
    }
    
    // Apply player attack
    enemy.health -= playerDamage
    result += `You hit the ${enemy.name} for ${playerDamage} damage.\n`
    
    // Check if enemy is dead
    if (enemy.health <= 0) {
      result += `The ${enemy.name} is defeated!\n`
      
      // Give rewards
      if (enemy.experience) {
        player.experience = (player.experience || 0) + enemy.experience
        result += `You gain ${enemy.experience} experience.\n`
      }
      
      // Update quest progress for kill
      this.updateQuestProgress(player, 'kill', enemy.id)
      
      // Remove enemy from room
      const room = this.getCurrentRoom(player)
      const enemyIndex = room.enemies.findIndex(e => e.name === enemy.name)
      if (enemyIndex !== -1) {
        room.enemies.splice(enemyIndex, 1)
      }
      
      // End combat
      delete this.combatSessions[player.name]
      player.save()
      
      return result
    }
    
    // Enemy attacks back
    let enemyDamage = Math.floor(Math.random() * 8) + 3
    
    // Reduce damage if player is defending
    if (combat.playerDefending) {
      enemyDamage = Math.floor(enemyDamage / 2)
      result += `You block some of the attack!\n`
      combat.playerDefending = false // Reset defending state
    }
    
    player.health -= enemyDamage
    result += `The ${enemy.name} hits you for ${enemyDamage} damage.\n`
    
    // Check if player is dead
    if (player.health <= 0) {
      result += "You have been defeated!\n"
      player.health = 1 // Don't actually kill the player, just set to 1 HP
      delete this.combatSessions[player.name]
      player.save()
      return result
    }
    
    result += `\nYour health: ${player.health}/${player.maxHealth}\n`
    result += `${enemy.name} health: ${enemy.health}\n`
    
    player.save()
    return result
  }

  defend(player, args) {
    const combat = this.combatSessions[player.name]
    
    if (!combat) {
      return "You're not in combat."
    }
    
    combat.playerDefending = true
    return "You raise your guard, ready to defend against the next attack."
  }

  flee(player, args) {
    const combat = this.combatSessions[player.name]
    
    if (!combat) {
      return "You're not in combat."
    }
    
    // 70% chance to successfully flee
    if (Math.random() < 0.7) {
      delete this.combatSessions[player.name]
      
      // Try to move to a random exit
      const room = this.getCurrentRoom(player)
      const exits = Object.keys(room.exits || {})
      
      if (exits.length > 0) {
        const randomExit = exits[Math.floor(Math.random() * exits.length)]
        const targetRoomId = room.exits[randomExit]
        player.location = targetRoomId
        player.save()
        
        return `You flee ${randomExit}!\n\n${this.look ? this.look(player) : 'You escaped to safety.'}`
      } else {
        return "You flee the combat but have nowhere to run!"
      }
    } else {
      return "You try to flee but can't escape!"
    }
  }

  // Helper method for looking (needed for flee)
  look(player) {
    const room = this.getCurrentRoom(player)
    if (!room) {
      return "You are in a void. This shouldn't happen!"
    }

    let description = `\n=== ${room.name} ===\n`
    description += `${room.description}\n`
    
    const exits = Object.keys(room.exits || {})
    if (exits.length > 0) {
      description += `\nExits: ${exits.join(', ')}`
    }
    
    return description
  }
}

export default CombatCommands