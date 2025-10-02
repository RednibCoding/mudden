/**
 * Information and display commands
 */
import { Player } from '../types';
import { gameState, activePlayers } from '../gameState';
import { isEnemyVisibleToPlayer, isGroundItemVisibleToPlayer, calculatePlayerDamage, calculatePlayerDefense, calculateXPForLevel } from '../utils';

/**
 * Shows the current location description
 */
export function handleLook(socket: any, player: Player): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return;
  }

  let locationTitle = location.name;
  if (location.homestone) locationTitle += ' (Home)';
  if (location.shop) locationTitle += ' (Shop)';
  if (location.pvpAllowed) locationTitle += ' (PvP)';

  let description = `=== ${locationTitle} ===\n${location.description}\n\n`;

  // Show NPCs and players
  const peopleHere: string[] = [];
  location.npcs.forEach(npcId => {
    const npc = gameState.npcs.get(npcId);
    if (npc) peopleHere.push(npc.name);
  });

  activePlayers.forEach((username) => {
    if (username !== player.username) {
      const otherPlayer = gameState.players.get(username);
      if (otherPlayer && otherPlayer.location === player.location) {
        peopleHere.push(username);
      }
    }
  });

  if (peopleHere.length > 0) {
    description += 'People here:\n - ' + peopleHere.join(', ') + '\n\n';
  }

  // Show enemies
  const enemiesHere: string[] = [];
  location.enemies.forEach(enemy => {
    if (enemy && enemy.health > 0 && isEnemyVisibleToPlayer(enemy, player, player.location)) {
      const healthPercent = Math.round((enemy.health / enemy.maxHealth) * 100);
      let healthDesc = '';
      if (healthPercent < 25) healthDesc = ' (badly wounded)';
      else if (healthPercent < 50) healthDesc = ' (wounded)';
      else if (healthPercent < 75) healthDesc = ' (lightly wounded)';
      enemiesHere.push(`${enemy.name}${healthDesc}`);
    }
  });

  if (enemiesHere.length > 0) {
    description += 'Enemies here:\n - ' + enemiesHere.join(', ') + '\n\n';
  }

  // Show ground items
  const visibleItems: string[] = [];
  if (location.groundItems) {
    location.groundItems.forEach(groundItem => {
      if (isGroundItemVisibleToPlayer(groundItem, player, player.location)) {
        const item = gameState.items.get(groundItem.itemId);
        if (item) visibleItems.push(item.name);
      }
    });
  }

  if (location.droppedItems) {
    location.droppedItems.forEach(groundItem => {
      const item = gameState.items.get(groundItem.itemId);
      if (item) visibleItems.push(item.name);
    });
  }

  if (visibleItems.length > 0) {
    description += 'Items:\n - ' + visibleItems.join(', ') + '\n\n';
  }

  // Show exits
  if (Object.keys(location.exits).length > 0) {
    description += 'Exits:\n';
    Object.entries(location.exits).forEach(([direction, locationId]) => {
      const exitLocation = gameState.locations.get(locationId);
      const locationName = exitLocation ? exitLocation.name.toLowerCase() : locationId;
      description += ` - ${direction}: ${locationName}\n`;
    });
  }

  socket.emit('message', { type: 'message', data: { text: description, type: 'normal' } });
}

/**
 * Shows the area map
 */
export function handleMap(socket: any, player: Player): void {
  const currentLoc = gameState.locations.get(player.location);
  if (!currentLoc) {
    socket.emit('message', { type: 'error', data: 'Current location not found' });
    return;
  }

  interface Coord { x: number; y: number; z: number; }
  const coords = new Map<string, Coord>();
  const vectors: Record<string, Coord> = {
    north: { x: 0, y: 1, z: 0 },
    south: { x: 0, y: -1, z: 0 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 },
    northeast: { x: 1, y: 1, z: 0 },
    northwest: { x: -1, y: 1, z: 0 },
    southeast: { x: 1, y: -1, z: 0 },
    southwest: { x: -1, y: -1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    down: { x: 0, y: 0, z: -1 }
  };

  coords.set(player.location, { x: 0, y: 0, z: 0 });
  const queue: string[] = [player.location];
  const visited = new Set<string>([player.location]);
  const maxDepth = 5;
  const depths = new Map<string, number>();
  depths.set(player.location, 0);

  while (queue.length > 0) {
    const locId = queue.shift()!;
    const location = gameState.locations.get(locId)!;
    const currentCoord = coords.get(locId)!;
    const currentDepth = depths.get(locId)!;

    if (currentDepth >= maxDepth) continue;

    for (const [direction, targetId] of Object.entries(location.exits)) {
      const vector = vectors[direction];
      if (!vector) continue;

      const expectedCoord: Coord = {
        x: currentCoord.x + vector.x,
        y: currentCoord.y + vector.y,
        z: currentCoord.z + vector.z
      };

      if (!coords.has(targetId)) {
        coords.set(targetId, expectedCoord);
        depths.set(targetId, currentDepth + 1);
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
    }
  }

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  coords.forEach(coord => {
    if (coord.z === 0) {
      minX = Math.min(minX, coord.x);
      maxX = Math.max(maxX, coord.x);
      minY = Math.min(minY, coord.y);
      maxY = Math.max(maxY, coord.y);
    }
  });

  const coordToLoc = new Map<string, string>();
  const locToName = new Map<string, string>();
  coords.forEach((coord, locId) => {
    if (coord.z === 0) {
      const key = `${coord.x},${coord.y}`;
      coordToLoc.set(key, locId);
      const location = gameState.locations.get(locId)!;
      const truncated = location.name.length > 11
        ? location.name.substring(0, 11)
        : location.name.padEnd(11, ' ');
      locToName.set(locId, truncated);
    }
  });

  let mapText = '\n=== Area Map ===\n\n';
  const cellWidth = 15;

  for (let y = maxY; y >= minY; y--) {
    if (y < maxY) {
      let northRow = '';
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const locId = coordToLoc.get(key);
        if (locId) {
          const location = gameState.locations.get(locId)!;
          const northKey = `${x},${y + 1}`;
          const neKey = `${x + 1},${y + 1}`;
          const nwKey = `${x - 1},${y + 1}`;
          const hasNorth = location.exits.north && coordToLoc.get(northKey) === location.exits.north;
          const hasNE = location.exits.northeast && coordToLoc.get(neKey) === location.exits.northeast;
          const hasNW = location.exits.northwest && coordToLoc.get(nwKey) === location.exits.northwest;
          let connStr = (hasNW ? '\\' : ' ') + '     ' + (hasNorth ? '|' : ' ') + '     ' + (hasNE ? '/' : ' ') + '  ';
          northRow += connStr;
        } else {
          northRow += ' '.repeat(cellWidth);
        }
      }
      mapText += northRow + '\n';
    }

    let locationRow = '';
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`;
      const locId = coordToLoc.get(key);
      if (locId) {
        const location = gameState.locations.get(locId)!;
        const name = locToName.get(locId)!;
        const eastKey = `${x + 1},${y}`;
        const hasEast = location.exits.east && coordToLoc.get(eastKey) === location.exits.east;
        locationRow += (locId === player.location ? `[    You    ]` : `[${name}]`) + (hasEast ? '--' : '  ');
      } else {
        locationRow += ' '.repeat(cellWidth);
      }
    }
    mapText += locationRow + '\n';

    if (y > minY) {
      let southRow = '';
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const locId = coordToLoc.get(key);
        if (locId) {
          const location = gameState.locations.get(locId)!;
          const southKey = `${x},${y - 1}`;
          const seKey = `${x + 1},${y - 1}`;
          const swKey = `${x - 1},${y - 1}`;
          const hasSouth = location.exits.south && coordToLoc.get(southKey) === location.exits.south;
          const hasSE = location.exits.southeast && coordToLoc.get(seKey) === location.exits.southeast;
          const hasSW = location.exits.southwest && coordToLoc.get(swKey) === location.exits.southwest;
          let connStr = (hasSW ? '/' : ' ') + '     ' + (hasSouth ? '|' : ' ') + '     ' + (hasSE ? '\\' : ' ') + '  ';
          southRow += connStr;
        } else {
          southRow += ' '.repeat(cellWidth);
        }
      }
      mapText += southRow + '\n';
    }
  }

  socket.emit('message', { type: 'message', data: { text: mapText + '\n', type: 'info' } });
}

/**
 * Shows player inventory and stats
 */
export function handleInventory(socket: any, player: Player): void {
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  const equipped = player.equipment;
  const totalDamage = calculatePlayerDamage(player);
  const totalDefense = calculatePlayerDefense(player);

  let text = `=== Character Status ===\nName: ${player.username}\n`;

  const totalXPForNextLevel = calculateXPForLevel(player.level);
  text += `Level: ${player.level} (${player.experience}/${totalXPForNextLevel} XP)\n`;
  text += `Health: ${player.health}/${player.maxHealth}\n`;
  text += `Damage: ${totalDamage}\nDefense: ${totalDefense}\n`;
  text += `PvP Record: ${player.pvpWins || 0}W - ${player.pvpLosses || 0}L\n\n`;

  text += `=== Equipment ===\n`;
  text += `Weapon: ${equipped.weapon ? `${equipped.weapon.name}${equipped.weapon.stats?.damage ? ` (+${equipped.weapon.stats.damage} damage)` : ''}` : 'None'}\n`;
  text += `Armor: ${equipped.armor ? `${equipped.armor.name}${equipped.armor.stats?.defense ? ` (+${equipped.armor.stats.defense} defense)` : ''}` : 'None'}\n`;
  text += `Shield: ${equipped.shield ? `${equipped.shield.name}${equipped.shield.stats?.defense ? ` (+${equipped.shield.stats.defense} defense)` : ''}` : 'None'}\n`;

  text += `\n=== Inventory (${player.inventory.length}/${maxSlots}) ===\nGold: ${player.gold}\n`;
  if (player.inventory.length === 0) {
    text += 'Your inventory is empty.\n';
  } else {
    player.inventory.forEach((item, index) => {
      text += `${index + 1}. ${item.name}\n`;
    });
  }

  socket.emit('message', { type: 'message', data: { text, type: 'normal' } });
}

/**
 * Shows help information
 */
export function handleHelp(socket: any): void {
  const help = `
=== Commands ===
Movement:
- north, south, east, west (n, s, e, w): Move in a direction
- up, down (u, d): Move up or down
- go <direction>: Move in the specified direction

Combat:
- attack <enemy>: Attack an enemy (also: hit, strike)
- flee: Escape from combat (also: run)

Communication:
- say <message>: Say something to everyone in the room
- whisper (wis) <player> <message>: Send a private message
- reply (r) <message>: Reply to the last person who whispered to you
- talk <npc>: Talk to an NPC (also: speak)
- who: See who's online

Social:
- friends (f): List your friends with online status
- friend (f) add <player>: Add a player to your friend list
- friend (f) remove <player>: Remove a player from your friend list

Information:
- look (l): Look around
- inventory (i): Check your health, level, gold and inventory (also: inv)
- examine (x) <item>|<player>: Examine an item in your inventory or equipped or a player (also: inspect, lookat, ex)
- help: Show this help message

Equipment:
- equip <item>: Equip a weapon, armor, or shield (also: wear, wield)
- unequip <item>: Unequip an item (also: remove)
- use <item>: Use a consumable item (potions, scrolls, etc.)

Shopping:
- list (shop): View items available in the current shop
- buy <item>: Purchase an item from a shop
- sell <item>: Sell an item from your inventory to a shop

Other:
- homestone bind: Bind your homestone to current location
- homestone where: Show your current homestone location
- homestone recall: Teleport to your homestone location (cannot use in combat)
- quit: Log out of the game
- logout: Same as quit
`;
  socket.emit('message', { type: 'message', data: { text: help, type: 'normal' } });
}
