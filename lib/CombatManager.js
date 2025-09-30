import { OBJECTIVE_TYPES } from './constants/QuestConstants.js'

class CombatManager {
  constructor(worldManager, players, io) {
    this.worldManager = worldManager
    this.players = players
    this.io = io
    
    // Flexible combat sessions: sessionId -> { players: [playerNames], enemies: [enemyData], round, startTime, areaId, roomId }
    this.combatSessions = new Map()
    this.nextSessionId = 1
    
    // Player to session mapping for quick lookup: playerName -> sessionId
    this.playerToSession = new Map()
  }

  // Check if player is in combat
  isPlayerInCombat(playerName) {
    return this.playerToSession.has(playerName)
  }

  // Get combat session for player
  getPlayerCombatSession(playerName) {
    const sessionId = this.playerToSession.get(playerName)
    return sessionId ? this.combatSessions.get(sessionId) : null
  }

  // Start combat between player and target
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
        return `You are already in combat!`
      }
    }
    
    // Prepare target data
    let targetData = target
    if (target.type === 'enemy') {
      const sharedInstance = this.worldManager.getSharedEnemyInstance(
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
          // Notify existing players that someone is joining the combat
          if (session.players.length > 0) {
            const joinMessage = `${player.name} joins the combat!`
            for (const otherPlayerName of session.players) {
              this.sendToPlayer(otherPlayerName, joinMessage)
            }
          }
          
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

  // Process a combat session round
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
        this.worldManager.updateSharedEnemyHealth(
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
    
    // Send combat messages to all players in session
    this.sendCombatMessages(session, combatMessages)
    
    // Update game state for all players in session (health, combat status, etc.)
    for (const playerName of session.players) {
      const player = this.getPlayerByName(playerName)
      if (player) {
        this.sendGameStateUpdate(player)
      }
    }
    
    // Check if combat should end
    if (this.shouldEndCombat(session)) {
      this.endCombatSession(sessionId)
    } else {
      // Increment round for next combat tick
      session.round++
    }
  }

  // Process combat tick for all active sessions
  processCombatTick() {
    for (const [sessionId, session] of this.combatSessions) {
      this.processCombatSession(sessionId, session)
    }
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
    
    // Choose target based on threat levels (higher threat = more likely to be targeted)
    const totalThreat = Object.values(currentThreats).reduce((sum, threat) => sum + threat, 0)
    let randomValue = Math.random() * totalThreat
    
    for (const [playerName, threat] of Object.entries(currentThreats)) {
      randomValue -= threat
      if (randomValue <= 0) {
        return playerName
      }
    }
    
    // Fallback to highest threat player
    return Object.keys(currentThreats).reduce((a, b) => 
      currentThreats[a] > currentThreats[b] ? a : b
    )
  }

  // Calculate player damage
  calculatePlayerDamage(player) {
    let baseDamage = 5
    
    // Add weapon damage
    if (player.equipment.main_hand) {
      const weapon = this.worldManager.templateManager.getItem(player.equipment.main_hand)
      if (weapon && weapon.stats && weapon.stats.damage) {
        baseDamage += weapon.stats.damage
      }
    }
    
    // Add strength bonus
    if (player.stats && player.stats.strength) {
      baseDamage += Math.floor(player.stats.strength / 2)
    }
    
    // Add some randomness (±20%)
    const randomFactor = 0.8 + (Math.random() * 0.4)
    return Math.floor(baseDamage * randomFactor)
  }

  // Calculate enemy damage to player
  calculateEnemyDamage(enemy, player) {
    let damage = 0
    
    if (enemy.attacks && enemy.attacks.length > 0) {
      // Use random attack from enemy's attack list
      const attack = enemy.attacks[Math.floor(Math.random() * enemy.attacks.length)]
      
      // Check if attack hits (if accuracy is defined)
      if (attack.accuracy && Math.random() * 100 > attack.accuracy) {
        return 0 // Miss
      }
      
      // Calculate damage
      if (Array.isArray(attack.damage)) {
        const [min, max] = attack.damage
        damage = min + Math.floor(Math.random() * (max - min + 1))
      } else {
        damage = attack.damage || 10
      }
    } else {
      // Default attack
      damage = 8 + Math.floor(Math.random() * 5)
    }
    
    // Apply player defense
    let defense = 0
    if (player.stats && player.stats.defense) {
      defense += player.stats.defense
    }
    
    // Add armor defense
    const armorSlots = ['chest', 'legs', 'head', 'feet', 'hands']
    for (const slot of armorSlots) {
      if (player.equipment[slot]) {
        const armor = this.worldManager.templateManager.getItem(player.equipment[slot])
        if (armor && armor.stats && armor.stats.defense) {
          defense += armor.stats.defense
        }
      }
    }
    
    // Calculate final damage (minimum 1)
    const finalDamage = Math.max(1, damage - defense)
    return finalDamage
  }

  // Calculate enemy rewards
  calculateEnemyRewards(enemy, playerNames) {
    let rewardMessage = ""
    
    // Handle experience and gold rewards
    const baseExp = enemy.experience || 10
    const baseGold = enemy.gold ? 
      (Array.isArray(enemy.gold) ? 
        enemy.gold[0] + Math.floor(Math.random() * (enemy.gold[1] - enemy.gold[0] + 1)) : 
        enemy.gold) : 5
    
    // Distribute rewards to all participating players
    for (const playerName of playerNames) {
      const player = this.getPlayerByName(playerName)
      if (player) {
        player.experience += baseExp
        player.gold += baseGold
        
        // Update quest progress for enemy kills
        this.updateQuestProgress(player, OBJECTIVE_TYPES.KILL, enemy.id, 1)
        
        player.save()
        this.sendGameStateUpdate(player)
      }
    }
    
    if (playerNames.length > 0) {
      rewardMessage += `You gain ${baseExp} experience and ${baseGold} gold.\n`
    }
    
    // Handle item drops
    if (enemy.loot && enemy.loot.items) {
      for (const lootItem of enemy.loot.items) {
        if (Math.random() * 100 < lootItem.chance) {
          // Determine quantity
          let quantity = 1
          if (lootItem.quantity && Array.isArray(lootItem.quantity)) {
            const [min, max] = lootItem.quantity
            quantity = min + Math.floor(Math.random() * (max - min + 1))
          }
          
          // Give item to random participating player
          if (playerNames.length > 0) {
            const luckyPlayerName = playerNames[Math.floor(Math.random() * playerNames.length)]
            const luckyPlayer = this.getPlayerByName(luckyPlayerName)
            if (luckyPlayer) {
              const existingItem = luckyPlayer.inventory.find(item => item.id === lootItem.id)
              if (existingItem) {
                existingItem.quantity += quantity
              } else {
                luckyPlayer.inventory.push({ id: lootItem.id, quantity: quantity })
              }
              
              luckyPlayer.save()
              this.sendGameStateUpdate(luckyPlayer)
              
              const itemTemplate = this.worldManager.templateManager.getItem(lootItem.id)
              const itemName = itemTemplate ? itemTemplate.name : lootItem.id
              rewardMessage += ` ${luckyPlayerName} receives ${quantity}x ${itemName}!\n`
            }
          }
        }
      }
    }
    
    return rewardMessage
  }

  // Handle player death
  handlePlayerDeath(player) {
    // Teleport to homestone location
    if (player.homestone) {
      player.currentArea = player.homestone.area
      player.currentRoom = player.homestone.room
    } else {
      // Default respawn location
      player.currentArea = "town_area"
      player.currentRoom = "inn"
    }
    
    // Reset health to full
    player.health = player.maxHealth
    
    // Clear combat state
    player.inCombat = false
    
    // Restart health recovery (handled by global tick system)
    player.startHealthRecovery()
    
    // Update client
    this.sendGameStateUpdate(player)
    
    player.save()
    
    return `You have been defeated! You wake up at your homestone location with full health.`
  }

  // Check if combat should end
  shouldEndCombat(session) {
    const aliveEnemies = session.enemies.filter(enemy => enemy.currentHealth > 0)
    return aliveEnemies.length === 0 || session.players.length === 0
  }

  // End combat session
  endCombatSession(sessionId) {
    const session = this.combatSessions.get(sessionId)
    if (!session) return
    
    // Clean up player mappings and states
    for (const playerName of session.players) {
      const player = this.getPlayerByName(playerName)
      if (player) {
        player.inCombat = false
        player.startHealthRecovery()
        this.sendGameStateUpdate(player)
        player.save()
      }
      this.playerToSession.delete(playerName)
    }
    
    // Remove session
    this.combatSessions.delete(sessionId)
  }

  // Remove player from combat (flee, disconnect, etc.)
  removePlayerFromCombat(playerName, reason = 'flee') {
    const sessionId = this.playerToSession.get(playerName)
    if (!sessionId) return false
    
    const session = this.combatSessions.get(sessionId)
    if (!session) return false
    
    // Notify other players in the combat session based on the reason
    if (session.players.length > 1) {
      let message
      if (reason === 'disconnect') {
        message = `${playerName} has disconnected and left the combat!`
      } else {
        message = `${playerName} flees out of combat!`
      }
      
      for (const otherPlayerName of session.players) {
        if (otherPlayerName !== playerName) {
          this.sendToPlayer(otherPlayerName, message)
        }
      }
    }
    
    // Remove player from session
    session.players = session.players.filter(name => name !== playerName)
    this.playerToSession.delete(playerName)
    
    // Clean up player state
    const player = this.getPlayerByName(playerName)
    if (player) {
      player.inCombat = false
      player.startHealthRecovery()
      this.sendGameStateUpdate(player)
      player.save()
    }
    
    // Clean up threat table entries for this player
    for (const enemy of session.enemies) {
      if (enemy.threatTable && enemy.threatTable[playerName]) {
        delete enemy.threatTable[playerName]
      }
    }
    
    // Check if combat should end
    if (this.shouldEndCombat(session)) {
      this.endCombatSession(sessionId)
    }
    
    return true
  }

  // Get combat status for player
  getCombatStatus(playerName) {
    const sessionId = this.playerToSession.get(playerName)
    if (!sessionId) return null
    
    const session = this.combatSessions.get(sessionId)
    if (!session) return null
    
    return {
      sessionId,
      round: session.round,
      players: session.players,
      enemies: session.enemies.map(enemy => ({
        name: enemy.name,
        health: enemy.currentHealth,
        maxHealth: enemy.maxHealth
      }))
    }
  }

  // Get enemy combat status for room
  getEnemyCombatStatus(areaId, roomId, enemyId) {
    for (const [sessionId, session] of this.combatSessions) {
      if (session.areaId === areaId && session.roomId === roomId) {
        const enemy = session.enemies.find(e => e.id === enemyId)
        if (enemy) {
          return {
            inCombat: true,
            player: session.players.join(', '),
            health: enemy.currentHealth,
            maxHealth: enemy.maxHealth
          }
        }
      }
    }
    return { inCombat: false }
  }

  // Helper methods
  getPlayerByName(playerName) {
    // activePlayers is a Map of socketId -> player
    for (const [socketId, player] of this.players) {
      if (player && player.name === playerName) {
        return player
      }
    }
    return null
  }

  sendToPlayer(playerName, message) {
    // Use global helper function to get player socket
    const socket = global.getPlayerSocket(playerName)
    if (socket) {
      socket.emit('output', message)
    }
  }

  sendCombatMessages(session, messages) {
    const fullMessage = messages.join('\n')
    for (const playerName of session.players) {
      this.sendToPlayer(playerName, fullMessage)
    }
  }

  sendGameStateUpdate(player) {
    const socket = global.getPlayerSocket(player.name)
    if (socket) {
      const gameState = {
        player: {
          name: player.name,
          level: player.level,
          health: player.health,
          maxHealth: player.maxHealth,
          gold: player.gold,
          location: player.location,
          inCombat: player.inCombat,
          currentArea: player.currentArea,
          currentRoom: player.currentRoom
        }
      }
      
      // Include combat information if player is in combat
      if (player.inCombat) {
        const combatSession = this.getPlayerCombatSession(player.name)
        if (combatSession) {
          gameState.combatInfo = {
            players: combatSession.players,
            enemies: combatSession.enemies.map(enemy => ({
              id: enemy.id,
              name: enemy.name,
              combatName: enemy.combatName,
              currentHealth: enemy.currentHealth,
              maxHealth: enemy.maxHealth
            })),
            round: combatSession.round
          }
        }
      }
      
      socket.emit('gameState', gameState)
    }
  }

  updateQuestProgress(player, type, target, quantity) {
    if (this.worldManager.questSystem) {
      return this.worldManager.questSystem.updateQuestProgress(player, type, target, quantity)
    }
    return false
  }
}

export default CombatManager