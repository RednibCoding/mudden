import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'

import WorldManager from './lib/WorldManager.js'
import CommandManager from './lib/CommandManager.js'
import GameTickManager from './lib/GameTickManager.js'
import AuthenticationManager from './lib/AuthenticationManager.js'
import SessionManager from './lib/SessionManager.js'
import SocketManager from './lib/SocketManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server)

// Initialize managers
const gameWorld = new WorldManager()
const sessionManager = new SessionManager(io)
const combatSessions = new Map() // playerId -> combat state
const commandManager = new CommandManager(gameWorld, sessionManager.getActivePlayers(), combatSessions, io)
const gameTickManager = new GameTickManager()
const authManager = new AuthenticationManager(io)
const socketManager = new SocketManager(io, authManager, sessionManager, gameWorld, commandManager, combatSessions)

// Connect managers
gameWorld.setGameTickManager(gameTickManager)
gameTickManager.setCombatManager(commandManager.combatManager)

// Add helper function to get player socket by name (used by other parts of the system)
global.getPlayerSocket = (playerName) => {
  return sessionManager.getPlayerSocket(playerName)
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')))

// Initialize game tick system and handlers
gameTickManager.setHealthRegenHandler((tick) => {
  // Health regeneration happens every 5 ticks
  for (const [socketId, player] of sessionManager.getActivePlayers()) {
    if (player) {
      player.processHealthRecoveryTick()
    }
  }
})

gameTickManager.setRespawnHandler((tick) => {
  // Check for respawns every tick
  gameWorld.processRespawnTick(tick)
})

gameTickManager.setCleanupHandler((tick) => {
  // Cleanup happens every 60 ticks (1 minute)
  const now = Date.now()
  for (const [playerId, combat] of combatSessions) {
    // Auto-abandon combat after 5 minutes of inactivity
    if (combat.lastAction && (now - combat.lastAction) > 300000) {
      // Store enemy info for cleanup
      const enemyId = combat.defender.enemyId
      const areaId = combat.attacker.data.currentArea
      const roomId = combat.attacker.data.currentRoom
      
      combatSessions.delete(playerId)
      console.log(`Auto-abandoned combat for ${playerId}`)
      
      // Clean up unused enemy instance
      if (enemyId) {
        const combatCommands = commandManager.getCommandInstance('CombatCommands')
        if (combatCommands) {
          combatCommands.cleanupUnusedEnemyInstance(areaId, roomId, enemyId)
        }
      }
    }
  }
})

// Start the global tick system (1 second per tick)
gameTickManager.start(1000)

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...')
  
  // Save all active players
  for (const [socketId, player] of sessionManager.getActivePlayers()) {
    player.save()
  }
  
  server.close(() => {
    console.log('👋 Server shut down complete')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...')
  
  // Save all active players
  for (const [socketId, player] of sessionManager.getActivePlayers()) {
    player.save()
  }
  
  server.close(() => {
    console.log('Server shut down complete')
    process.exit(0)
  })
})

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`
=======================================
   MUDDED SERVER STARTED
=======================================
Game world loaded with ${gameWorld.templateManager.areas.size} areas
Server running on http://localhost:${PORT}
Players can connect and start adventuring!
=======================================
  `)
})

export { gameWorld, sessionManager, combatSessions }