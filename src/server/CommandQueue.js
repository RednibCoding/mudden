/**
 * Command Queue - collects commands from clients during tick intervals
 * Thread-safe command storage for atomic processing
 */
export class CommandQueue {
  constructor() {
    this.commands = []
  }
  
  /**
   * Add a command to the queue
   */
  add(command) {
    this.commands.push({
      command,
      receivedAt: Date.now()
    })
  }
  
  /**
   * Get all commands and clear the queue atomically
   */
  getAndClear() {
    const commands = [...this.commands]
    this.commands = []
    return commands
  }
  
  /**
   * Get current queue size
   */
  size() {
    return this.commands.length
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.commands.length === 0
  }
  
  /**
   * Clear the queue without returning commands
   */
  clear() {
    this.commands = []
  }
}