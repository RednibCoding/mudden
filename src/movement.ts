// Movement system

import { Player } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';
import { isInCombat } from './combat';
import { getLocation, getConfig } from './utils';

// Valid movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down'];
const DIRECTION_SHORTCUTS: { [key: string]: string } = {
  'n': 'north',
  's': 'south',
  'e': 'east',
  'w': 'west',
  'u': 'up',
  'd': 'down'
};

export function move(player: Player, direction: string): void {
  // Check if player is in combat
  if (isInCombat(player)) {
    send(player, "You can't move while in combat! Use 'flee' to escape.", 'error');
    return;
  }
  
  // Normalize direction (handle shortcuts)
  const normalizedDir = DIRECTION_SHORTCUTS[direction.toLowerCase()] || direction.toLowerCase();
  
  // Validate direction
  if (!DIRECTIONS.includes(normalizedDir)) {
    send(player, `"${direction}" is not a valid direction.`, 'error');
    return;
  }
  
  const location = getLocation(player);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // Check if exit exists
  const exitId = location.exits[normalizedDir];
  
  if (!exitId) {
    send(player, "You can't go that way.", 'error');
    return;
  }
  
  // Check if destination exists
  const destination = gameState.gameData.locations.get(exitId);
  
  if (!destination) {
    send(player, 'That exit leads nowhere!', 'error');
    console.error(`Invalid exit: ${location.id} -> ${normalizedDir} -> ${exitId} (destination not found)`);
    return;
  }
  
  // Announce departure
  const oldLocation = player.location;
  broadcast(oldLocation, `${player.displayName} leaves ${normalizedDir}.`, 'system', player.id);
  
  // Move player
  player.location = exitId;
  
  // Announce arrival
  broadcast(exitId, `${player.displayName} arrives.`, 'system', player.id);
  
  // Show new location
  look(player);
}

export function look(player: Player): void {
  const location = getLocation(player);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  // Add (Shop) to title if location has a shop
  const shopTag = location.shop ? ' (Shop)' : '';
  let message = `\n=== ${location.name}${shopTag} ===\n${location.description}`;
  
  // Exits
  const exits = Object.keys(location.exits);
  if (exits.length > 0) {
    message += '\n\nExits:\n';
    for (const dir of exits) {
      const destinationId = location.exits[dir];
      const destination = gameState.gameData.locations.get(destinationId);
      const destinationName = destination ? destination.name : destinationId;
      message += `  - ${dir}: ${destinationName}\n`;
    }
  }
  
  // NPCs and Players (People)
  const people: string[] = [];
  
  // Add NPCs
  if (location.npcs && location.npcs.length > 0) {
    location.npcs.forEach(npc => people.push(npc.name));
  }
  
  // Add Players in location (excluding self)
  const playersHere = Array.from(gameState.players.values())
    .filter(p => p.location === player.location && p.id !== player.id && p.socket);
  
  // Add player display names
  playersHere.forEach(p => {
    people.push(p.displayName);
  });
  
  // Display people if any
  if (people.length > 0) {
    message += '\nPeople:\n  - ' + people.join(', ') + '\n';
  }
  
  // Enemies
  if (location.enemies && location.enemies.length > 0) {
    const enemyNames = location.enemies.map(enemy => enemy.name).join(', ');
    message += `\nEnemies:\n  - ${enemyNames}\n`;
  }
  
  // Items on ground
  if (location.items && location.items.length > 0) {
    const itemNames = location.items.map(item => item.name).join(', ');
    message += `\nItems:\n  - ${itemNames}\n`;
  }
  
  // Resources
  if (location.resources && location.resources.length > 0) {
    message += '\nResources:\n';
    for (const node of location.resources) {
      const material = gameState.gameData.materials.get(node.materialId);
      if (!material) continue;
      
      const cooldownKey = `${location.id}_${node.materialId}`;
      const lastHarvest = player.lastHarvest[cooldownKey] || 0;
      const now = Date.now();
      const timeLeft = node.cooldown - (now - lastHarvest);
      
      if (timeLeft <= 0) {
        message += `  - ${material.name} (ready to harvest!)\n`;
      } else {
        const mins = Math.ceil(timeLeft / 60000);
        message += `  - ${material.name} (available in ${mins} minutes)\n`;
      }
    }
  }
  
  send(player, message, 'info');
}
