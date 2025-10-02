/**
 * Session commands (quit/logout)
 */
import { Player } from '../types';

/**
 * Handles quit/logout command
 * Note: The actual disconnect logic is handled in the server's handlePlayerDisconnect function
 */
export function handleQuitCommand(socket: any, player: Player): void {
  // Send a special quit message to client
  setTimeout(() => {
    socket.emit('message', { type: 'success', data: 'logout_complete' });
  }, 1000);
  
  // The server's disconnect handler will be triggered automatically
  // which saves the player and broadcasts departure message
}
