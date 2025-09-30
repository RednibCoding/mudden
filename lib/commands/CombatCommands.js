import BaseCommand from './BaseCommand.js'
import { OBJECTIVE_TYPES } from '../constants/QuestConstants.js'

class CombatCommands extends BaseCommand {
  constructor(gameWorld, players, _unusedCombatSessions, io, commandManager = null) {
    super(gameWorld, players, _unusedCombatSessions, io, commandManager)
    // Combat is now purely tick-based - no timer tracking needed
    
    // Flexible combat sessions: sessionId -> { players: [playerNames], enemies: [enemyData], round, startTime, areaId, roomId }
    this.combatSessions = new Map()
    this.nextSessionId = 1
    
    // Player to session mapping for quick lookup: playerName -> sessionId
    this.playerToSession = new Map()
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
    const room = this.getCurrentRoom(player)
    
    // Check if already in combat using new system
    const sessionId = this.playerToSession.get(player.name)
    if (sessionId) {
      return "You are already in combat! Wait for the combat rounds or use 'flee' to escape."
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
      // For enemies, check if they're already dead
      if (target.type === 'enemy') {
        const sharedInstance = this.gameWorld.getSharedEnemyInstance(
          player.currentArea, 
          player.currentRoom, 
          target.id
        )
        if (sharedInstance && sharedInstance.currentHealth <= 0) {
          return `${target.name} is already dead!`
        }
      }
      
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
        const npcData = this.gameWorld.getNPC(npc.id)
        return npcData && (npcData.hostile || !npcData.hasOwnProperty('hostile'))
      })
      
      targets = targets.concat(attackableNpcs.map(npc => {
        const npcData = this.gameWorld.getNPC(npc.id)
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
  
  // Get which players (if any) are currently fighting a specific enemy
  getEnemyCombatStatus(areaId, roomId, enemyId) {
    for (const [sessionId, session] of this.combatSessions) {
      if (session.areaId === areaId && 
          session.roomId === roomId &&
          session.enemies.some(enemy => enemy.id === enemyId)) {
        return {
          inCombat: true,
          players: session.players,
          sessionId: sessionId
        }
      }
    }
    return { inCombat: false }
  }

  // Get all players currently fighting a specific enemy
  getPlayersAttackingEnemy(areaId, roomId, enemyId) {
    for (const [sessionId, session] of this.combatSessions) {
      if (session.areaId === areaId && 
          session.roomId === roomId &&
          session.enemies.some(enemy => enemy.id === enemyId)) {
        return session.players
      }
    }
    return []
  }

        // Combat handled by global tick system
  cleanupUnusedEnemyInstance(areaId, roomId, enemyId) {
    const attackers = this.getPlayersAttackingEnemy(areaId, roomId, enemyId)
    if (attackers.length === 0) {
      // No players fighting this enemy, remove the shared instance
      this.gameWorld.removeSharedEnemyInstance(areaId, roomId, enemyId)
      console.log(`Removed unused shared enemy instance: ${areaId}.${roomId}.${enemyId}`)
      
      // Combat timers handled by global tick system - no cleanup needed
    }
  }

  // Perform combat round for all players fighting a specific enemy
  processCombatSession(sessionId, session) {
    const combatMessages = []
    
    // Phase 1: All players attack
    for (const playerName of session.players) {
      const player = this.getPlayerByName(playerName)
      if (!player) continue
      
      // Choose random enemy target (or could implement player targeting later)
      const aliveEnemies = session.enemies.filter(enemy => enemy.currentHealth > 0)
      if (aliveEnemies.length === 0) break
      
      const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
      const playerDamage = this.calculatePlayerDamage(player)
      targetEnemy.currentHealth -= playerDamage
      
      // Initialize threat table if it doesn't exist
      if (!targetEnemy.threatTable) {
        targetEnemy.threatTable = {}
      }
      
      // Update threat (total damage dealt by this player to this enemy)
      if (!targetEnemy.threatTable[playerName]) {
        targetEnemy.threatTable[playerName] = 0
      }
      targetEnemy.threatTable[playerName] += playerDamage
      
      // Update shared enemy instance if applicable
      if (targetEnemy.isShared) {
        this.gameWorld.updateSharedEnemyHealth(
          session.areaId, 
          session.roomId, 
          targetEnemy.id, 
          targetEnemy.currentHealth
        )
      }
      
      combatMessages.push(`${playerName} hits ${targetEnemy.name} for ${playerDamage} damage.`)
      
      // Check if enemy is defeated
      if (targetEnemy.currentHealth <= 0) {
        combatMessages.push(`${targetEnemy.name} is defeated!`)
        
        // Handle rewards for this enemy
        const rewards = this.calculateEnemyRewards(targetEnemy, session.players)
        if (rewards) {
          combatMessages.push(rewards)
        }
      }
    }
    
    // Phase 2: All alive enemies attack
    const aliveEnemies = session.enemies.filter(enemy => enemy.currentHealth > 0)
    for (const enemy of aliveEnemies) {
      if (session.players.length === 0) break
      
      // Enemy chooses target based on threat/aggro system
      const targetPlayerName = this.selectEnemyTarget(enemy, session.players)
      const targetPlayer = this.getPlayerByName(targetPlayerName)
      
      if (targetPlayer) {
        const enemyDamage = this.calculateEnemyDamage(enemy, targetPlayer)
        targetPlayer.health -= enemyDamage
        
        combatMessages.push(`${enemy.name} attacks ${targetPlayerName} for ${enemyDamage} damage!`)
        
        // Check if player is defeated
        if (targetPlayer.health <= 0) {
          const defeatMessage = this.handlePlayerDeath(targetPlayer)
          
          // Send death message directly to the defeated player
          this.sendToPlayer(targetPlayerName, defeatMessage)
          
          // Also add to combat messages for other players to see
          combatMessages.push(`${targetPlayerName} is defeated and disappears!`)
          
          // Remove defeated player from session and clean up their threat
          session.players = session.players.filter(name => name !== targetPlayerName)
          this.playerToSession.delete(targetPlayerName)
          
          // Clean up threat table entries for defeated player
          for (const enemy of session.enemies) {
            if (enemy.threatTable && enemy.threatTable[targetPlayerName]) {
              delete enemy.threatTable[targetPlayerName]
            }
          }
        } else {
          targetPlayer.save()
          this.sendGameStateUpdate(targetPlayer)
        }
      }
    }
    
    // Update round counter
    session.round++
    
    // Broadcast messages to all participants
    if (combatMessages.length > 0) {
      const fullMessage = combatMessages.join('\n') + '\n'
      this.sendToPlayers(session.players, fullMessage)
    }
  }

  // Process all active combats on global tick
  processAllCombats(tick) {
    const sessionsToRemove = []
    
    for (const [sessionId, session] of this.combatSessions) {
      // Clean up disconnected players
      session.players = session.players.filter(playerName => {
        const player = this.getPlayerByName(playerName)
        return player && player.inCombat && 
               player.currentArea === session.areaId && 
               player.currentRoom === session.roomId
      })
      
      // If no players left, mark session for removal
      if (session.players.length === 0) {
        sessionsToRemove.push(sessionId)
        continue
      }
      
      // Process this combat session
      this.processCombatSession(sessionId, session)
      
      // Check if session should end (all enemies defeated or all players defeated)
      if (this.shouldEndSession(session)) {
        sessionsToRemove.push(sessionId)
      }
    }
    
    // Clean up ended sessions
    for (const sessionId of sessionsToRemove) {
      this.endCombatSession(sessionId)
    }
  }

  startCombat(player, target) {
    // Prevent movement during combat
    player.inCombat = true
    
    // Stop health recovery during combat
    player.stopHealthRecovery()
    
    // Update client to show combat border immediately
    this.sendGameStateUpdate(player)
    
    // Check if player is already in a combat session
    const existingSessionId = this.playerToSession.get(player.name)
    if (existingSessionId) {
      const existingSession = this.combatSessions.get(existingSessionId)
      if (existingSession) {
        // Player is already in combat, could add target to existing session
        // For now, just return a message
        return `You are already in combat!`
      }
    }
    
    // Prepare target data
    let targetData = target
    if (target.type === 'enemy') {
      const sharedInstance = this.gameWorld.getSharedEnemyInstance(
        player.currentArea, 
        player.currentRoom, 
        target.id
      )
      if (sharedInstance) {
        targetData = sharedInstance
        targetData.isShared = true
      }
    }
    
    // Set up target health
    if (!targetData.currentHealth) {
      targetData.currentHealth = targetData.health || targetData.maxHealth || targetData.stats?.health || 30
    }
    if (!targetData.maxHealth) {
      targetData.maxHealth = targetData.stats?.health || 30
    }
    
    // Initialize threat table for new enemies
    if (!targetData.threatTable) {
      targetData.threatTable = {}
    }
    
    // Look for existing combat session in this room that the target is already part of
    let joinedSession = null
    for (const [sessionId, session] of this.combatSessions) {
      if (session.areaId === player.currentArea && 
          session.roomId === player.currentRoom &&
          session.enemies.some(enemy => enemy.id === target.id)) {
        // Found existing session with this target, join it
        if (!session.players.includes(player.name)) {
          session.players.push(player.name)
          this.playerToSession.set(player.name, sessionId)
        }
        joinedSession = sessionId
        break
      }
    }
    
    if (!joinedSession) {
      // Create new combat session
      const sessionId = this.nextSessionId++
      const newSession = {
        players: [player.name],
        enemies: [targetData],
        round: 1,
        startTime: Date.now(),
        areaId: player.currentArea,
        roomId: player.currentRoom
      }
      
      this.combatSessions.set(sessionId, newSession)
      this.playerToSession.set(player.name, sessionId)
    }
    
    return `You attack ${target.combatName}! Combat begins...`
  }

  // Select target based on threat/aggro system
  selectEnemyTarget(enemy, availablePlayers) {
    // If no threat table exists, choose randomly
    if (!enemy.threatTable || Object.keys(enemy.threatTable).length === 0) {
      return availablePlayers[Math.floor(Math.random() * availablePlayers.length)]
    }
    
    // Filter threat table to only include players currently in combat
    const currentThreats = {}
    for (const playerName of availablePlayers) {
      if (enemy.threatTable[playerName]) {
        currentThreats[playerName] = enemy.threatTable[playerName]
      }
    }
    
    // If no current players have threat, choose randomly
    if (Object.keys(currentThreats).length === 0) {
      return availablePlayers[Math.floor(Math.random() * availablePlayers.length)]
    }
    
    // Find player with highest threat (most damage dealt)
    let highestThreat = 0
    let targetPlayer = null
    
    for (const [playerName, threat] of Object.entries(currentThreats)) {
      if (threat > highestThreat) {
        highestThreat = threat
        targetPlayer = playerName
      }
    }
    
    // 80% chance to attack highest threat player, 20% chance to attack randomly
    // This adds some unpredictability while still favoring the high-damage player
    if (Math.random() < 0.8 && targetPlayer) {
      return targetPlayer
    } else {
      return availablePlayers[Math.floor(Math.random() * availablePlayers.length)]
    }
  }

  // Helper method to get player by name
  getPlayerByName(playerName) {
    for (const [socketId, player] of this.players) {
      if (player && player.name === playerName) {
        return player
      }
    }
    return null
  }

  // Check if a combat session should end
  shouldEndSession(session) {
    const aliveEnemies = session.enemies.filter(enemy => enemy.currentHealth > 0)
    return aliveEnemies.length === 0 || session.players.length === 0
  }

  // End a combat session and clean up
  endCombatSession(sessionId) {
    const session = this.combatSessions.get(sessionId)
    if (!session) return
    
    console.log(`Ending combat session ${sessionId} with ${session.players.length} players and ${session.enemies.length} enemies`)
    
    // Remove players from combat state
    for (const playerName of session.players) {
      const player = this.getPlayerByName(playerName)
      if (player) {
        player.inCombat = false
        
        // Restart health recovery
        player.startHealthRecovery((p, message) => {
          if (message) {
            this.sendToPlayer(p.name, message)
          }
          this.sendGameStateUpdate(p)
        })
      }
      this.playerToSession.delete(playerName)
    }
    
    // Handle enemy cleanup based on combat end reason
    for (const enemy of session.enemies) {
      if (enemy.isShared) {
        if (enemy.currentHealth <= 0) {
          // Enemy was defeated - trigger respawn if applicable
          this.cleanupUnusedEnemyInstance(session.areaId, session.roomId, enemy.id)
          console.log(`Enemy ${enemy.name} was defeated - triggering respawn`)
        } else {
          // Combat ended because all players left - reset enemy to full health
          const originalTemplate = this.gameWorld.getEnemy(enemy.id)
          if (originalTemplate) {
            enemy.currentHealth = originalTemplate.stats?.health || enemy.maxHealth || 30
            this.gameWorld.updateSharedEnemyHealth(session.areaId, session.roomId, enemy.id, enemy.currentHealth)
            console.log(`Enemy ${enemy.name} reset to full health (${enemy.currentHealth}) after all players fled/died`)
          }
        }
      }
    }
    
    this.combatSessions.delete(sessionId)
    console.log(`Combat session ${sessionId} cleanup complete`)
  }

  // Clean up when a player disconnects
  cleanupPlayerDisconnect(playerName) {
    const sessionId = this.playerToSession.get(playerName)
    if (!sessionId) return
    
    const session = this.combatSessions.get(sessionId)
    if (!session) return
    
    console.log(`Player ${playerName} disconnected during combat - removing from session ${sessionId}`)
    
    // Remove player from session
    session.players = session.players.filter(name => name !== playerName)
    this.playerToSession.delete(playerName)
    
    // Clean up threat table entries for disconnected player
    for (const enemy of session.enemies) {
      if (enemy.threatTable && enemy.threatTable[playerName]) {
        delete enemy.threatTable[playerName]
      }
    }
    
    // If no players left, the session will be cleaned up by processAllCombats on next tick
    if (session.players.length === 0) {
      console.log(`No players left in session ${sessionId} after disconnect - will be cleaned up next tick`)
    }
  }

  // Calculate damage for a player
  calculatePlayerDamage(player) {
    let baseDamage = Math.floor(Math.random() * 10) + 5
    
    // Add player strength to damage (including equipment bonuses)
    const totalStats = player.getTotalStats(this.gameWorld)
    if (totalStats && totalStats.strength) {
      baseDamage += Math.floor(totalStats.strength / 2)
    }
    
    return Math.max(1, baseDamage)
  }

  // Calculate damage for an enemy
  calculateEnemyDamage(enemy, targetPlayer) {
    let baseDamage = Math.floor(Math.random() * 8) + 3
    
    if (enemy.stats && enemy.stats.strength) {
      baseDamage += Math.floor(enemy.stats.strength / 2)
    }
    
    // Apply player defense
    const totalStats = targetPlayer.getTotalStats(this.gameWorld)
    let defense = 0
    if (totalStats && totalStats.defense) {
      defense = totalStats.defense
    }
    
    baseDamage = Math.max(1, baseDamage - Math.floor(defense / 2))
    return baseDamage
  }

  // Calculate enemy rewards
  calculateEnemyRewards(enemy, participants) {
    let rewardMessage = ""
    
    if (enemy.stats && enemy.stats.experience) {
      const expPerPlayer = Math.floor(enemy.stats.experience / participants.length)
      rewardMessage += `Each participant gains ${expPerPlayer} experience.`
      
      // Apply experience to participants
      for (const playerName of participants) {
        const player = this.getPlayerByName(playerName)
        if (player) {
          const levelsGained = player.addExperience(expPerPlayer)
          if (levelsGained > 0) {
            this.sendToPlayer(playerName, `Level up! You are now level ${player.level}!`)
          }
        }
      }
    }
    
    return rewardMessage
  }

  // Handle player defeat
  handlePlayerDefeat(player) {
    player.inCombat = false
    
    // Reset health to 1 (or implement proper death system)
    player.health = 1
    player.save()
    
    this.sendGameStateUpdate(player)
    
    return `${player.name} is defeated and barely escapes with their life!`
  }


  



  
  handlePlayerDeath(player) {
    let result = "You have been defeated!\n"
    
    // Remove from combat state
    player.inCombat = false
    
    // Respawn at bound homestone (default: inn)
    const respawnArea = player.homestone?.area || 'town_area'
    const respawnRoom = player.homestone?.room || 'inn'
    
    player.currentArea = respawnArea
    player.currentRoom = respawnRoom
    player.health = Math.floor(player.maxHealth * 0.25) // Respawn with 25% health
    
    // Get room name for better message
    const room = this.gameWorld.getRoom(respawnArea, respawnRoom)
    const locationName = room ? room.name : 'your homestone'
    
    result += `You respawn at ${locationName} with reduced health (${player.health}/${player.maxHealth}).\n`
    
    // Start health recovery after respawn
    player.startHealthRecovery((p, message) => {
      if (message) {
        this.sendToPlayer(p.name, message)
      }
      this.sendGameStateUpdate(p)
    })
    
    player.save()
    this.sendGameStateUpdate(player)
    
    return result
  }
  
  generateLoot(lootTable, chanceModifier = 1.0) {
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
        const baseChance = itemEntry.chance || 100
        const modifiedChance = baseChance * chanceModifier
        if (Math.random() * 100 < modifiedChance) {
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
    const sessionId = this.playerToSession.get(player.name)
    if (!sessionId) {
      return "You're not in combat."
    }
    
    const session = this.combatSessions.get(sessionId)
    if (!session) {
      return "You're not in combat."
    }
    
    // 70% chance to successfully flee
    if (Math.random() < 0.7) {
      player.inCombat = false
      
      // Remove player from combat session
      session.players = session.players.filter(name => name !== player.name)
      this.playerToSession.delete(player.name)
      
      // Clean up threat table entries for fleeing player
      for (const enemy of session.enemies) {
        if (enemy.threatTable && enemy.threatTable[player.name]) {
          delete enemy.threatTable[player.name]
        }
      }
      
      // If no players left in session, it will be cleaned up automatically by processAllCombats
      
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
  
  homestone(player, args) {
    const room = this.getCurrentRoom(player)
    
    // Check if there's an NPC with homestone: true in the room
    if (!room.npcs || room.npcs.length === 0) {
      return "There's no one here who can bind your homestone."
    }
    
    const homestoneNpc = room.npcs.find(npc => {
      const npcData = this.gameWorld.getNPC(npc.id)
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
    
    const npcData = this.gameWorld.getNPC(homestoneNpc.id)
    return `${npcData.name} performs a mystical ritual and binds your homestone to this location. You will respawn here if you die.`
  }

  combatStatus(player, args) {
    const sessionId = this.playerToSession.get(player.name)
    if (!sessionId) {
      return "You're not currently in combat."
    }
    
    const session = this.combatSessions.get(sessionId)
    if (!session) {
      return "You're not currently in combat."
    }
    
    let result = `=== Combat Status ===\n`
    result += `Players: ${session.players.join(', ')}\n`
    result += `Enemies: ${session.enemies.map(e => `${e.name} (${e.currentHealth}/${e.maxHealth})`).join(', ')}\n`
    result += `Round: ${session.round}\n`
    
    return result
  }
  
  sendGameStateUpdate(player) {
    const socket = this.getPlayerSocket(player.name)
    if (socket) {
      const room = this.getCurrentRoom(player)
      const sessionId = this.playerToSession.get(player.name)
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
          inCombat: player.inCombat || !!sessionId
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