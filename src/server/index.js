import { GameEngine } from './GameEngine.js'

/**
 * Mudden v2 Server Entry Point
 * Clean architecture with tick-based processing and data-driven protocol
 */

console.log('='.repeat(50))
console.log('   MUDDEN v2 SERVER')
console.log('   Clean Architecture | Tick-Based | Data-Driven')
console.log('='.repeat(50))

// Create and start the game engine
const gameEngine = new GameEngine()

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...')
  gameEngine.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...')
  gameEngine.stop()
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  gameEngine.stop()
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  gameEngine.stop()
  process.exit(1)
})

// Start the server
try {
  gameEngine.start()
  
  // Log server stats every 30 seconds
  setInterval(() => {
    const stats = gameEngine.getStats()
    console.log(`Server Stats - Tick: ${stats.currentTick}, Players: ${stats.connectedPlayers}, Uptime: ${Math.floor(stats.uptime)}s`)
  }, 30000)
  
} catch (error) {
  console.error('Failed to start server:', error)
  process.exit(1)
}