import BaseCommand from './BaseCommand.js'

class CombatCommands extends BaseCommand {
  constructor(worldManager, players, _unusedCombatSessions, io, commandManager = null) {
    super(worldManager, players, _unusedCombatSessions, io, commandManager)
    // Combat manager will be injected by the CommandManager
    this.combatManager = null
  }

  // Set combat manager reference
  setCombatManager(combatManager) {
    this.combatManager = combatManager
  }

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
      'homestone': this.homestone.bind(this),
      'combat': this.combatStatus.bind(this),
      'status': this.combatStatus.bind(this)
    }
  }

  attack(player, args) {
    if (!this.combatManager) {
      return "Combat system not available."
    }

    const room = this.getCurrentRoom(player)
    
    // Check if already in combat
    if (this.combatManager.isPlayerInCombat(player.name)) {
      return "You are already in combat! Wait for the combat rounds or use 'flee' to escape."
    }
    
    // Start new combat
    if (args.length === 0) {
      const targets = this.getValidTargets(room, player)
      if (targets.length === 0) {
        return "Attack what? There are no valid targets here."
      }
      // Attack first target if no target specified
      return this.combatManager.startCombat(player, targets[0])
    }
    
    const targetName = args.join(' ')
    
    // Find target (enemy or NPC or player)
    const targets = this.getValidTargets(room, player)
    const target = this.findBestMatch(targets, targetName)
    
    if (target) {
      // For enemies, check if they're already dead
      if (target.type === 'enemy') {
        const sharedInstance = this.worldManager.getSharedEnemyInstance(
          player.currentArea, 
          player.currentRoom, 
          target.id
        )
        if (sharedInstance && sharedInstance.currentHealth <= 0) {
          return `${target.name} is already dead!`
        }
      }
      
      return this.combatManager.startCombat(player, target)
    }
    
    return `You don't see "${targetName}" here to attack.`
  }

  getValidTargets(room, player) {
    let targets = []
    
    // Add enemies (only if they're alive)
    if (room.enemies && room.enemies.length > 0) {
      const aliveEnemies = room.enemies.filter(enemy => {
        // Check shared instance health if it exists
        const sharedInstance = this.worldManager.getSharedEnemyInstance(
          player.currentArea, 
          player.currentRoom, 
          enemy.id
        )
        if (sharedInstance) {
          return sharedInstance.currentHealth > 0
        }
        // If no shared instance, enemy is alive by default
        return true
      })
      
      targets = targets.concat(aliveEnemies.map(enemy => ({
        ...enemy,
        type: 'enemy',
        combatName: enemy.name
      })))
    }
    
    // Add hostile NPCs or NPCs that can be attacked
    if (room.npcs && room.npcs.length > 0) {
      const attackableNpcs = room.npcs.filter(npc => {
        const npcData = this.worldManager.templateManager.getNPC(npc.id)
        return npcData && (npcData.hostile || !npcData.hasOwnProperty('hostile'))
      })
      
      targets = targets.concat(attackableNpcs.map(npc => {
        const npcData = this.worldManager.templateManager.getNPC(npc.id)
        return {
          ...npcData,
          type: 'npc',
          combatName: npcData.name
        }
      }))
    }
    
    return targets
  }

  defend(player, args) {
    return "The defend command is not available in auto-combat. Use consumables or flee to escape!"
  }

  flee(player, args) {
    if (!this.combatManager) {
      return "Combat system not available."
    }

    if (!this.combatManager.isPlayerInCombat(player.name)) {
      return "You're not in combat."
    }
    
    // 70% chance to successfully flee
    if (Math.random() < 0.7) {
      // Remove player from combat
      this.combatManager.removePlayerFromCombat(player.name)
      
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
        
        return `You flee ${randomExit} and escape to safety!`
      } else {
        return "You flee the combat but have nowhere to run!"
      }
    } else {
      return "You try to flee but can't escape!"
    }
  }
  
  homestone(player, args) {
    const room = this.getCurrentRoom(player)
    
    // Check if there's an NPC with homestone: true in the room
    if (!room.npcs || room.npcs.length === 0) {
      return "There's no one here who can bind your homestone."
    }
    
    const homestoneNpc = room.npcs.find(npc => {
      const npcData = this.worldManager.templateManager.getNPC(npc.id)
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
    
    const npcData = this.worldManager.templateManager.getNPC(homestoneNpc.id)
    return `${npcData.name} performs a mystical ritual and binds your homestone to this location. You will respawn here if you die.`
  }

  combatStatus(player, args) {
    if (!this.combatManager) {
      return "Combat system not available."
    }

    const status = this.combatManager.getCombatStatus(player.name)
    if (!status) {
      return "You are not in combat."
    }

    let result = `\n=== Combat Status ===\n`
    result += `Round: ${status.round}\n`
    result += `Players in combat: ${status.players.join(', ')}\n`
    result += `\nEnemies:\n`
    
    for (const enemy of status.enemies) {
      const healthPercent = Math.floor((enemy.health / enemy.maxHealth) * 100)
      result += `• ${enemy.name}: ${enemy.health}/${enemy.maxHealth} HP (${healthPercent}%)\n`
    }
    
    return result
  }

  // Get enemy combat status for InfoCommands to use
  getEnemyCombatStatus(areaId, roomId, enemyId) {
    if (!this.combatManager) {
      return { inCombat: false }
    }
    return this.combatManager.getEnemyCombatStatus(areaId, roomId, enemyId)
  }

  // Legacy method for compatibility - can be removed later
  processAllCombats(tick) {
    if (this.combatManager) {
      this.combatManager.processCombatTick()
    }
  }

  // Cleanup unused enemy instances (delegate to WorldManager)
  cleanupUnusedEnemyInstance(areaId, roomId, enemyId) {
    return this.worldManager.removeSharedEnemyInstance(areaId, roomId, enemyId)
  }
}

export default CombatCommands