// Movement system

import { Player } from './types';
import { gameState } from './game';
import { send, broadcast } from './messaging';

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
  // Normalize direction (handle shortcuts)
  const normalizedDir = DIRECTION_SHORTCUTS[direction.toLowerCase()] || direction.toLowerCase();
  
  // Validate direction
  if (!DIRECTIONS.includes(normalizedDir)) {
    send(player, `"${direction}" is not a valid direction.`, 'error');
    return;
  }
  
  const location = gameState.gameData.locations.get(player.location);
  
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
  broadcast(oldLocation, `${player.username} leaves ${normalizedDir}.`, 'system', player.id);
  
  // Move player
  player.location = exitId;
  
  // Announce arrival
  broadcast(exitId, `${player.username} arrives.`, 'system', player.id);
  
  // Show new location
  look(player);
}

export function look(player: Player): void {
  const location = gameState.gameData.locations.get(player.location);
  
  if (!location) {
    send(player, 'You are nowhere!', 'error');
    return;
  }
  
  send(player, `\n[${location.name}]`, 'info');
  send(player, location.description, 'info');
  
  // Exits
  const exits = Object.keys(location.exits);
  if (exits.length > 0) {
    send(player, '\nExits:', 'info');
    for (const dir of exits) {
      const destinationId = location.exits[dir];
      const destination = gameState.gameData.locations.get(destinationId);
      const destinationName = destination ? destination.name : destinationId;
      send(player, `  - ${dir}: ${destinationName}`, 'info');
    }
  }
  
  // NPCs
  if (location.npcs && location.npcs.length > 0) {
    send(player, '\nNPCs:', 'info');
    const npcNames = location.npcs.map(npc => npc.name).join(', ');
    send(player, `  - ${npcNames}`, 'info');
  }
  
  // Enemies
  if (location.enemies && location.enemies.length > 0) {
    send(player, '\nEnemies:', 'info');
    const enemyNames = location.enemies.map(enemy => enemy.name).join(', ');
    send(player, `  - ${enemyNames}`, 'error');
  }
  
  // Items on ground
  if (location.items && location.items.length > 0) {
    send(player, '\nItems:', 'info');
    const itemNames = location.items.map(item => item.name).join(', ');
    send(player, `  - ${itemNames}`, 'info');
  }
  
  // Resources
  if (location.resources && location.resources.length > 0) {
    send(player, '\nResources:', 'info');
    for (const node of location.resources) {
      const material = gameState.gameData.materials.get(node.materialId);
      if (!material) continue;
      
      const cooldownKey = `${location.id}_${node.materialId}`;
      const lastHarvest = player.lastHarvest[cooldownKey] || 0;
      const now = Date.now();
      const timeLeft = node.cooldown - (now - lastHarvest);
      
      if (timeLeft <= 0) {
        send(player, `  - ${material.name} (ready to harvest!)`, 'success');
      } else {
        const mins = Math.ceil(timeLeft / 60000);
        send(player, `  - ${material.name} (available in ${mins} minutes)`, 'info');
      }
    }
  }
  
  // Players in location (excluding self)
  const players = gameState.players;
  const playersHere = Array.from(players.values())
    .filter(p => p.location === player.location && p.id !== player.id && p.socket);
  
  if (playersHere.length > 0) {
    send(player, '\nPlayers:', 'info');
    const playerNames = playersHere.map(p => p.username).join(', ');
    send(player, `  - ${playerNames}`, 'info');
  }
}
