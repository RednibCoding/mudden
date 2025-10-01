import { OBJECTIVE_TYPES } from './constants/QuestConstants.js'

class CombatManager {
  constructor(worldManager, players, io) {
    this.worldManager = worldManager
    this.players = players
    this.io = io
    
    // Simplified combat tracking: playerName -> { enemies: [...], startTime, areaId, roomId }
    this.activeCombats = new Map()
  }

  // Check if player is in combat
  isPlayerInCombat(playerName) {
    return this.activeCombats.has(playerName)
  }

  // Get combat session for player
  getPlayerCombatSession(playerName) {
    return this.activeCombats.get(playerName) || null
  }

  // Start combat between player and target
  startCombat(player, target) {
    // Prevent movement during combat
    player.inCombat = true
    
    // Stop health recovery during combat
    player.stopHealthRecovery()
    
    // Update client to show combat border immediately
    this.sendGameStateUpdate(player)
    
    // Check if player is already in combat
    if (this.activeCombats.has(player.name)) {
      return `You are already in combat!`
    }
    
    // Prepare target data
    let targetData = { ...target }
    if (target.type === 'enemy') {
      const sharedInstance = this.worldManager.getSharedEnemyInstance(
        player.currentArea, 
        player.currentRoom, 
        target.id
      )
      if (sharedInstance) {
        targetData = { ...sharedInstance }
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
    
    // Initialize simple damage tracking for targeting
    targetData.damageBy = {}
    
    // Look for existing combat in this room with the same target
    const playersInRoom = this.getPlayersInRoom(player.currentArea, player.currentRoom)
    let joinedCombat = false
    
    for (const otherPlayerName of playersInRoom) {
      if (otherPlayerName === player.name) continue
      
      const otherCombat = this.activeCombats.get(otherPlayerName)
      if (otherCombat && otherCombat.enemies.some(enemy => enemy.id === target.id)) {
        // Join existing combat
        const combat = {
          enemies: otherCombat.enemies,
          startTime: otherCombat.startTime,
          areaId: player.currentArea,
          roomId: player.currentRoom
        }
        
        this.activeCombats.set(player.name, combat)
        
        // Notify other players
        const joinMessage = `${player.name} joins the combat!`
        for (const playerName of playersInRoom) {
          if (playerName !== player.name && this.activeCombats.has(playerName)) {
            this.sendToPlayer(playerName, joinMessage)
          }
        }
        
        joinedCombat = true
        break
      }
    }
    
    if (!joinedCombat) {
      // Create new combat
      const combat = {
        enemies: [targetData],
        startTime: Date.now(),
        areaId: player.currentArea,
        roomId: player.currentRoom
      }
      
      this.activeCombats.set(player.name, combat)
    }
    
    return `You attack ${target.combatName || target.name}! Combat begins...`
  }

  // Process combat for a specific player
  processCombat(playerName) {
    const combat = this.activeCombats.get(playerName)
    if (!combat) return
    
    const player = this.getPlayerByName(playerName)
    if (!player) return
    
    const combatMessages = []
    
    // Get all players in this combat (same room, same enemies)
    const allCombatPlayers = this.getPlayersInCombat(combat.areaId, combat.roomId, combat.enemies)
    
    // Phase 1: All players attack (but only process once per round)
    if (allCombatPlayers[0] === playerName) { // Only first player processes the round
      for (const combatPlayerName of allCombatPlayers) {
        const combatPlayer = this.getPlayerByName(combatPlayerName)
        if (!combatPlayer) continue
        
        // Choose random alive enemy
        const aliveEnemies = combat.enemies.filter(enemy => enemy.currentHealth > 0)
        if (aliveEnemies.length === 0) break
        
        const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
        const playerDamage = this.calculatePlayerDamage(combatPlayer)
        targetEnemy.currentHealth -= playerDamage
        
        // Track damage for simple targeting
        if (!targetEnemy.damageBy[combatPlayerName]) {
          targetEnemy.damageBy[combatPlayerName] = 0
        }
        targetEnemy.damageBy[combatPlayerName] += playerDamage
        
        // Update shared enemy instance if applicable
        if (targetEnemy.isShared) {
          this.worldManager.updateSharedEnemyHealth(
            combat.areaId, 
            combat.roomId, 
            targetEnemy.id, 
            targetEnemy.currentHealth
          )
        }
        
        combatMessages.push(`${combatPlayerName} hits ${targetEnemy.name} for ${playerDamage} damage.`)
        
        // Check if enemy is defeated
        if (targetEnemy.currentHealth <= 0) {
          combatMessages.push(`${targetEnemy.name} is defeated!`)
          
          // Update quest progress for all players who participated
          if (this.worldManager.questSystem) {
            for (const playerName of allCombatPlayers) {
              const player = this.getPlayerByName(playerName)
              if (player) {
                this.worldManager.questSystem.updateQuestProgress(player, OBJECTIVE_TYPES.KILL, targetEnemy.id)
              }
            }
          }
          
          // Handle rewards for this enemy
          const rewards = this.calculateEnemyRewards(targetEnemy, allCombatPlayers)
          if (rewards) {
            combatMessages.push(rewards)
          }
        }
      }
      
      // Phase 2: All alive enemies attack
      const aliveEnemies = combat.enemies.filter(enemy => enemy.currentHealth > 0)
      for (const enemy of aliveEnemies) {
        if (allCombatPlayers.length === 0) break
        
        // Simple targeting: attack player who did most damage, or random if none
        const targetPlayerName = this.selectEnemyTarget(enemy, allCombatPlayers)
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
            combatMessages.push(`${targetPlayerName} is defeated and disappears!`)
            
            // Remove defeated player from combat
            this.activeCombats.delete(targetPlayerName)
            
            // Clean up damage tracking
            for (const enemy of combat.enemies) {
              if (enemy.damageBy && enemy.damageBy[targetPlayerName]) {
                delete enemy.damageBy[targetPlayerName]
              }
            }
          }
        }
      }
      
      // Send messages to all combat participants
      for (const combatPlayerName of allCombatPlayers) {
        if (this.activeCombats.has(combatPlayerName)) {
          for (const message of combatMessages) {
            this.sendToPlayer(combatPlayerName, message)
          }
          
          // Send updated game state
          const combatPlayer = this.getPlayerByName(combatPlayerName)
          if (combatPlayer) {
            this.sendGameStateUpdate(combatPlayer)
          }
        }
      }
    }
    
    // Check if combat should end
    const aliveEnemies = combat.enemies.filter(enemy => enemy.currentHealth > 0)
    if (aliveEnemies.length === 0) {
      // Combat victory
      for (const combatPlayerName of allCombatPlayers) {
        if (this.activeCombats.has(combatPlayerName)) {
          this.endCombat(combatPlayerName, 'victory')
        }
      }
    }
  }

  // Get all players currently in combat in the same room with same enemies
  getPlayersInCombat(areaId, roomId, enemies) {
    const players = []
    const enemyIds = enemies.map(e => e.id).sort()
    
    for (const [playerName, combat] of this.activeCombats) {
      if (combat.areaId === areaId && combat.roomId === roomId) {
        const combatEnemyIds = combat.enemies.map(e => e.id).sort()
        if (JSON.stringify(enemyIds) === JSON.stringify(combatEnemyIds)) {
          players.push(playerName)
        }
      }
    }
    
    return players.sort() // Sort for consistent ordering
  }

  // Simple enemy target selection
  selectEnemyTarget(enemy, playerNames) {
    // Target player who has done most damage, or random if none
    if (enemy.damageBy && Object.keys(enemy.damageBy).length > 0) {
      let maxDamage = 0
      let topPlayer = null
      
      for (const [playerName, damage] of Object.entries(enemy.damageBy)) {
        if (damage > maxDamage && playerNames.includes(playerName)) {
          maxDamage = damage
          topPlayer = playerName
        }
      }
      
      if (topPlayer) return topPlayer
    }
    
    // Random selection as fallback
    return playerNames[Math.floor(Math.random() * playerNames.length)]
  }

  // End combat for a player
  endCombat(playerName, reason = 'ended') {
    const combat = this.activeCombats.get(playerName)
    if (!combat) return
    
    const player = this.getPlayerByName(playerName)
    if (player) {
      player.inCombat = false
      player.startHealthRecovery()
      
      if (reason === 'victory') {
        this.sendToPlayer(playerName, 'Victory! Combat has ended.')
      } else if (reason === 'flee') {
        this.sendToPlayer(playerName, 'You flee from combat!')
      } else {
        this.sendToPlayer(playerName, 'Combat has ended.')
      }
      
      this.sendGameStateUpdate(player)
    }
    
    this.activeCombats.delete(playerName)
  }

  // Remove player from combat (disconnect, flee, etc.)
  removePlayerFromCombat(playerName, reason = 'left') {
    const combat = this.activeCombats.get(playerName)
    if (!combat) return
    
    // Clean up damage tracking
    for (const enemy of combat.enemies) {
      if (enemy.damageBy && enemy.damageBy[playerName]) {
        delete enemy.damageBy[playerName]
      }
    }
    
    this.endCombat(playerName, reason)
    
    // Notify other players in the same combat
    const remainingPlayers = this.getPlayersInCombat(combat.areaId, combat.roomId, combat.enemies)
    for (const otherPlayerName of remainingPlayers) {
      if (otherPlayerName !== playerName) {
        this.sendToPlayer(otherPlayerName, `${playerName} has left the combat.`)
      }
    }
  }

  // Helper method to get players in a room
  getPlayersInRoom(areaId, roomId) {
    const playersInRoom = []
    for (const [socketId, player] of this.players) {
      if (player && player.currentArea === areaId && player.currentRoom === roomId) {
        playersInRoom.push(player.name)
      }
    }
    return playersInRoom
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

  // Calculate player damage (keeping existing logic)
  calculatePlayerDamage(player) {
    const totalStats = player.getTotalStats(this.worldManager)
    const baseDamage = totalStats.strength || 10
    const variance = Math.floor(Math.random() * 6) - 2 // -2 to +3 variance
    return Math.max(1, baseDamage + variance)
  }

  // Calculate enemy damage (keeping existing logic)
  calculateEnemyDamage(enemy, targetPlayer) {
    if (enemy.attacks && enemy.attacks.length > 0) {
      // Choose random attack
      const availableAttacks = enemy.attacks.filter(attack => {
        return !attack.chance || Math.random() * 100 < attack.chance
      })
      
      if (availableAttacks.length > 0) {
        const chosenAttack = availableAttacks[Math.floor(Math.random() * availableAttacks.length)]
        const [minDamage, maxDamage] = chosenAttack.damage
        let damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage
        
        // Apply accuracy
        if (chosenAttack.accuracy && Math.random() * 100 > chosenAttack.accuracy) {
          return 0 // Miss
        }
        
        // Apply player defense
        const totalStats = targetPlayer.getTotalStats(this.worldManager)
        const defense = totalStats.defense || 0
        damage = Math.max(1, damage - defense)
        
        return damage
      }
    }
    
    // Fallback damage
    return Math.floor(Math.random() * 10) + 5
  }

  // Calculate enemy rewards (keeping existing logic)
  calculateEnemyRewards(enemy, playerNames) {
    // Distribute experience and gold
    const expPerPlayer = Math.floor((enemy.stats?.experience || 10) / playerNames.length)
    const goldReward = enemy.loot?.gold || [1, 5]
    const goldAmount = Array.isArray(goldReward) 
      ? Math.floor(Math.random() * (goldReward[1] - goldReward[0] + 1)) + goldReward[0]
      : goldReward
    const goldPerPlayer = Math.floor(goldAmount / playerNames.length)
    
    let rewardMessage = ''
    
    for (const playerName of playerNames) {
      const player = this.getPlayerByName(playerName)
      if (player) {
        // Use the proper addExperience method which handles level-ups
        const levelsGained = player.addExperience(expPerPlayer)
        player.gold = (player.gold || 0) + goldPerPlayer
        
        // Check if player leveled up
        if (levelsGained > 0) {
          rewardMessage += `${playerName} reached level ${player.level}! `
        }
        
        // Handle item drops
        if (enemy.loot?.items) {
          for (const itemDrop of enemy.loot.items) {
            if (Math.random() * 100 < itemDrop.chance) {
              const quantity = Array.isArray(itemDrop.quantity)
                ? Math.floor(Math.random() * (itemDrop.quantity[1] - itemDrop.quantity[0] + 1)) + itemDrop.quantity[0]
                : itemDrop.quantity || 1
              
              player.addItem(itemDrop.id, quantity)
              rewardMessage += `${playerName} found ${quantity}x ${itemDrop.id}! `
            }
          }
        }
        
        player.save()
      }
    }
    
    if (expPerPlayer > 0 || goldPerPlayer > 0) {
      rewardMessage += `All players gain ${expPerPlayer} experience and ${goldPerPlayer} gold.`
    }
    
    return rewardMessage || null
  }

  // Handle player death (keeping existing logic)
  handlePlayerDeath(player) {
    // Set health to 1 and respawn at homestone location (or default safe location if no homestone)
    player.health = 1
    
    if (player.homestone) {
      player.currentArea = player.homestone.area
      player.currentRoom = player.homestone.room
    } else {
      // Get default spawn location from world data
      const defaultSpawn = this.worldManager.getDefaultSpawnLocation()
      player.currentArea = defaultSpawn.area
      player.currentRoom = defaultSpawn.room
    }
    
    player.inCombat = false
    player.save()
    
    const respawnLocation = player.homestone ? 'your homestone location' : 'a safe location'
    return `You have been defeated! You awaken at ${respawnLocation}.`
  }

  // Send message to specific player
  sendToPlayer(playerName, message) {
    const socket = global.getPlayerSocket(playerName)
    if (socket) {
      socket.emit('output', message)
    }
  }

  // Send game state update to player
  sendGameStateUpdate(player) {
    const socket = global.getPlayerSocket(player.name)
    if (!socket) return
    
    const room = this.worldManager.getRoom(player.currentArea, player.currentRoom)
    const gameState = {
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
        inCombat: player.inCombat,
        activeQuests: player.activeQuests || []
      },
      room: room
    }
    
    // Add combat info if in combat
    const combat = this.activeCombats.get(player.name)
    if (combat) {
      gameState.combatInfo = {
        enemies: combat.enemies.filter(enemy => enemy.currentHealth > 0).map(enemy => ({
          name: enemy.name,
          combatName: enemy.combatName || enemy.name,
          currentHealth: enemy.currentHealth,
          maxHealth: enemy.maxHealth
        })),
        players: this.getPlayersInCombat(combat.areaId, combat.roomId, combat.enemies)
      }
    }
    
    socket.emit('gameState', gameState)
  }

  // Process all active combats (called by tick system)
  processCombatTick() {
    const processedCombats = new Set()
    
    for (const [playerName, combat] of this.activeCombats) {
      const combatKey = `${combat.areaId}.${combat.roomId}.${combat.enemies.map(e => e.id).join(',')}`
      
      if (!processedCombats.has(combatKey)) {
        this.processCombat(playerName)
        processedCombats.add(combatKey)
      }
    }
  }
}

export default CombatManager