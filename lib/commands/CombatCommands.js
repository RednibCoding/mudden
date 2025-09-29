import BaseCommand from './BaseCommand.js'
import { OBJECTIVE_TYPES } from '../constants/QuestConstants.js'

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
      'run': this.flee.bind(this),
      'bind': this.bind.bind(this),
      'combat': this.combatStatus.bind(this),
      'status': this.combatStatus.bind(this)
    }
  }

  attack(player, args) {
    const room = this.getCurrentRoom(player)
    
    // Check if already in combat
    let combat = this.combatSessions[player.name]
    
    if (combat) {
      return "You are already in combat! Wait for the auto-combat rounds or use 'flee' to escape."
    }
    
    // Start new combat
    if (args.length === 0) {
      const targets = this.getValidTargets(room)
      if (targets.length === 0) {
        return "Attack what? There are no valid targets here."
      }
      // Attack first target if no target specified
      return this.startCombat(player, targets[0])
    }
    
    const targetName = args.join(' ')
    
    // Find target (enemy or NPC or player)
    const targets = this.getValidTargets(room)
    const target = this.findBestMatch(targets, targetName)
    
    if (target) {
      return this.startCombat(player, target)
    }
    
    return `You don't see "${targetName}" here to attack.`
  }

  getValidTargets(room) {
    let targets = []
    
    // Add enemies
    if (room.enemies && room.enemies.length > 0) {
      targets = targets.concat(room.enemies.map(enemy => ({
        ...enemy,
        type: 'enemy',
        combatName: enemy.name
      })))
    }
    
    // Add hostile NPCs or NPCs that can be attacked
    if (room.npcs && room.npcs.length > 0) {
      const attackableNpcs = room.npcs.filter(npc => {
        const npcData = this.gameWorld.getNpc(npc.id)
        return npcData && (npcData.hostile || !npcData.hasOwnProperty('hostile'))
      })
      
      targets = targets.concat(attackableNpcs.map(npc => {
        const npcData = this.gameWorld.getNpc(npc.id)
        return {
          ...npcData,
          type: 'npc',
          id: npc.id,
          combatName: npcData.name
        }
      }))
    }
    
    // Add other players (PvP - for now just return empty, can be enabled later)
    // const otherPlayers = Object.values(this.players).filter(p => 
    //   p.name !== player.name && 
    //   p.currentArea === player.currentArea && 
    //   p.currentRoom === player.currentRoom
    // )
    // targets = targets.concat(otherPlayers.map(p => ({
    //   ...p,
    //   type: 'player',
    //   combatName: p.name
    // })))
    
    return targets
  }

  startCombat(player, target) {
    // Prevent movement during combat
    player.inCombat = true
    
    // Stop health recovery during combat
    player.stopHealthRecovery()
    
    // Create combat session
    const combatData = {
      attacker: {
        name: player.name,
        type: 'player',
        data: player
      },
      defender: {
        name: target.combatName,
        type: target.type,
        data: { ...target }
      },
      startTime: Date.now(),
      lastAction: Date.now(),
      round: 1,
      autoAttackInterval: null
    }
    
    // Set up defender health if not already set
    if (!combatData.defender.data.health) {
      combatData.defender.data.health = combatData.defender.data.maxHealth || combatData.defender.data.stats?.health || 30
    }
    if (!combatData.defender.data.maxHealth) {
      combatData.defender.data.maxHealth = combatData.defender.data.stats?.health || 30
    }
    
    this.combatSessions[player.name] = combatData
    
    // Start auto-combat timer (attack every 3 seconds)
    combatData.autoAttackInterval = setInterval(() => {
      this.performAutoCombatRound(player.name)
    }, 3000)
    
    // Perform first attack immediately
    setTimeout(() => {
      this.performAutoCombatRound(player.name)
    }, 100) // Small delay to avoid duplicate output
    
    return `You attack ${target.combatName}! Combat begins...`
  }

  performAutoCombatRound(playerName) {
    const combat = this.combatSessions[playerName]
    if (!combat) return
    
    const attacker = combat.attacker.data
    const defender = combat.defender.data
    let result = ""
    
    // Calculate attacker damage
    let attackerDamage = this.calculateDamage(combat.attacker)
    
    // Apply defender's defense
    const defenderDefense = this.calculateDefense(combat.defender)
    attackerDamage = Math.max(1, attackerDamage - Math.floor(defenderDefense / 2)) // Defense reduces damage by half its value, minimum 1 damage
    
    // Apply attacker's attack
    defender.health -= attackerDamage
    
    // Show attacker's attack description if available
    if (combat.attacker.lastAttack) {
      const attack = combat.attacker.lastAttack
      if (attack.missed) {
        result += `${attack.description} But it misses!\n`
      } else {
        result += `${attack.description} It deals ${attackerDamage} damage!\n`
      }
    } else {
      if (attackerDamage > 0) {
        result += `${combat.attacker.name} hits ${combat.defender.name} for ${attackerDamage} damage.\n`
      } else {
        result += `${combat.attacker.name} attacks ${combat.defender.name} but misses!\n`
      }
    }
    
    // Check if defender is dead
    if (defender.health <= 0) {
      const victoryResult = this.handleCombatVictory(combat)
      result += victoryResult
      this.sendToPlayer(attacker.name, result)
      return
    }
    
    // Defender attacks back
    let defenderDamage = this.calculateDamage(combat.defender)
    
    // Apply attacker's defense
    const attackerDefense = this.calculateDefense(combat.attacker)
    defenderDamage = Math.max(1, defenderDamage - Math.floor(attackerDefense / 2)) // Defense reduces damage by half its value, minimum 1 damage
    
    attacker.health -= defenderDamage
    
    // Show attack description if available
    if (combat.defender.lastAttack) {
      const attack = combat.defender.lastAttack
      if (attack.missed) {
        result += `${attack.description} But it misses!\n`
      } else {
        result += `${attack.description} It deals ${defenderDamage} damage!\n`
      }
    } else {
      if (defenderDamage > 0) {
        result += `${combat.defender.name} hits ${combat.attacker.name} for ${defenderDamage} damage.\n`
      } else {
        result += `${combat.defender.name} attacks ${combat.attacker.name} but misses!\n`
      }
    }
    
    // Check if attacker is dead
    if (attacker.health <= 0) {
      const defeatResult = this.handleCombatDefeat(combat)
      result += defeatResult
      this.sendToPlayer(attacker.name, result)
      return
    }
    
    combat.round++
    combat.lastAction = Date.now()
    attacker.save()
    
    // Update client with current health and game state
    this.sendGameStateUpdate(attacker)
    
    // Send update to player (add newline for spacing)
    this.sendToPlayer(attacker.name, result + '\n')
  }
  
  calculateDamage(combatant) {
    let baseDamage = Math.floor(Math.random() * 10) + 5
    
    if (combatant.type === 'player') {
      const player = combatant.data
      
      // Add player strength to damage (including equipment bonuses)
      const totalStats = player.getTotalStats(this.gameWorld)
      if (totalStats && totalStats.strength) {
        baseDamage += Math.floor(totalStats.strength / 2) // Half of strength as bonus damage
      }
      
      // Check for equipped weapon
      if (player.equipment && player.equipment.main_hand) {
        const weaponTemplate = this.gameWorld.getItem(player.equipment.main_hand)
        if (weaponTemplate && weaponTemplate.effects && weaponTemplate.effects.damage) {
          baseDamage += weaponTemplate.effects.damage
        }
      }
    } else if (combatant.type === 'enemy') {
      const enemy = combatant.data
      // Use enemy attack data if available
      if (enemy.attacks && enemy.attacks.length > 0) {
        const selectedAttack = this.selectWeightedAttack(enemy.attacks)
        
        // Check accuracy
        const accuracyRoll = Math.random() * 100
        if (accuracyRoll <= selectedAttack.accuracy) {
          // Use [min, max] damage array format
          const [minDamage, maxDamage] = selectedAttack.damage
          baseDamage = minDamage + Math.floor(Math.random() * (maxDamage - minDamage + 1))
          // Store attack info for combat message
          combatant.lastAttack = selectedAttack
        } else {
          baseDamage = 0 // Attack missed
          combatant.lastAttack = { ...selectedAttack, missed: true }
        }
      } else if (enemy.stats && enemy.stats.strength) {
        baseDamage = enemy.stats.strength + Math.floor(Math.random() * 5)
      }
    } else if (combatant.type === 'npc') {
      const npc = combatant.data
      if (npc.stats && npc.stats.strength) {
        baseDamage = npc.stats.strength + Math.floor(Math.random() * 3)
      }
    }
    
    return Math.max(1, baseDamage) // Minimum 1 damage
  }

  // Calculate damage reduction from defense stats and equipment
  calculateDefense(combatant) {
    let totalDefense = 0
    
    if (combatant.type === 'player') {
      const player = combatant.data
      
      // Add player base defense (including equipment bonuses)
      const playerTotalStats = player.getTotalStats(this.gameWorld)
      if (playerTotalStats && playerTotalStats.defense) {
        totalDefense += playerTotalStats.defense
      }
      
      // Add equipment defense bonuses
      if (player.equipment) {
        for (const [slot, itemId] of Object.entries(player.equipment)) {
          if (itemId) {
            const itemTemplate = this.gameWorld.getItem(itemId)
            if (itemTemplate && itemTemplate.effects && itemTemplate.effects.defense) {
              totalDefense += itemTemplate.effects.defense
            }
          }
        }
      }
    } else if (combatant.type === 'enemy') {
      const enemy = combatant.data
      if (enemy.stats && enemy.stats.defense) {
        totalDefense += enemy.stats.defense
      }
    } else if (combatant.type === 'npc') {
      const npc = combatant.data
      if (npc.stats && npc.stats.defense) {
        totalDefense += npc.stats.defense
      }
    }
    
    return totalDefense
  }

  handleCombatVictory(combat) {
    const attacker = combat.attacker.data
    const defender = combat.defender.data
    let result = `${combat.defender.name} is defeated!\n`
    
    // Clear auto-attack interval
    if (combat.autoAttackInterval) {
      clearInterval(combat.autoAttackInterval)
    }
    
    if (combat.defender.type === 'enemy') {
      // Handle enemy defeat
      const enemy = defender
      
      // Give experience
      if (enemy.stats && enemy.stats.experience) {
        const levelsGained = attacker.addExperience(enemy.stats.experience)
        result += `You gain ${enemy.stats.experience} experience.\n`
        if (levelsGained > 0) {
          result += `\nLevel up! You are now level ${attacker.level}!\n`
        }
      }
      
      // Give loot
      if (enemy.loot) {
        const lootResult = this.generateLoot(enemy.loot)
        if (lootResult.gold > 0) {
          attacker.gold = (attacker.gold || 0) + lootResult.gold
          result += `You loot ${lootResult.gold} gold.\n`
        }
        if (lootResult.items.length > 0) {
          lootResult.items.forEach(itemId => {
            attacker.addItem(itemId, 1)
            const item = this.gameWorld.getItem(itemId)
            result += `You loot: ${item ? item.name : itemId}\n`
          })
        }
      }
      
      // Update quest progress
      this.updateQuestProgress(attacker, OBJECTIVE_TYPES.KILL, enemy.id)
      
      // Handle onetime enemy defeat tracking
      if (enemy._respawnConfig && enemy._respawnConfig.onetime) {
        attacker.defeatOnetimeEnemy(attacker.currentArea, attacker.currentRoom, enemy.id)
      }
      
      // Handle enemy defeat with respawn logic
      this.gameWorld.defeatEnemy(attacker.currentArea, attacker.currentRoom, enemy.id)
    } else if (combat.defender.type === 'player') {
      // PvP victory - steal gold and give exp
      const goldStolen = Math.floor((defender.gold || 0) * 0.05) // 5%
      const expGained = Math.floor((defender.maxHealth || 100) * 0.2) // 20% of max health
      
      if (goldStolen > 0) {
        attacker.gold = (attacker.gold || 0) + goldStolen
        defender.gold = Math.max(0, (defender.gold || 0) - goldStolen)
        result += `You steal ${goldStolen} gold from ${defender.name}.\n`
      }
      
      if (expGained > 0) {
        const levelsGained = attacker.addExperience(expGained)
        result += `You gain ${expGained} experience.\n`
        if (levelsGained > 0) {
          result += `Level up! You are now level ${attacker.level}!\n`
        }
      }
    }
    
    // End combat
    attacker.inCombat = false
    delete this.combatSessions[attacker.name]
    attacker.save()
    
    // Restart health recovery after combat
    attacker.startHealthRecovery((player, message) => {
      if (message) {
        this.sendToPlayer(player.name, message)
      }
      // Always send updated game state to keep client UI in sync
      this.sendGameStateUpdate(player)
    })
    
    // Update client with new game state (removes combat border)
    this.sendGameStateUpdate(attacker)
    
    return result
  }
  
  handleCombatDefeat(combat) {
    const attacker = combat.attacker.data
    const defender = combat.defender.data
    let result = `${combat.attacker.name} has been defeated!\n`
    
    // Clear auto-attack interval
    if (combat.autoAttackInterval) {
      clearInterval(combat.autoAttackInterval)
    }
    
    // Handle player death and respawn
    if (combat.attacker.type === 'player') {
      result += this.handlePlayerDeath(attacker)
    }
    
    // End combat
    attacker.inCombat = false
    delete this.combatSessions[attacker.name]
    
    // Restart health recovery after combat defeat
    attacker.startHealthRecovery((player, message) => {
      if (message) {
        this.sendToPlayer(player.name, message)
      }
      // Always send updated game state to keep client UI in sync
      this.sendGameStateUpdate(player)
    })
    
    // Update client with new game state (removes combat border)
    this.sendGameStateUpdate(attacker)
    
    return result
  }
  
  handlePlayerDeath(player) {
    let result = "You have been defeated!\n"
    
    // Respawn at bound homestone (default: inn)
    const respawnArea = player.homestone?.area || 'town_area'
    const respawnRoom = player.homestone?.room || 'inn'
    
    player.currentArea = respawnArea
    player.currentRoom = respawnRoom
    player.health = Math.floor(player.maxHealth * 0.25) // Respawn with 25% health
    
    result += `You respawn at your bound homestone with reduced health.\n`
    
    player.save()
    return result
  }
  
  generateLoot(lootTable) {
    const result = { gold: 0, items: [] }
    
    // Generate gold
    if (lootTable.gold && lootTable.gold.length === 2) {
      const [min, max] = lootTable.gold
      result.gold = Math.floor(Math.random() * (max - min + 1)) + min
    }
    
    // Generate items based on individual item chances
    if (lootTable.items && Array.isArray(lootTable.items)) {
      lootTable.items.forEach(itemEntry => {
        // Object format: {id: "item_id", chance: 70, quantity: [1, 3]}
        const itemChance = itemEntry.chance || 100
        if (Math.random() * 100 < itemChance) {
          // Handle quantity as [min, max] range, default to [1, 1] if not specified
          const quantityRange = itemEntry.quantity || [1, 1]
          const [min, max] = quantityRange
          const quantity = Math.floor(Math.random() * (max - min + 1)) + min
          
          for (let i = 0; i < quantity; i++) {
            result.items.push(itemEntry.id)
          }
        }
      })
    }
    
    return result
  }
  
  defend(player, args) {
    return "The defend command is not available in auto-combat. Use consumables or flee to escape!"
  }

  flee(player, args) {
    const combat = this.combatSessions[player.name]
    
    if (!combat) {
      return "You're not in combat."
    }
    
    // 70% chance to successfully flee
    if (Math.random() < 0.7) {
      // Clear auto-attack interval
      if (combat.autoAttackInterval) {
        clearInterval(combat.autoAttackInterval)
      }
      
      player.inCombat = false
      delete this.combatSessions[player.name]
      
      // Restart health recovery after fleeing combat
      player.startHealthRecovery((p, message) => {
        if (message) {
          this.sendToPlayer(p.name, message)
        }
        // Always send updated game state to keep client UI in sync
        this.sendGameStateUpdate(p)
      })
      
      // Try to move to a random exit
      const room = this.getCurrentRoom(player)
      const exits = Object.keys(room.exits || {})
      
      if (exits.length > 0) {
        const randomExit = exits[Math.floor(Math.random() * exits.length)]
        const exitDestination = room.exits[randomExit]
        const [targetArea, targetRoom] = exitDestination.split('.')
        
        player.currentArea = targetArea
        player.currentRoom = targetRoom
        player.save()
        
        // Update client with new game state (removes combat border)
        this.sendGameStateUpdate(player)
        
        return `You flee ${randomExit} and escape to safety!`
      } else {
        return "You flee the combat but have nowhere to run!"
      }
    } else {
      return "You try to flee but can't escape!"
    }
  }
  
  bind(player, args) {
    const room = this.getCurrentRoom(player)
    
    // Check if there's an NPC with homestone: true in the room
    if (!room.npcs || room.npcs.length === 0) {
      return "There's no one here who can bind your homestone."
    }
    
    const homestoneNpc = room.npcs.find(npc => {
      const npcData = this.gameWorld.getNpc(npc.id)
      return npcData && npcData.homestone === true
    })
    
    if (!homestoneNpc) {
      return "There's no one here who can bind your homestone."
    }
    
    // Bind homestone to current location
    player.homestone = {
      area: player.currentArea,
      room: player.currentRoom
    }
    
    player.save()
    
    const npcData = this.gameWorld.getNpc(homestoneNpc.id)
    return `${npcData.name} performs a mystical ritual and binds your homestone to this location. You will respawn here if you die.`
  }

  combatStatus(player, args) {
    const combat = this.combatSessions[player.name]
    
    if (!combat) {
      return "You're not currently in combat."
    }
    
    const attacker = combat.attacker.data
    const defender = combat.defender.data
    
    let result = `\n=== Combat Status ===\n`
    
    // Player status
    result += `${attacker.name} (You):\n`
    result += `  Health: ${attacker.health}/${attacker.maxHealth}\n`
    
    // Calculate player's total stats for display
    const playerStats = attacker.getTotalStats(this.gameWorld)
    if (playerStats) {
      result += `  Attack Power: ~${Math.floor(playerStats.strength / 2) + 5}-${Math.floor(playerStats.strength / 2) + 15}`
      // Add weapon damage if equipped
      if (attacker.equipment && attacker.equipment.main_hand) {
        const weaponTemplate = this.gameWorld.getItem(attacker.equipment.main_hand)
        if (weaponTemplate && weaponTemplate.effects && weaponTemplate.effects.damage) {
          result += ` + ${weaponTemplate.effects.damage} (weapon)`
        }
      }
      result += `\n`
      
      const totalDefense = this.calculateDefense(combat.attacker)
      result += `  Defense: ${totalDefense} (reduces damage by ~${Math.floor(totalDefense / 2)})\n`
    }
    
    result += `\n${defender.name} (Enemy):\n`
    result += `  Health: ${defender.health}/${defender.maxHealth || defender.stats?.maxHealth || defender.stats?.health}\n`
    
    // Enemy stats
    if (defender.stats) {
      if (defender.attacks && defender.attacks.length > 0) {
        result += `  Attacks: `
        defender.attacks.forEach((attack, index) => {
          result += `${attack.name} (${attack.damage} dmg, ${attack.accuracy}% acc)`
          if (index < defender.attacks.length - 1) result += `, `
        })
        result += `\n`
      }
      if (defender.stats.defense) {
        result += `  Defense: ${defender.stats.defense} (reduces damage by ~${Math.floor(defender.stats.defense / 2)})\n`
      }
    }
    
    result += `\nCombat Round: ${combat.round}\n`
    result += `Time in Combat: ${Math.floor((Date.now() - combat.startTime) / 1000)}s\n`
    
    return result
  }
  
  sendGameStateUpdate(player) {
    const socket = this.getPlayerSocket(player.name)
    if (socket) {
      const room = this.getCurrentRoom(player)
      socket.emit('gameState', {
        player: {
          name: player.name,
          level: player.level,
          health: player.health,
          maxHealth: player.maxHealth,
          experience: player.experience,
          gold: player.gold,
          location: room ? room.name : 'Unknown',
          currentArea: player.currentArea,
          currentRoom: player.currentRoom,
          inCombat: player.inCombat || !!this.combatSessions[player.name]
        },
        room: room
      })
    }
  }
  
  selectWeightedAttack(attacks) {
    // Calculate total weight
    const totalWeight = attacks.reduce((sum, attack) => sum + (attack.chance || 10), 0)
    
    // Generate random number between 0 and totalWeight
    let random = Math.random() * totalWeight
    
    // Select attack based on weighted chance
    for (const attack of attacks) {
      random -= (attack.chance || 10)
      if (random <= 0) {
        return attack
      }
    }
    
    // Fallback to first attack (should never happen)
    return attacks[0]
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