import { Server } from 'socket.io';
import { createServer } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { GameState, Player, ClientMessage, ServerMessage, Location, Item, Enemy, NPC, Quest, Shop, Defaults, Equipment, LocationEnemy, GroundItem } from './types';
import { createPlayer, savePlayer, loadPlayer, validatePassword, playerExists, sanitizePlayerName } from './auth';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const gameState: GameState = {
  players: new Map(),
  enemies: new Map(),
  locations: new Map(),
  items: new Map(),
  npcs: new Map(),
  quests: new Map(),
  shops: new Map(),
  defaults: {
    player: {
      startingLocation: "town_square",
      startingHealth: 100,
      startingMaxHealth: 100,
      startingLevel: 1,
      startingExperience: 0,
      startingGold: 50,
      baseDamage: 5,
      baseDefense: 3,
      maxInventorySlots: 16
    },
    combat: {
      playerDeathHealthThreshold: 1,
      enemyCounterAttackDelayMs: 2000,
      combatRoundDelayMs: 4000,
      fleeSuccessChance: 0.7
    },
    pvp: {
      goldLootPercentage: 0.03,
      baseExperience: 50,
      experienceByDifficulty: {
        trivial: 10,
        easy: 25,
        moderate: 50,
        challenging: 75,
        hard: 100,
        deadly: 150,
        impossible: 200
      }
    },
    levelUp: {
      healthGainPerLevel: 10,
      damageGainPerLevel: 2,
      defenseGainPerLevel: 1,
      fullHealOnLevelUp: true,
      baseExperiencePerLevel: 100,
      experienceMultiplier: 1.5,
      maxLevel: 20
    },
    items: {
      useCooldownMs: 1000 // 1 second default cooldown
    }
  }
};

const activePlayers = new Map<string, string>(); // socketId -> username

// Load game content from JSON files
function loadGameData(): void {
  const dataDir = path.join(__dirname, '../data');
  
  // Load defaults first
  try {
    const defaultsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'defaults.json'), 'utf8'));
    gameState.defaults = defaultsData;
    console.log('Loaded game defaults');
  } catch (error) {
    console.log('No defaults.json found, using hardcoded defaults');
  }
  
  // Load locations
  try {
    const locationsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'locations.json'), 'utf8'));
    locationsData.forEach((location: Location) => {
      gameState.locations.set(location.id, location);
    });
  } catch (error) {
    console.log('No locations.json found, using defaults');
  }
  
  // Load items
  try {
    const itemsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf8'));
    itemsData.forEach((item: Item) => {
      gameState.items.set(item.id, item);
    });
  } catch (error) {
    console.log('No items.json found, using defaults');
  }
  
  // Load enemies
  try {
    const enemiesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf8'));
    enemiesData.forEach((enemy: Enemy) => {
      gameState.enemies.set(enemy.id, { ...enemy, currentFighters: [] });
    });
  } catch (error) {
    console.log('No enemies.json found, using defaults');
  }
  
  // Load NPCs
  try {
    const npcsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
    npcsData.forEach((npc: NPC) => {
      gameState.npcs.set(npc.id, npc);
    });
  } catch (error) {
    console.log('No npcs.json found, using defaults');
  }
  
  // Load quests
  try {
    const questsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'quests.json'), 'utf8'));
    questsData.forEach((quest: Quest) => {
      gameState.quests.set(quest.id, quest);
    });
  } catch (error) {
    console.log('No quests.json found, using defaults');
  }
  
  // Load shops
  try {
    const shopsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'shops.json'), 'utf8'));
    shopsData.forEach((shop: Shop) => {
      gameState.shops.set(shop.id, shop);
    });
  } catch (error) {
    console.log('No shops.json found, using defaults');
  }
  
  // Create enemy instances directly in locations
  const enemyTemplates = new Map(gameState.enemies);
  
  gameState.locations.forEach((location, locationId) => {
    const enemyInstances: Enemy[] = [];
    
    // Convert LocationEnemy objects to enemy instance array
    ((location.enemies as any) as LocationEnemy[]).forEach((enemyDef: LocationEnemy) => {
      const template = enemyTemplates.get(enemyDef.enemyId);
      if (template) {
        const instance: Enemy = {
          ...template,
          currentFighters: [],
          prerequisiteActiveQuests: enemyDef.prerequisiteActiveQuests,
          prerequisiteCompletedQuests: enemyDef.prerequisiteCompletedQuests,
          oneTime: enemyDef.oneTime
        };
        enemyInstances.push(instance);
      }
    });
    
    location.enemies = enemyInstances as any;
  });
  
  // We can clear the global enemies map since enemies are now stored in locations
  gameState.enemies.clear();
  
  // Populate NPC locations from location data  
  gameState.locations.forEach((location, locationId) => {
    location.npcs.forEach(npcId => {
      const npc = gameState.npcs.get(npcId);
      if (npc) {
        if (!npc.locations) npc.locations = [];
        if (!npc.locations.includes(locationId)) {
          npc.locations.push(locationId);
        }
      }
    });
  });
}

// Helper function to find which location an enemy is in
function getEnemyLocation(targetEnemy: Enemy): string | null {
  for (const [locationId, location] of gameState.locations) {
    if (location.enemies.includes(targetEnemy)) {
      return locationId;
    }
  }
  return null;
}

// Helper function to check if an enemy is in a specific location
function isEnemyInLocation(enemy: Enemy, locationId: string): boolean {
  const location = gameState.locations.get(locationId);
  return location ? location.enemies.includes(enemy) : false;
}

// Helper function to send message to enemy's location
function sendToEnemyLocations(enemy: Enemy, message: ServerMessage, excludePlayer?: string): void {
  const locationId = getEnemyLocation(enemy);
  if (locationId) {
    sendToLocation(locationId, message, excludePlayer);
  }
}

// Helper function to iterate over all enemies in all locations
function forEachEnemy(callback: (enemy: Enemy) => void): void {
  gameState.locations.forEach(location => {
    location.enemies.forEach(callback);
  });
}

// Helper function to check if a player meets quest prerequisites
function meetsQuestPrerequisites(player: Player, prerequisiteActiveQuests?: string[], prerequisiteCompletedQuests?: string[]): boolean {
  // Check active quest prerequisites
  if (prerequisiteActiveQuests && prerequisiteActiveQuests.length > 0) {
    const hasAllActiveQuests = prerequisiteActiveQuests.every(questId => 
      player.activeQuests.hasOwnProperty(questId)
    );
    if (!hasAllActiveQuests) return false;
  }
  
  // Check completed quest prerequisites
  if (prerequisiteCompletedQuests && prerequisiteCompletedQuests.length > 0) {
    const hasAllCompletedQuests = prerequisiteCompletedQuests.every(questId => 
      player.completedQuests.includes(questId)
    );
    if (!hasAllCompletedQuests) return false;
  }
  
  return true;
}

// Helper function to check if an enemy should be visible to a player
function isEnemyVisibleToPlayer(enemy: Enemy, player: Player, locationId: string): boolean {
  // Check if this is a one-time enemy that the player already defeated
  if (enemy.oneTime) {
    const oneTimeKey = `${locationId}.${enemy.id}`;
    if (player.oneTimeEnemiesDefeated.includes(oneTimeKey)) {
      return false;
    }
  }
  
  // Check quest prerequisites
  if (!meetsQuestPrerequisites(player, enemy.prerequisiteActiveQuests, enemy.prerequisiteCompletedQuests)) {
    return false;
  }
  
  return true;
}

// Helper function to check if a ground item should be visible to a player
function isGroundItemVisibleToPlayer(groundItem: any, player: Player, locationId: string): boolean {
  // Check if this is a one-time item that the player already picked up
  if (groundItem.oneTime) {
    const oneTimeKey = `${locationId}.${groundItem.itemId}`;
    if (player.oneTimeItemsPickedUp.includes(oneTimeKey)) {
      return false;
    }
  }
  
  // Check if item is currently picked up and waiting to respawn
  if (groundItem.lastPickedUp && groundItem.respawnTime) {
    const timeSincePickup = Date.now() - groundItem.lastPickedUp;
    if (timeSincePickup < groundItem.respawnTime) {
      return false; // Still waiting to respawn
    }
  }
  
  // Check quest prerequisites
  if (!meetsQuestPrerequisites(player, groundItem.prerequisiteActiveQuests, groundItem.prerequisiteCompletedQuests)) {
    return false;
  }
  
  return true;
}

// Send message to player
function sendToPlayer(username: string, message: ServerMessage): void {
  const socketId = Array.from(activePlayers.entries()).find(([_, user]) => user.toLowerCase() === username.toLowerCase())?.[0];
  if (socketId) {
    io.to(socketId).emit('message', message);
  }
}

// Send message to all players in location
function sendToLocation(locationId: string, message: ServerMessage, except?: string): void {
  try {
    // Only send to currently connected players
    activePlayers.forEach((username, socketId) => {
      if (username !== except) {
        const player = gameState.players.get(username);
        if (player && player.location === locationId) {
          io.to(socketId).emit('message', message);
        }
      }
    });
  } catch (error) {
    console.error('Error in sendToLocation:', error);
  }
}

// Send global message
function sendGlobal(message: ServerMessage, except?: string): void {
  activePlayers.forEach((username, socketId) => {
    if (username !== except) {
      io.to(socketId).emit('message', message);
    }
  });
}

// Quest helper functions
function getAvailableQuestForNPC(player: Player, npcId: string): Quest | null {
  const npc = gameState.npcs.get(npcId);
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  // Find the next available quest in order
  for (const questId of npc.quests) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    // Skip if already completed
    if (player.completedQuests.includes(questId)) continue;

    // Skip if already active
    if (player.activeQuests[questId] !== undefined) continue;

    // Check level requirement
    if (player.level < quest.levelRequirement) continue;

    // Check prerequisite quests
    if (quest.prerequisiteQuests.some(prereq => !player.completedQuests.includes(prereq))) {
      continue;
    }

    return quest;
  }

  return null;
}

function getCompletedQuestForNPC(player: Player, npcId: string): Quest | null {
  // Check if player has any completed but unrewarded quests for this NPC
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    if (quest.turnInNPC === npcId && progress >= quest.amount) {
      return quest;
    }
  }

  return null;
}

function handleNPCQuestProgression(player: Player, npcId: string): { message: string; quest: Quest; action: 'complete' | 'activate' | 'show' | 'inventory_full' } | null {
  const npc = gameState.npcs.get(npcId);
  
  // Fix for players with activeQuests as array instead of object
  if (Array.isArray(player.activeQuests)) {
    player.activeQuests = {};
  }

  // First check if this NPC is a turnInNPC for any active quests that are ready to complete
  for (const [questId, progress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    // Check if this NPC is the turnInNPC for this quest
    if (quest.turnInNPC === npcId) {
      // For visit quests, complete immediately
      if (quest.type === 'visit') {
        return {
          message: quest.rewardDialogue,
          quest: quest,
          action: 'complete'
        };
      }
      
      // For kill quests, check if objective is complete via progress
      if (quest.type === 'kill' && progress >= quest.amount) {
        return {
          message: quest.rewardDialogue,
          quest: quest,
          action: 'complete'
        };
      }
      
      // For collect quests, check if player has required items in inventory
      if (quest.type === 'collect') {
        const itemCount = player.inventory.filter(item => item.id === quest.target).length;
        if (itemCount >= quest.amount) {
          // Check inventory space for reward items
          // For collect quests, account for space that will be freed when items are removed
          const rewardItemCount = quest.reward.items ? quest.reward.items.length : 0;
          if (rewardItemCount > 0) {
            const maxSlots = gameState.defaults.player.maxInventorySlots;
            const currentSlots = player.inventory.length;
            const slotsAfterRemoval = currentSlots - quest.amount; // Items will be removed first
            const availableSlots = maxSlots - slotsAfterRemoval;
            
            if (availableSlots < rewardItemCount) {
              return {
                message: `I can see you have the items I need, but you don't have enough space in your inventory for your reward! Please make room for ${rewardItemCount} item${rewardItemCount > 1 ? 's' : ''} and come back.`,
                quest: quest,
                action: 'inventory_full'
              };
            }
          }
          
          return {
            message: quest.rewardDialogue,
            quest: quest,
            action: 'complete'
          };
        }
      }
    }
  }

  // If no visit quest completion, proceed with normal quest progression for NPCs with quests
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  // Iterate through NPC quests in order to find current progression point
  for (let i = 0; i < npc.quests.length; i++) {
    const questId = npc.quests[i];
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    const isCompleted = player.completedQuests.includes(questId);
    const isActive = player.activeQuests[questId] !== undefined;

    if (isCompleted) {
      // This quest is completed, check if there's a next quest
      const nextQuestIndex = i + 1;
      if (nextQuestIndex < npc.quests.length) {
        const nextQuestId = npc.quests[nextQuestIndex];
        const nextQuest = gameState.quests.get(nextQuestId);
        if (!nextQuest) continue;

        const nextIsActive = player.activeQuests[nextQuestId] !== undefined;
        
        if (nextIsActive) {
          // Next quest is active - show quest dialogue
          return {
            message: nextQuest.questDialogue,
            quest: nextQuest,
            action: 'show'
          };
        } else {
          // Next quest is not active - check quest requirements and if met -> activate it
          if (player.level >= nextQuest.levelRequirement && 
              !nextQuest.prerequisiteQuests.some(prereq => !player.completedQuests.includes(prereq))) {
            return {
              message: nextQuest.questDialogue,
              quest: nextQuest,
              action: 'activate'
            };
          }
          // Requirements not met, show regular dialogue
          return null;
        }
      }
      // No more quests after this completed one
      continue;
    }

    if (isActive) {
      // Found the active quest - check if requirements are met (quest complete)
      const progress = player.activeQuests[questId] || 0;
      
      // Special handling for visit quests - complete immediately when talking to turnInNPC
      if (quest.type === 'visit' && quest.turnInNPC === npcId) {
        // Check inventory space for reward items (applies to ALL quest types)
        const rewardItemCount = quest.reward.items ? quest.reward.items.length : 0;
        if (rewardItemCount > 0) {
          const maxSlots = gameState.defaults.player.maxInventorySlots;
          const availableSlots = maxSlots - player.inventory.length;
          
          if (availableSlots < rewardItemCount) {
            return {
              message: `I have your reward ready, but you don't have enough space in your inventory! Please make room for ${rewardItemCount} item${rewardItemCount > 1 ? 's' : ''} and come back.`,
              quest: quest,
              action: 'inventory_full'
            };
          }
        }
        
        return {
          message: quest.rewardDialogue,
          quest: quest,
          action: 'complete'
        };
      }
      
      if (progress >= quest.amount) {
        // Check inventory space for reward items (applies to ALL quest types)
        const rewardItemCount = quest.reward.items ? quest.reward.items.length : 0;
        if (rewardItemCount > 0) {
          const maxSlots = gameState.defaults.player.maxInventorySlots;
          const availableSlots = maxSlots - player.inventory.length;
          
          if (availableSlots < rewardItemCount) {
            return {
              message: `I have your reward ready, but you don't have enough space in your inventory! Please make room for ${rewardItemCount} item${rewardItemCount > 1 ? 's' : ''} and come back.`,
              quest: quest,
              action: 'inventory_full'
            };
          }
        }
        
        // Requirements met and space available - give reward
        return {
          message: quest.rewardDialogue,
          quest: quest,
          action: 'complete'
        };
      } else {
        // Requirements not met - show quest dialogue
        return {
          message: quest.questDialogue,
          quest: quest,
          action: 'show'
        };
      }
    }

    // Quest is neither completed nor active - this is the first available quest
    // Check requirements and activate if met
    if (player.level >= quest.levelRequirement && 
        !quest.prerequisiteQuests.some(prereq => !player.completedQuests.includes(prereq))) {
      return {
        message: quest.questDialogue,
        quest: quest,
        action: 'activate'
      };
    }
    // Requirements not met, show regular dialogue
    return null;
  }

  return null; // No quests available, show regular dialogue
}

function checkForFollowUpQuest(player: Player, npcId: string, completedQuestId: string): Quest | null {
  const npc = gameState.npcs.get(npcId);
  if (!npc || !npc.quests || npc.quests.length === 0) return null;

  // Check all quests this NPC can give
  for (const questId of npc.quests) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    // Skip if already completed
    if (player.completedQuests.includes(questId)) continue;

    // Skip if already active
    if (player.activeQuests[questId] !== undefined) continue;

    // Check level requirement
    if (player.level < quest.levelRequirement) continue;

    // Check if the just-completed quest is a prerequisite for this quest
    if (quest.prerequisiteQuests.includes(completedQuestId)) {
      // Check if all other prerequisites are also met
      if (!quest.prerequisiteQuests.some(prereq => prereq !== completedQuestId && !player.completedQuests.includes(prereq))) {
        return quest;
      }
    }
  }

  return null;
}

function activateQuest(player: Player, quest: Quest): void {
  // For visit quests, set progress to 0 and they will be completed when talking to the NPC
  player.activeQuests[quest.id] = 0;
  savePlayer(player);
}

function completeQuest(player: Player, quest: Quest): void {
  // FIRST: For collect quests, remove the collected items from inventory
  // This must happen before adding reward items to clear space
  if (quest.type === 'collect') {
    let itemsToRemove = quest.amount;
    player.inventory = player.inventory.filter(item => {
      if (item.id === quest.target && itemsToRemove > 0) {
        itemsToRemove--;
        return false; // Remove this item
      }
      return true; // Keep this item
    });
  }
  
  // Remove from active quests
  delete player.activeQuests[quest.id];
  
  // Add to completed quests
  player.completedQuests.push(quest.id);
  
  // Give rewards - gold and experience
  player.gold += quest.reward.gold;
  player.experience += quest.reward.experience;
  
  // Check for level up (exponential progression with multiplier)
  const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
  const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
  const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
  let newLevel = player.level;
  
  // Keep checking if player has enough XP for next level
  while (newLevel < maxLevel) {
    let totalXPNeeded = 0;
    for (let i = 1; i <= newLevel; i++) {
      totalXPNeeded += Math.floor(baseXP * Math.pow(multiplier, i - 1));
    }
    if (player.experience >= totalXPNeeded) {
      newLevel++;
    } else {
      break;
    }
  }
  
  if (newLevel > player.level) {
    const levelsGained = newLevel - player.level;
    player.level = newLevel;
    player.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
    player.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
    player.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
    if (gameState.defaults.levelUp.fullHealOnLevelUp) {
      player.health = player.maxHealth;
    }
  }
  
  // Add quest reward items to inventory
  // Space was already checked before calling this function, so items should always fit
  if (quest.reward.items && quest.reward.items.length > 0) {
    quest.reward.items.forEach(itemId => {
      const item = gameState.items.get(itemId);
      if (item) {
        player.inventory.push({ ...item });
      }
    });
  }
  
  savePlayer(player);
}

function updateQuestProgress(player: Player, questType: string, target: string, playerName: string): void {
  // Check all active quests for matching type and target
  for (const [questId, currentProgress] of Object.entries(player.activeQuests)) {
    const quest = gameState.quests.get(questId);
    if (!quest) continue;

    // Check if this quest matches the action
    if (quest.type === questType && quest.target === target) {
      const newProgress = currentProgress + 1;
      player.activeQuests[questId] = newProgress;

      // Check if quest is completed
      if (newProgress >= quest.amount) {
        // Send completion message to player
        const npcName = gameState.npcs.get(quest.turnInNPC)?.name || quest.turnInNPC;
        sendToPlayer(playerName, { 
          type: 'message', 
          data: { text: `${quest.killCompleteMessage} Return to ${npcName} to claim your reward.`, type: 'system' } 
        });
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('message', (msg: ClientMessage) => {
    handleClientMessage(socket, msg);
  });
  
  socket.on('disconnect', () => {
    const username = activePlayers.get(socket.id);
    if (username) {
      const player = gameState.players.get(username);
      if (player) {
        // Use handleQuit logic but without the goodbye message and forced disconnect
        handlePlayerDisconnect(socket, player, false);
      }
      console.log('Player disconnected:', username);
    }
  });
});

function handleClientMessage(socket: any, msg: ClientMessage): void {
  switch (msg.type) {
    case 'register':
      handleRegister(socket, msg.data);
      break;
    case 'login':
      handleLogin(socket, msg.data);
      break;
    case 'command':
      handleCommand(socket, msg.data);
      break;
  }
}

function handleRegister(socket: any, data: { username: string; password: string }): void {
  const { username, password } = data;
  
  if (!password) {
    socket.emit('message', { type: 'error', data: 'Password required' });
    return;
  }
  
  if (password.length < 4) {
    socket.emit('message', { type: 'error', data: 'Password must be at least 4 characters long' });
    return;
  }
  
  // Sanitize the username
  const nameResult = sanitizePlayerName(username);
  if (!nameResult.isValid) {
    socket.emit('message', { type: 'error', data: nameResult.error });
    return;
  }
  
  const sanitizedName = nameResult.sanitized;
  
  if (playerExists(sanitizedName)) {
    socket.emit('message', { type: 'error', data: 'Username already exists' });
    return;
  }
  
  const player = createPlayer(sanitizedName, password, gameState.defaults);
  gameState.players.set(sanitizedName, player);
  activePlayers.set(socket.id, sanitizedName);
  
  socket.emit('message', { type: 'auth', data: { success: true, player } });
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${sanitizedName} has entered the realm.`, type: 'system' } 
  }, sanitizedName);
}

function handleLogin(socket: any, data: { username: string; password: string }): void {
  const { username, password } = data;
  
  if (!password) {
    socket.emit('message', { type: 'error', data: 'Password required' });
    return;
  }
  
  // Sanitize the username for login lookup
  const nameResult = sanitizePlayerName(username);
  if (!nameResult.isValid) {
    socket.emit('message', { type: 'error', data: 'Invalid username or password' });
    return;
  }
  
  const sanitizedName = nameResult.sanitized;
  const player = loadPlayer(sanitizedName);
  if (!player || !validatePassword(player, password)) {
    socket.emit('message', { type: 'error', data: 'Invalid username or password' });
    return;
  }
  
  // Check if player is already logged in from another session
  let existingSocketId: string | undefined;
  for (const [socketId, playerName] of activePlayers.entries()) {
    if (playerName === sanitizedName) {
      existingSocketId = socketId;
      break;
    }
  }
  
  // Disconnect the existing session if found
  if (existingSocketId) {
    const existingSocket = io.sockets.sockets.get(existingSocketId);
    if (existingSocket) {
      const existingPlayer = gameState.players.get(sanitizedName);
      if (existingPlayer) {
        // Clean disconnect of existing session
        handlePlayerDisconnect(existingSocket, existingPlayer, false);
      }
      
      existingSocket.emit('message', { 
        type: 'error', 
        data: 'You have been disconnected due to login from another location.' 
      });
      existingSocket.disconnect(true);
    }
  }

  // Update player data
  player.lastSeen = Date.now();
  gameState.players.set(sanitizedName, player);
  activePlayers.set(socket.id, sanitizedName);

  socket.emit('message', { type: 'auth', data: { success: true, player } });
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${sanitizedName} has returned.`, type: 'system' } 
  }, sanitizedName);
}

function handleCommand(socket: any, data: { command: string }): void {
  const username = activePlayers.get(socket.id);
  if (!username) {
    socket.emit('message', { type: 'error', data: 'Not authenticated' });
    return;
  }
  
  const player = gameState.players.get(username);
  if (!player) {
    socket.emit('message', { type: 'error', data: 'Player not found' });
    return;
  }
  
  const parts = data.command.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (cmd) {
    case 'look':
    case 'l':
      handleLook(socket, player);
      break;
    case 'map':
    case 'm':
      handleMap(socket, player);
      break;
    case 'say':
      handleSay(socket, player, args.join(' '));
      break;
    case 'whisper':
    case 'wis':
      handleWhisper(socket, player, args[0], args.slice(1).join(' '));
      break;
    case 'reply':
    case 'r':
      handleReply(socket, player, args.join(' '));
      break;
    case 'friends':
    case 'friend':
    case 'f':
      handleFriend(socket, player, args[0], args.slice(1).join(' '));
      break;
    case 'who':
      handleWho(socket);
      break;
    case 'inventory':
    case 'inv':
    case 'i':
      handleInventory(socket, player);
      break;
    case 'get':
    case 'take':
      if (args.length > 0) {
        handleGetItem(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'error', data: 'Get what?' });
      }
      break;
    case 'drop':
      if (args.length > 0) {
        handleDropItem(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'error', data: 'Drop what?' });
      }
      break;
    case 'help':
      handleHelp(socket);
      break;
    case 'attack':
    case 'strike':
    case 'hit':
      if (args.length > 0) {
        handleAttack(socket, player, args[0]);
      } else {
        socket.emit('message', { type: 'error', data: 'Attack what?' });
      }
      break;
    case 'flee':
    case 'run':
      handleFlee(socket, player);
      break;
    case 'quit':
    case 'logout':
      handleQuit(socket, player);
      break;
    case 'north':
    case 'n':
      handleMove(socket, player, 'north');
      break;
    case 'south':
    case 's':
      handleMove(socket, player, 'south');
      break;
    case 'east':
    case 'e':
      handleMove(socket, player, 'east');
      break;
    case 'west':
    case 'w':
      handleMove(socket, player, 'west');
      break;
    case 'up':
    case 'u':
      handleMove(socket, player, 'up');
      break;
    case 'down':
    case 'd':
      handleMove(socket, player, 'down');
      break;
    case 'northeast':
    case 'ne':
      handleMove(socket, player, 'northeast');
      break;
    case 'northwest':
    case 'nw':
      handleMove(socket, player, 'northwest');
      break;
    case 'southeast':
    case 'se':
      handleMove(socket, player, 'southeast');
      break;
    case 'southwest':
    case 'sw':
      handleMove(socket, player, 'southwest');
      break;
    case 'go':
      if (args.length > 0) {
        handleMove(socket, player, args[0]);
      } else {
        socket.emit('message', { type: 'system', data: 'Go where?' });
      }
      break;
    case 'homestone':
      if (args.length > 0 && args[0].toLowerCase() === 'bind') {
        handleHomestoneBind(socket, player);
      } else if (args.length > 0 && args[0].toLowerCase() === 'where') {
        handleHomestoneWhere(socket, player);
      } else if (args.length > 0 && args[0].toLowerCase() === 'recall') {
        handleHomestoneRecall(socket, player);
      } else {
        socket.emit('message', { type: 'info', data: 'Usage: homestone bind | homestone where | homestone recall' });
      }
      break;
    case 'talk':
    case 'speak':
      if (args.length > 0) {
        handleTalk(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Talk to whom?' });
      }
      break;
    case 'examine':
    case 'inspect':
    case 'lookat':
    case 'ex':
    case 'x':
    case 'consider':
    case 'con':
      if (args.length > 0) {
        handleExamine(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Examine what?' });
      }
      break;
    case 'buy':
      if (args.length > 0) {
        handleBuy(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Buy what?' });
      }
      break;
    case 'sell':
      if (args.length > 0) {
        handleSell(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Sell what?' });
      }
      break;
    case 'list':
    case 'shop':
      handleListShop(socket, player);
      break;
    case 'equip':
    case 'wear':
    case 'wield':
      if (args.length > 0) {
        handleEquip(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Equip what?' });
      }
      break;
    case 'unequip':
    case 'remove':
      if (args.length > 0) {
        handleUnequip(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Unequip what?' });
      }
      break;
    case 'use':
      if (args.length > 0) {
        handleUse(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Use what?' });
      }
      break;
    case 'trade':
      handleTrade(socket, player, args);
      break;
    default:
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Unknown command. Type "help" for available commands.', type: 'info' } 
      });
  }
}

function handleLook(socket: any, player: Player): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'system', data: 'Location not found' });
      return;
    }
    
    // Build location title with tags
    let locationTitle = location.name;
    if (location.homestone) {
      locationTitle += ' (Home)';
    }
    if (location.shop) {
      locationTitle += ' (Shop)';
    }
    if (location.pvpAllowed) {
      locationTitle += ' (PvP)';
    }
    let description = `=== ${locationTitle} ===\n${location.description}\n\n`;
    
    // Show NPCs and players
    const peopleHere: string[] = [];
    
    // Add NPCs first
    location.npcs.forEach(npcId => {
      const npc = gameState.npcs.get(npcId);
      if (npc) {
        peopleHere.push(npc.name);
      }
    });
    
    // Add other players - only check currently active players
    activePlayers.forEach((username, socketId) => {
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
    
    // Show ground items (predefined items)
    const visibleItems: string[] = [];
    
    if (location.groundItems && location.groundItems.length > 0) {
      location.groundItems.forEach(groundItem => {
        if (isGroundItemVisibleToPlayer(groundItem, player, player.location)) {
          const item = gameState.items.get(groundItem.itemId);
          if (item) {
            visibleItems.push(item.name);
          }
        }
      });
    }
    
    // Show dropped items
    if (location.droppedItems && location.droppedItems.length > 0) {
      location.droppedItems.forEach(groundItem => {
        const item = gameState.items.get(groundItem.itemId);
        if (item) {
          visibleItems.push(item.name);
        }
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
    
  } catch (error) {
    console.error('Error in handleLook:', error);
    socket.emit('message', { type: 'error', data: 'Error looking around' });
  }
}

function handleMap(socket: any, player: Player): void {
  try {
    const currentLoc = gameState.locations.get(player.location);
    if (!currentLoc) {
      socket.emit('message', { type: 'error', data: 'Current location not found' });
      return;
    }

    // Build coordinate grid using BFS from current location
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
    const maxDepth = 5; // Show up to 5 rooms in each direction
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

    // Find bounds (only z=0 level)
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    coords.forEach(coord => {
      if (coord.z === 0) {
        minX = Math.min(minX, coord.x);
        maxX = Math.max(maxX, coord.x);
        minY = Math.min(minY, coord.y);
        maxY = Math.max(maxY, coord.y);
      }
    });

    // Build reverse lookup and truncate names
    const coordToLoc = new Map<string, string>();
    const locToName = new Map<string, string>();
    coords.forEach((coord, locId) => {
      if (coord.z === 0) {
        const key = `${coord.x},${coord.y}`;
        coordToLoc.set(key, locId);
        const location = gameState.locations.get(locId)!;
        // Truncate to 11 characters
        const truncated = location.name.length > 11 
          ? location.name.substring(0, 11) 
          : location.name.padEnd(11, ' ');
        locToName.set(locId, truncated);
      }
    });

    let mapText = '\n=== Area Map ===\n\n';

    // Each cell is exactly 15 chars wide (brackets + 11 char name + 2 spaces)
    const cellWidth = 15;

    // Draw grid with connections - 3 passes per row
    for (let y = maxY; y >= minY; y--) {
      
      // Pass 1: North connections (draw lines going UP from this row)
      if (y < maxY) { // Don't draw north connections on the topmost row
        let northRow = '';
        for (let x = minX; x <= maxX; x++) {
          const key = `${x},${y}`;
          const locId = coordToLoc.get(key);

          if (locId) {
            const location = gameState.locations.get(locId)!;
            
            // Check north, northeast, northwest connections
            const northKey = `${x},${y + 1}`;
            const neKey = `${x + 1},${y + 1}`;
            const nwKey = `${x - 1},${y + 1}`;
            
            const hasNorth = location.exits.north && coordToLoc.get(northKey) === location.exits.north;
            const hasNE = location.exits.northeast && coordToLoc.get(neKey) === location.exits.northeast;
            const hasNW = location.exits.northwest && coordToLoc.get(nwKey) === location.exits.northwest;
            
            // Build connection string: NW at left edge, N in center, NE at right edge
            let connStr = '';
            connStr += hasNW ? '\\' : ' '; // Left diagonal (char 0)
            connStr += '     ';             // Padding (chars 1-5)
            connStr += hasNorth ? '|' : ' '; // Center (char 6)
            connStr += '     ';             // Padding (chars 7-11)
            connStr += hasNE ? '/' : ' ';   // Right diagonal (char 12)
            connStr += '  ';                // Spacing between cells (chars 13-14)
            
            northRow += connStr;
          } else {
            northRow += ' '.repeat(cellWidth);
          }
        }
        mapText += northRow + '\n';
      }

      // Pass 2: Location boxes with east connections
      let locationRow = '';
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const locId = coordToLoc.get(key);

        if (locId) {
          const location = gameState.locations.get(locId)!;
          const name = locToName.get(locId)!;
          
          // Check for east connection (draw AFTER the box)
          const eastKey = `${x + 1},${y}`;
          const hasEast = location.exits.east && coordToLoc.get(eastKey) === location.exits.east;
          
          // Draw the location box
          if (locId === player.location) {
            locationRow += `[    You    ]`;
          } else {
            locationRow += `[${name}]`;
          }
          
          // Draw east connection (or spacing)
          locationRow += hasEast ? '--' : '  ';
        } else {
          locationRow += ' '.repeat(cellWidth);
        }
      }
      mapText += locationRow + '\n';

      // Pass 3: South connections (draw lines going DOWN from this row)
      if (y > minY) { // Don't draw south connections on the bottommost row
        let southRow = '';
        for (let x = minX; x <= maxX; x++) {
          const key = `${x},${y}`;
          const locId = coordToLoc.get(key);

          if (locId) {
            const location = gameState.locations.get(locId)!;
            
            // Check south, southeast, southwest connections
            const southKey = `${x},${y - 1}`;
            const seKey = `${x + 1},${y - 1}`;
            const swKey = `${x - 1},${y - 1}`;
            
            const hasSouth = location.exits.south && coordToLoc.get(southKey) === location.exits.south;
            const hasSE = location.exits.southeast && coordToLoc.get(seKey) === location.exits.southeast;
            const hasSW = location.exits.southwest && coordToLoc.get(swKey) === location.exits.southwest;
            
            // Build connection string: SW at left edge, S in center, SE at right edge
            let connStr = '';
            connStr += hasSW ? '/' : ' ';   // Left diagonal - SW goes down-left: /
            connStr += '     ';             // Padding (chars 1-5)
            connStr += hasSouth ? '|' : ' '; // Center (char 6)
            connStr += '     ';             // Padding (chars 7-11)
            connStr += hasSE ? '\\' : ' ';   // Right diagonal - SE goes down-right: \
            connStr += '  ';                // Spacing between cells (chars 13-14)
            
            southRow += connStr;
          } else {
            southRow += ' '.repeat(cellWidth);
          }
        }
        mapText += southRow + '\n';
      }
    }

    mapText += '\n';

    socket.emit('message', { 
      type: 'message', 
      data: { text: mapText, type: 'info' } 
    });
    
  } catch (error) {
    console.error('Error in handleMap:', error);
    socket.emit('message', { type: 'error', data: 'Error generating map' });
  }
}

function handleSay(socket: any, player: Player, message: string): void {
  if (!message) {
    socket.emit('message', { type: 'system', data: 'Say what?' });
    return;
  }
  
  const text = `${player.username} says: ${message}`;
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text, type: 'chat' } 
  });
}

function handleWhisper(socket: any, player: Player, target: string, message: string): void {
  if (!target || !message) {
    socket.emit('message', { type: 'system', data: 'Whisper to whom what?' });
    return;
  }
  
  // Find player with case-insensitive comparison
  let targetPlayer = null;
  let actualPlayerName = null;
  for (const [playerName, playerData] of gameState.players.entries()) {
    if (playerName.toLowerCase() === target.toLowerCase()) {
      targetPlayer = playerData;
      actualPlayerName = playerName;
      break;
    }
  }
  
  if (!targetPlayer) {
    socket.emit('message', { type: 'system', data: 'Player not found' });
    return;
  }
  
  // Track last tell sender for reply command
  targetPlayer.lastWhisperFrom = player.username;
  savePlayer(targetPlayer);
  
  sendToPlayer(actualPlayerName!, { 
    type: 'message', 
    data: { text: `${player.username} whispers: ${message}`, type: 'whisper' } 
  });
  
  socket.emit('message', { 
    type: 'message', 
    data: { text: `You whisper to ${actualPlayerName}: ${message}`, type: 'whisper' } 
  });
}

function handleReply(socket: any, player: Player, message: string): void {
  if (!message) {
    socket.emit('message', { type: 'system', data: 'Reply with what?' });
    return;
  }

  if (!player.lastWhisperFrom) {
    socket.emit('message', { type: 'system', data: 'No one has whispered to you yet.' });
    return;
  }

  // Use handleWhisper to send the reply
  handleWhisper(socket, player, player.lastWhisperFrom, message);
}

function handleFriend(socket: any, player: Player, subcommand: string, target: string): void {
  // Initialize friends array if it doesn't exist (for existing players)
  if (!player.friends) {
    player.friends = [];
  }
  
  // No subcommand = list friends
  if (!subcommand) {
    if (player.friends.length === 0) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'You have no friends in your friend list.', type: 'info' } 
      });
      return;
    }
    
    // Build friend list with online status
    const onlineFriends: string[] = [];
    const offlineFriends: string[] = [];
    
    player.friends.forEach(friendName => {
      const isOnline = Array.from(activePlayers.values()).some(
        username => username.toLowerCase() === friendName.toLowerCase()
      );
      // Capitalize first letter for display
      const displayName = friendName.charAt(0).toUpperCase() + friendName.slice(1);
      if (isOnline) {
        onlineFriends.push(`- ${displayName} (Online)`);
      } else {
        offlineFriends.push(`- ${displayName} (Offline)`);
      }
    });
    
    // Online first, then offline
    const friendList = [...onlineFriends, ...offlineFriends].join('\n');
    socket.emit('message', { 
      type: 'message', 
      data: { text: `=== Friend List ===\n${friendList}`, type: 'info' } 
    });
    return;
  }
  
  // Handle subcommands
  switch (subcommand.toLowerCase()) {
    case 'add':
      if (!target) {
        socket.emit('message', { type: 'system', data: 'Add whom to your friend list?' });
        return;
      }
      
      // Check if player exists
      if (!playerExists(target)) {
        socket.emit('message', { type: 'system', data: 'Player not found.' });
        return;
      }
      
      // Can't add yourself
      if (target.toLowerCase() === player.username.toLowerCase()) {
        socket.emit('message', { type: 'system', data: 'You cannot add yourself as a friend.' });
        return;
      }
      
      // Check if already in friend list (case-insensitive)
      if (player.friends.some(f => f.toLowerCase() === target.toLowerCase())) {
        socket.emit('message', { type: 'system', data: `${target} is already in your friend list.` });
        return;
      }
      
      // Add friend
      player.friends.push(target);
      savePlayer(player);
      const displayNameAdd = target.charAt(0).toUpperCase() + target.slice(1);
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${displayNameAdd} has been added to your friend list.`, type: 'success' } 
      });
      
      // Notify the friend when beeing added, if they're online
      const playerDisplayName = player.username.charAt(0).toUpperCase() + player.username.slice(1);
      sendToPlayer(target, {
        type: 'message',
        data: { text: `${playerDisplayName} added you as a friend.`, type: 'system' }
      });
      break;
      
    case 'remove':
    case 'delete':
      if (!target) {
        socket.emit('message', { type: 'system', data: 'Remove whom from your friend list?' });
        return;
      }
      
      // Find and remove friend (case-insensitive)
      const friendIndex = player.friends.findIndex(f => f.toLowerCase() === target.toLowerCase());
      if (friendIndex === -1) {
        socket.emit('message', { type: 'system', data: `${target} is not in your friend list.` });
        return;
      }
      
      const removedFriend = player.friends[friendIndex];
      player.friends.splice(friendIndex, 1);
      savePlayer(player);
      const displayNameRemove = removedFriend.charAt(0).toUpperCase() + removedFriend.slice(1);
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${displayNameRemove} has been removed from your friend list.`, type: 'info' } 
      });
      break;
      
    default:
      socket.emit('message', { 
        type: 'system', 
        data: 'Usage: friend [add|remove] <playername> or just "friend" to list friends.' 
      });
  }
}

function handleTalk(socket: any, player: Player, npcName: string): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'system', data: 'Location not found' });
      return;
    }

    // Find NPC in current location by name (case-insensitive, partial match)
    let targetNPC = null;
    let targetNPCId = null;
    for (const npcId of location.npcs) {
      const npc = gameState.npcs.get(npcId);
      if (npc && npc.name.toLowerCase().includes(npcName.toLowerCase())) {
        targetNPC = npc;
        targetNPCId = npcId;
        break;
      }
    }

    if (!targetNPC || !targetNPCId) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `There is no one named "${npcName}" here to talk to.`, type: 'system' } 
      });
      return;
    }

    // Handle quest progression for this NPC
    const questResult = handleNPCQuestProgression(player, targetNPCId);
    if (questResult) {
      // Send the appropriate message
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${targetNPC.name} says: "${questResult.message}"`, type: 'dialogue' } 
      });

      // Handle quest state changes
      if (questResult.action === 'inventory_full') {
        // Don't complete quest - inventory is full
        // Message already sent above with NPC dialogue
        
      } else if (questResult.action === 'complete') {
        completeQuest(player, questResult.quest);
        
        // Show reward message
        let rewardMessage = `Quest completed: ${questResult.quest.name}!`;
        const rewards = [];
        
        if (questResult.quest.reward.gold > 0) {
          rewards.push(`${questResult.quest.reward.gold} gold`);
        }
        if (questResult.quest.reward.experience > 0) {
          rewards.push(`${questResult.quest.reward.experience} experience`);
        }
        
        // Add item rewards to message
        if (questResult.quest.reward.items && questResult.quest.reward.items.length > 0) {
          questResult.quest.reward.items.forEach(itemId => {
            const item = gameState.items.get(itemId);
            if (item) {
              rewards.push(`${item.name}`);
            }
          });
        }
        
        if (rewards.length > 0) {
          rewardMessage += ` You got ${rewards.join(', ')}!`;
        }

        socket.emit('message', { 
          type: 'message', 
          data: { text: rewardMessage, type: 'success' } 
        });
        
        // After completing a quest, check if this NPC has a follow-up quest that can now be activated
        const followUpQuest = checkForFollowUpQuest(player, targetNPCId, questResult.quest.id);
        if (followUpQuest) {
          activateQuest(player, followUpQuest);
          socket.emit('message', { 
            type: 'message', 
            data: { text: `${targetNPC.name} says: "${followUpQuest.questDialogue}"`, type: 'dialogue' } 
          });
        }
        
      } else if (questResult.action === 'activate') {
        activateQuest(player, questResult.quest);
      }

      // Broadcast to location
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
      }, player.username);

      return;
    }

    // No quest-related dialogue, use regular NPC dialogue
    if (!targetNPC.dialogue || targetNPC.dialogue.length === 0) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `${targetNPC.name} doesn't seem to have anything to say.`, type: 'system' } 
      });
      return;
    }

    const randomDialogue = targetNPC.dialogue[Math.floor(Math.random() * targetNPC.dialogue.length)];

    // Send dialogue to player
    socket.emit('message', { 
      type: 'message', 
      data: { text: `${targetNPC.name} says: "${randomDialogue}"`, type: 'dialogue' } 
    });

    // Check if this is a healer NPC and provide healing
    if (targetNPC.healer) {
      if (player.health < player.maxHealth) {
        const healingAmount = player.maxHealth - player.health;
        player.health = player.maxHealth;
        savePlayer(player);
        
        socket.emit('message', { 
          type: 'message', 
          data: { text: `${targetNPC.name} channels healing energy into you, restoring ${healingAmount} health!`, type: 'info' } 
        });
        
        // Broadcast healing to location
        sendToLocation(player.location, { 
          type: 'message', 
          data: { text: `${targetNPC.name} heals ${player.username} with magical energy.`, type: 'info' } 
        }, player.username);
      } else {
        socket.emit('message', { 
          type: 'message', 
          data: { text: `${targetNPC.name} nods approvingly. "You are already at full health, adventurer."`, type: 'info' } 
        });
        
        // Broadcast normal conversation
        sendToLocation(player.location, { 
          type: 'message', 
          data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
        }, player.username);
      }
    } else {
      // Broadcast to location that conversation is happening (non-healer NPCs)
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${player.username} talks with ${targetNPC.name}.`, type: 'system' } 
      }, player.username);
    }

  } catch (error) {
    console.error('Error in handleTalk:', error);
    socket.emit('message', { type: 'system', data: 'Failed to talk to NPC' });
  }
}

function handleWho(socket: any): void {
  const playerList = Array.from(gameState.players.keys()).join(', ');
  socket.emit('message', { 
    type: 'message', 
    data: { text: `=== Online Players ===\n${playerList}`, type: 'normal' } 
  });
}

function handleInventory(socket: any, player: Player): void {
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  
  // Calculate total damage and defense from base stats and equipment
  const equipped = player.equipment;
  const totalDamage = player.damage + (equipped.weapon?.stats?.damage || 0);
  const totalDefense = player.defense + (equipped.armor?.stats?.defense || 0) + (equipped.shield?.stats?.defense || 0);
  
  let text = `=== Character Status ===\n`;
  text += `Name: ${player.username}\n`;
  
  // Calculate XP for next level (exponential progression with multiplier)
  const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
  const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
  
  // Calculate total XP needed to reach NEXT level (cumulative display)
  let totalXPForNextLevel = 0;
  for (let i = 1; i <= player.level; i++) {
    totalXPForNextLevel += Math.floor(baseXP * Math.pow(multiplier, i - 1));
  }
  
  // Display current XP / total XP needed for next level
  text += `Level: ${player.level} (${player.experience}/${totalXPForNextLevel} XP)\n`;
  text += `Health: ${player.health}/${player.maxHealth}\n`;
  text += `Damage: ${totalDamage}\n`;
  text += `Defense: ${totalDefense}\n`;
  text += `PvP Record: ${player.pvpWins || 0}W - ${player.pvpLosses || 0}L\n\n`;
  
  // Show equipped items
  text += `=== Equipment ===\n`;
  if (equipped.weapon) {
    text += `Weapon: ${equipped.weapon.name}`;
    if (equipped.weapon.stats?.damage) text += ` (+${equipped.weapon.stats.damage} damage)`;
    text += `\n`;
  } else {
    text += `Weapon: None\n`;
  }
  
  if (equipped.armor) {
    text += `Armor: ${equipped.armor.name}`;
    if (equipped.armor.stats?.defense) text += ` (+${equipped.armor.stats.defense} defense)`;
    text += `\n`;
  } else {
    text += `Armor: None\n`;
  }
  
  if (equipped.shield) {
    text += `Shield: ${equipped.shield.name}`;
    if (equipped.shield.stats?.defense) text += ` (+${equipped.shield.stats.defense} defense)`;
    text += `\n`;
  } else {
    text += `Shield: None\n`;
  }
  
  text += `\n=== Inventory (${player.inventory.length}/${maxSlots}) ===\n`;
  text += `Gold: ${player.gold}\n`;
  if (player.inventory.length === 0) {
    text += 'Your inventory is empty.\n';
  } else {
    player.inventory.forEach((item, index) => {
      text += `${index + 1}. ${item.name}\n`;
    });
  }
  
  socket.emit('message', { type: 'message', data: { text, type: 'normal' } });
}

function handleGetItem(socket: any, player: Player, itemName: string): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'error', data: 'Location not found' });
      return;
    }

    const searchName = itemName.toLowerCase();
    
    // Find the item in ground items or dropped items
    let foundGroundItem: any | null = null;
    let foundItem: Item | null = null;
    let isDroppedItem = false;
    
    // First check predefined ground items
    if (location.groundItems) {
      for (const groundItem of location.groundItems) {
        const item = gameState.items.get(groundItem.itemId);
        if (item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)) {
          // Check if player can see this item (prerequisites and one-time)
          if (isGroundItemVisibleToPlayer(groundItem, player, player.location)) {
            foundGroundItem = groundItem;
            foundItem = item;
            break;
          }
        }
      }
    }
    
    // If not found, check dropped items
    if (!foundItem && location.droppedItems) {
      for (const groundItem of location.droppedItems) {
        const item = gameState.items.get(groundItem.itemId);
        if (item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)) {
          foundGroundItem = groundItem;
          foundItem = item;
          isDroppedItem = true;
          break;
        }
      }
    }

    if (!foundItem || !foundGroundItem) {
      socket.emit('message', { type: 'message', data: { text: `There is no ${itemName} here to take.`, type: 'system' } });
      return;
    }

    // Check inventory space
    const maxSlots = gameState.defaults.player.maxInventorySlots;
    if (player.inventory.length >= maxSlots) {
      socket.emit('message', { type: 'message', data: { text: 'Your inventory is full!', type: 'system' } });
      return;
    }

    // Add item to player inventory (create a copy)
    player.inventory.push({ ...foundItem });

    // Track one-time items
    if (foundGroundItem.oneTime) {
      const oneTimeKey = `${player.location}.${foundGroundItem.itemId}`;
      if (!player.oneTimeItemsPickedUp.includes(oneTimeKey)) {
        player.oneTimeItemsPickedUp.push(oneTimeKey);
      }
    }
    
    // Handle dropped items vs predefined ground items
    if (isDroppedItem) {
      // Dropped items - always remove from droppedItems list
      const itemIndex = location.droppedItems!.indexOf(foundGroundItem);
      if (itemIndex !== -1) {
        location.droppedItems!.splice(itemIndex, 1);
      }
    } else {
      // Predefined ground items - handle respawn or one-time
      if (foundGroundItem.respawnTime && !foundGroundItem.oneTime) {
        // Set lastPickedUp timestamp for respawn tracking
        foundGroundItem.lastPickedUp = Date.now();
        
        // Schedule respawn announcement
        setTimeout(() => {
          // Check if item still has lastPickedUp set (wasn't picked up again)
          if (foundGroundItem.lastPickedUp) {
            const timeSincePickup = Date.now() - foundGroundItem.lastPickedUp;
            // Only announce if enough time has passed (item respawned)
            if (timeSincePickup >= foundGroundItem.respawnTime!) {
              sendToLocation(player.location, {
                type: 'message',
                data: { text: `${foundItem.name} appears on the ground.`, type: 'system' }
              });
            }
          }
        }, foundGroundItem.respawnTime);
      }
      // Note: one-time and non-respawnable predefined items stay in list but become invisible
    }

    // Save player
    savePlayer(player);

    // Notify player
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You pick up ${foundItem.name}.`, type: 'success' } 
    });

    // Notify others in the room
    sendToLocation(player.location, {
      type: 'message',
      data: { text: `${player.username} picks up ${foundItem.name}.`, type: 'system' }
    }, player.username);

    // Update quest progress for collect quests
    updateQuestProgress(player, 'collect', foundItem.id, player.username);

  } catch (error) {
    console.error('Error in handleGetItem:', error);
    socket.emit('message', { type: 'error', data: 'Error picking up item' });
  }
}

function handleDropItem(socket: any, player: Player, itemName: string): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'error', data: 'Location not found' });
      return;
    }

    // Find the item in player's inventory
    const searchName = itemName.toLowerCase();
    const itemIndex = player.inventory.findIndex(item => 
      item.name.toLowerCase().includes(searchName) || 
      item.id.toLowerCase() === searchName
    );

    if (itemIndex === -1) {
      socket.emit('message', { type: 'error', data: `You don't have "${itemName}".` });
      return;
    }

    const itemToDrop = player.inventory[itemIndex];

    // Initialize droppedItems array if it doesn't exist
    if (!location.droppedItems) {
      location.droppedItems = [];
    }

    // Clean up expired dropped items first
    cleanupExpiredDroppedItems(location);

    const maxDropped = gameState.defaults.droppedItems?.maxDroppedItemsPerLocation || 10;

    // If we're at max capacity, remove the oldest dropped item
    if (location.droppedItems.length >= maxDropped) {
      const oldestDropped = location.droppedItems.reduce((oldest, item) => 
        (item.droppedAt! < oldest.droppedAt!) ? item : oldest
      );
      const oldestIndex = location.droppedItems.indexOf(oldestDropped);
      if (oldestIndex !== -1) {
        const removedItem = gameState.items.get(oldestDropped.itemId);
        location.droppedItems.splice(oldestIndex, 1);
        sendToLocation(player.location, {
          type: 'message',
          data: { text: `${removedItem?.name || 'An item'} crumbles to dust.`, type: 'system' }
        });
      }
    }

    // Add the item to dropped items with droppedAt timestamp
    const groundItem: GroundItem = {
      itemId: itemToDrop.id,
      droppedAt: Date.now()
    };
    location.droppedItems.push(groundItem);

    // Remove from player inventory
    player.inventory.splice(itemIndex, 1);
    savePlayer(player);

    // Schedule automatic cleanup after lifetime expires
    const lifetime = gameState.defaults.droppedItems?.droppedItemLifetimeMs || 300000;
    setTimeout(() => {
      const itemStillExists = location.droppedItems?.findIndex(gi => gi === groundItem);
      if (itemStillExists !== undefined && itemStillExists !== -1) {
        location.droppedItems?.splice(itemStillExists, 1);
        sendToLocation(player.location, {
          type: 'message',
          data: { text: `${itemToDrop.name} crumbles to dust.`, type: 'system' }
        });
      }
    }, lifetime);

    // Notify player
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You drop ${itemToDrop.name}.`, type: 'success' } 
    });

    // Notify others in the room
    sendToLocation(player.location, {
      type: 'message',
      data: { text: `${player.username} drops ${itemToDrop.name}.`, type: 'system' }
    }, player.username);

  } catch (error) {
    console.error('Error in handleDropItem:', error);
    socket.emit('message', { type: 'error', data: 'Error dropping item' });
  }
}

function cleanupExpiredDroppedItems(location: Location): void {
  if (!location.droppedItems) return;

  const lifetime = gameState.defaults.droppedItems?.droppedItemLifetimeMs || 300000;
  const now = Date.now();

  // Remove expired dropped items
  location.droppedItems = location.droppedItems.filter(gi => {
    return (now - gi.droppedAt!) < lifetime;
  });
}

function handleExamine(socket: any, player: Player, itemName: string): void {
  if (!itemName) {
    socket.emit('message', { type: 'error', data: 'Examine what?' });
    return;
  }

  const searchName = itemName.toLowerCase();
  
  // First check for other players in the same location
  const otherPlayer = Array.from(gameState.players.values()).find(p => 
    p.username.toLowerCase().includes(searchName) && 
    p.location === player.location &&
    p.username !== player.username
  );
  
  if (otherPlayer) {
    // Calculate examining player's total power
    let myDamage = player.damage;
    let myDefense = player.defense;
    
    if (player.equipment.weapon) {
      myDamage += player.equipment.weapon.stats?.damage || 0;
    }
    if (player.equipment.armor) {
      myDefense += player.equipment.armor.stats?.defense || 0;
    }
    if (player.equipment.shield) {
      myDefense += player.equipment.shield.stats?.defense || 0;
    }
    
    const myPower = player.health + myDamage + myDefense;
    
    // Calculate other player's total power
    let theirDamage = otherPlayer.damage;
    let theirDefense = otherPlayer.defense;
    
    if (otherPlayer.equipment.weapon) {
      theirDamage += otherPlayer.equipment.weapon.stats?.damage || 0;
    }
    if (otherPlayer.equipment.armor) {
      theirDefense += otherPlayer.equipment.armor.stats?.defense || 0;
    }
    if (otherPlayer.equipment.shield) {
      theirDefense += otherPlayer.equipment.shield.stats?.defense || 0;
    }
    
    const theirPower = otherPlayer.health + theirDamage + theirDefense;
    
    // Calculate difference
    const powerDiff = myPower - theirPower;
    
    // Determine difficulty rating
    let difficulty: string;
    if (powerDiff > 50) {
      difficulty = 'trivial';
    } else if (powerDiff > 25) {
      difficulty = 'easy';
    } else if (powerDiff > 0) {
      difficulty = 'moderate';
    } else if (powerDiff > -25) {
      difficulty = 'challenging';
    } else if (powerDiff > -50) {
      difficulty = 'hard';
    } else if (powerDiff > -100) {
      difficulty = 'deadly';
    } else {
      difficulty = 'impossible';
    }
    
    // Build player info display
    let text = `You examine ${otherPlayer.username}...\n\n`;
    text += `Level ${otherPlayer.level} adventurer\n`;
    text += `PvP Record: ${otherPlayer.pvpWins || 0}W - ${otherPlayer.pvpLosses || 0}L\n\n`;
    
    // Show equipped items
    text += `Equipment:\n`;
    if (otherPlayer.equipment.weapon) {
      text += `  Weapon: ${otherPlayer.equipment.weapon.name}\n`;
    }
    if (otherPlayer.equipment.armor) {
      text += `  Armor: ${otherPlayer.equipment.armor.name}\n`;
    }
    if (otherPlayer.equipment.shield) {
      text += `  Shield: ${otherPlayer.equipment.shield.name}\n`;
    }
    if (!otherPlayer.equipment.weapon && !otherPlayer.equipment.armor && !otherPlayer.equipment.shield) {
      text += `  None\n`;
    }
    
    text += `\nThis opponent appears to be ${difficulty}.`;
    
    socket.emit('message', { type: 'message', data: { text, type: 'info' } });
    return;
  }
  
  // Check for enemies in the current location
  const location = gameState.locations.get(player.location);
  if (location) {
    const enemy = location.enemies.find(e => 
      e.name.toLowerCase().includes(searchName) && 
      e.health > 0 &&
      isEnemyVisibleToPlayer(e, player, player.location)
    );
    
    if (enemy) {
      // Calculate player total power (HP + damage + defense)
      const playerPower = player.health + player.damage + player.defense;
      
      // Add equipment bonuses
      let playerDamage = player.damage;
      let playerDefense = player.defense;
      
      if (player.equipment.weapon) {
        playerDamage += player.equipment.weapon.stats?.damage || 0;
      }
      if (player.equipment.armor) {
        playerDefense += player.equipment.armor.stats?.defense || 0;
      }
      if (player.equipment.shield) {
        playerDefense += player.equipment.shield.stats?.defense || 0;
      }
      
      const playerTotalPower = player.health + playerDamage + playerDefense;
      
      // Calculate enemy total power (HP + damage + defense)
      const enemyPower = enemy.health + enemy.damage + enemy.defense;
      
      // Calculate difference
      const powerDiff = playerTotalPower - enemyPower;
      
      // Determine difficulty rating
      let difficulty: string;
      if (powerDiff > 50) {
        difficulty = 'trivial';
      } else if (powerDiff > 25) {
        difficulty = 'easy';
      } else if (powerDiff > 0) {
        difficulty = 'moderate';
      } else if (powerDiff > -25) {
        difficulty = 'challenging';
      } else if (powerDiff > -50) {
        difficulty = 'hard';
      } else if (powerDiff > -100) {
        difficulty = 'deadly';
      } else {
        difficulty = 'impossible';
      }
      
      const text = `You consider ${enemy.name}... this enemy appears to be ${difficulty}.`;
      
      socket.emit('message', { type: 'message', data: { text, type: 'info' } });
      return;
    }
  }
  
  // Check inventory
  const inventoryItem = player.inventory.find(item => 
    item.name.toLowerCase().includes(searchName) || 
    item.id.toLowerCase() === searchName
  );
  
  if (inventoryItem) {
    let text = `=== ${inventoryItem.name} ===\n`;
    text += `${inventoryItem.description}\n\n`;
    text += `Type: ${inventoryItem.type}\n`;
    text += `Value: ${inventoryItem.value} gold\n`;
    
    if (inventoryItem.stats) {
      text += `\nStats:\n`;
      if (inventoryItem.stats.damage) {
        text += `  Damage: ${inventoryItem.stats.damage}\n`;
      }
      if (inventoryItem.stats.defense) {
        text += `  Defense: ${inventoryItem.stats.defense}\n`;
      }
      if (inventoryItem.stats.health) {
        text += `  Health: ${inventoryItem.stats.health}\n`;
      }
    }
    
    socket.emit('message', { type: 'message', data: { text, type: 'normal' } });
    return;
  }
  
  // Check equipped items
  const equipped = player.equipment;
  const equippedItems = [equipped.weapon, equipped.shield, equipped.armor].filter(Boolean);
  
  const equippedItem = equippedItems.find(item => 
    item && (item.name.toLowerCase().includes(searchName) || item.id.toLowerCase() === searchName)
  );
  
  if (equippedItem) {
    let text = `=== ${equippedItem.name} (equipped) ===\n`;
    text += `${equippedItem.description}\n\n`;
    text += `Type: ${equippedItem.type}\n`;
    text += `Value: ${equippedItem.value} gold\n`;
    
    if (equippedItem.stats) {
      text += `\nStats:\n`;
      if (equippedItem.stats.damage) {
        text += `  Damage: ${equippedItem.stats.damage}\n`;
      }
      if (equippedItem.stats.defense) {
        text += `  Defense: ${equippedItem.stats.defense}\n`;
      }
      if (equippedItem.stats.health) {
        text += `  Health: ${equippedItem.stats.health}\n`;
      }
    }
    
    socket.emit('message', { type: 'message', data: { text, type: 'normal' } });
    return;
  }
  
  socket.emit('message', { 
    type: 'message', 
    data: { text: `You don't see '${itemName}' here.`, type: 'system' } 
  });
}

function handleListShop(socket: any, player: Player): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return;
  }

  // Check if location has a shop
  if (!location.shop) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'There is no shop here.', type: 'system' } 
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'There is no shop here.', type: 'system' } 
    });
    return;
  }

  let text = `=== ${shop.name} ===\n`;
  text += `Available Items:\n`;
  
  shop.items.forEach(itemId => {
    const item = gameState.items.get(itemId);
    if (item) {
      const buyPrice = Math.ceil(item.value * shop.margin);
      text += `- ${item.name}: ${buyPrice}g`;
      
      if (item.stats) {
        const stats = [];
        if (item.stats.damage) stats.push(`Dmg: ${item.stats.damage}`);
        if (item.stats.defense) stats.push(`Def: ${item.stats.defense}`);
        if (item.stats.health) stats.push(`HP: ${item.stats.health}`);
        if (stats.length > 0) {
          text += ` (${stats.join(', ')})`;
        }
      }
      text += `\n`;
    }
  });
  
  socket.emit('message', { 
    type: 'message', 
    data: { text, type: 'info' } 
  });
}

function handleBuy(socket: any, player: Player, itemName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return;
  }

  // Check if location has a shop
  if (!location.shop) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'There is no shop here.', type: 'system' } 
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', { type: 'system', data: 'Shop not found' });
    return;
  }

  // Find item in shop (exact match only, case-insensitive)
  const searchName = itemName.toLowerCase();
  let itemToBuy: Item | null = null;
  
  for (const itemId of shop.items) {
    const item = gameState.items.get(itemId);
    if (item && (item.name.toLowerCase() === searchName || item.id.toLowerCase() === searchName)) {
      itemToBuy = item;
      break;
    }
  }

  if (!itemToBuy) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `The shop doesn't sell '${itemName}'.`, type: 'system' } 
    });
    return;
  }

  // Check inventory space
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'Your inventory is full!', type: 'error' } 
    });
    return;
  }

  // Calculate buy price
  const buyPrice = Math.ceil(itemToBuy.value * shop.margin);

  // Check if player has enough gold
  if (player.gold < buyPrice) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You need ${buyPrice} gold to buy ${itemToBuy.name}. You only have ${player.gold} gold.`, type: 'error' } 
    });
    return;
  }

  // Purchase item
  player.gold -= buyPrice;
  player.inventory.push({ ...itemToBuy });
  savePlayer(player);

  socket.emit('message', { 
    type: 'message', 
    data: { text: `You bought ${itemToBuy.name} for ${buyPrice} gold.`, type: 'success' } 
  });

  // Broadcast to location
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${player.username} buys something from the shop.`, type: 'system' } 
  }, player.username);
}

function handleSell(socket: any, player: Player, itemName: string): void {
  const location = gameState.locations.get(player.location);
  if (!location) {
    socket.emit('message', { type: 'system', data: 'Location not found' });
    return;
  }

  // Check if location has a shop
  if (!location.shop) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'There is no shop here.', type: 'system' } 
    });
    return;
  }

  const shop = gameState.shops.get(location.shop);
  if (!shop) {
    socket.emit('message', { type: 'system', data: 'Shop not found' });
    return;
  }

  // Find item in player's inventory (exact match only, case-insensitive)
  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase() === searchName || item.id.toLowerCase() === searchName
  );

  if (itemIndex === -1) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You don't have '${itemName}' in your inventory.`, type: 'system' } 
    });
    return;
  }

  const itemToSell = player.inventory[itemIndex];
  const sellPrice = itemToSell.value;

  // Remove item from inventory
  player.inventory.splice(itemIndex, 1);
  player.gold += sellPrice;
  savePlayer(player);

  socket.emit('message', { 
    type: 'message', 
    data: { text: `You sold ${itemToSell.name} for ${sellPrice} gold.`, type: 'success' } 
  });

  // Broadcast to location
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${player.username} sells something to the shop.`, type: 'system' } 
  }, player.username);
}

function handleEquip(socket: any, player: Player, itemName: string): void {
  // Find item in inventory (partial match, case-insensitive)
  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase().includes(searchName)
  );

  if (itemIndex === -1) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You don't have '${itemName}' in your inventory.`, type: 'system' } 
    });
    return;
  }

  const item = player.inventory[itemIndex];

  // Check if item is equippable
  if (item.type !== 'weapon' && item.type !== 'shield' && item.type !== 'armor') {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You can't equip ${item.name}.`, type: 'system' } 
    });
    return;
  }

  // Check if slot is occupied and unequip first
  const slot = item.type as keyof Equipment;
  if (player.equipment[slot]) {
    const oldItem = player.equipment[slot]!;
    player.inventory.push(oldItem);
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You unequip ${oldItem.name}.`, type: 'info' } 
    });
  }

  // Equip the item
  player.equipment[slot] = item;
  player.inventory.splice(itemIndex, 1);
  savePlayer(player);

  socket.emit('message', { 
    type: 'message', 
    data: { text: `You equip ${item.name}.`, type: 'success' } 
  });

  // Broadcast to location
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${player.username} equips ${item.name}.`, type: 'system' } 
  }, player.username);
}

function handleUnequip(socket: any, player: Player, itemName: string): void {
  // Find equipped item (partial match, case-insensitive)
  const searchName = itemName.toLowerCase();
  let itemToUnequip: Item | null = null;
  let slot: keyof Equipment | null = null;

  // Check each equipment slot
  for (const [slotName, equippedItem] of Object.entries(player.equipment)) {
    if (equippedItem && 
        (equippedItem.name.toLowerCase().includes(searchName) || equippedItem.id.toLowerCase().includes(searchName))) {
      itemToUnequip = equippedItem;
      slot = slotName as keyof Equipment;
      break;
    }
  }

  if (!itemToUnequip || !slot) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You don't have '${itemName}' equipped.`, type: 'system' } 
    });
    return;
  }

  // Check inventory space
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  if (player.inventory.length >= maxSlots) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'Your inventory is full!', type: 'error' } 
    });
    return;
  }

  // Unequip the item
  player.equipment[slot] = undefined;
  player.inventory.push(itemToUnequip);
  savePlayer(player);

  socket.emit('message', { 
    type: 'message', 
    data: { text: `You unequip ${itemToUnequip.name}.`, type: 'success' } 
  });

  // Broadcast to location
  sendToLocation(player.location, { 
    type: 'message', 
    data: { text: `${player.username} unequips ${itemToUnequip.name}.`, type: 'system' } 
  }, player.username);
}

function handleUse(socket: any, player: Player, itemName: string): void {
  // Find item in inventory (partial match, case-insensitive)
  const searchName = itemName.toLowerCase();
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase().includes(searchName)
  );

  if (itemIndex === -1) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You don't have '${itemName}' in your inventory.`, type: 'system' } 
    });
    return;
  }

  const item = player.inventory[itemIndex];

  // Check if item is consumable
  if (item.type !== 'consumable') {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You can't use ${item.name}.`, type: 'system' } 
    });
    return;
  }

  // Check if item has an effect
  if (!item.effect) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `${item.name} has no effect.`, type: 'system' } 
    });
    return;
  }

  // Check global cooldown
  const cooldownMs = gameState.defaults.items.useCooldownMs;
  const timeSinceLastUse = Date.now() - (player.lastItemUse || 0);
  
  if (timeSinceLastUse < cooldownMs) {
    const remainingMs = cooldownMs - timeSinceLastUse;
    const remainingSec = (remainingMs / 1000).toFixed(1);
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You must wait ${remainingSec} seconds before using another item.`, type: 'system' } 
    });
    return;
  }

  // Check if player is in combat
  const isInCombat = isPlayerInCombat(player);

  // Check usage context
  if (item.effect.usableIn === 'combat' && !isInCombat) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You can only use ${item.name} during combat.`, type: 'system' } 
    });
    return;
  }

  if (item.effect.usableIn === 'non-combat' && isInCombat) {
    socket.emit('message', { 
      type: 'message',
      data: { text: `You can't use ${item.name} during combat.`, type: 'system' }
    });
    return;
  }

  // Apply effect based on type
  let effectMessage = '';
  
  switch (item.effect.type) {
    case 'heal':
      // Check if already at full health
      if (player.health >= player.maxHealth) {
        socket.emit('message', { 
          type: 'message', 
          data: { text: `You are already at full health.`, type: 'system' } 
        });
        return;
      }
      
      const healAmount = item.effect.amount || 0;
      const actualHeal = Math.min(healAmount, player.maxHealth - player.health);
      player.health = Math.min(player.maxHealth, player.health + healAmount);
      effectMessage = `You use ${item.name} and restore ${actualHeal} health.`;
      break;

    case 'damage':
      if (!isInCombat) {
        socket.emit('message', { 
          type: 'message', 
          data: { text: `You can only use ${item.name} during combat.`, type: 'system' } 
        });
        return;
      }
      // Find enemy player is fighting
      const enemyFighting = findEnemyPlayerIsFighting(player);
      if (!enemyFighting) {
        socket.emit('message', { 
          type: 'message', 
          data: { text: `You're not fighting anyone.`, type: 'error' } 
        });
        return;
      }
      const damageAmount = item.effect.amount || 0;
      enemyFighting.health = Math.max(0, enemyFighting.health - damageAmount);
      effectMessage = `You use ${item.name} and deal ${damageAmount} damage to ${enemyFighting.name}!`;
      
      // Check if enemy died
      if (enemyFighting.health <= 0) {
        handleEnemyDeath(socket, player, enemyFighting);
      }
      break;

    case 'teleport':
      const targetLocation = item.effect.location;
      if (!targetLocation) {
        socket.emit('message', { type: 'error', data: 'Invalid teleport location' });
        return;
      }
      
      const destination = gameState.locations.get(targetLocation);
      if (!destination) {
        socket.emit('message', { type: 'error', data: 'Teleport location not found' });
        return;
      }

      // Teleport player
      const oldLocation = player.location;
      player.location = targetLocation;
      
      sendToLocation(oldLocation, { 
        type: 'message', 
        data: { text: `${player.username} disappears in a flash of light!`, type: 'system' } 
      }, player.username);
      
      effectMessage = `You use ${item.name} and teleport to ${destination.name}!`;
      
      sendToLocation(targetLocation, { 
        type: 'message', 
        data: { text: `${player.username} appears in a flash of light!`, type: 'system' } 
      }, player.username);
      break;
  }

  // Remove item from inventory (consumed)
  player.inventory.splice(itemIndex, 1);
  
  // Update last item use timestamp for cooldown
  player.lastItemUse = Date.now();
  savePlayer(player);

  socket.emit('message', { 
    type: 'message', 
    data: { text: effectMessage, type: 'success' } 
  });

  // Show new location if teleported
  if (item.effect.type === 'teleport') {
    handleLook(socket, player);
  }
}

function handleTrade(socket: any, player: Player, args: string[]): void {
  if (args.length === 0) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'Usage: trade <start|add|remove|ready|cancel|status> <player/item>', type: 'info' } 
    });
    return;
  }

  const subcommand = args[0].toLowerCase();

  switch (subcommand) {
    case 'start':
      handleTradeStart(socket, player, args[1]);
      break;
    case 'accept':
      handleTradeAccept(socket, player);
      break;
    case 'add':
      handleTradeAdd(socket, player, args.slice(1));
      break;
    case 'remove':
      handleTradeRemove(socket, player, args.slice(1));
      break;
    case 'ready':
      handleTradeReady(socket, player);
      break;
    case 'cancel':
      handleTradeCancel(socket, player);
      break;
    case 'status':
      handleTradeStatus(socket, player);
      break;
    default:
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Unknown trade command. Use: start, accept, add, remove, ready, cancel, or status', type: 'info' } 
      });
  }
}

function handleTradeStart(socket: any, player: Player, targetName: string): void {
  if (!targetName) {
    socket.emit('message', { type: 'system', data: 'Trade with whom?' });
    return;
  }

  // Check if player already has active trade
  if (player.activeTrade) {
    const tradePartner = player.activeTrade.with || 'someone';
    socket.emit('message', { type: 'error', data: `You're already trading with ${tradePartner}.` });
    return;
  }

  // Find target player (case-insensitive)
  let targetPlayer: Player | null = null;
  let actualTargetName: string | null = null;
  
  for (const [playerName, playerData] of gameState.players.entries()) {
    if (playerName.toLowerCase() === targetName.toLowerCase()) {
      targetPlayer = playerData;
      actualTargetName = playerName;
      break;
    }
  }

  if (!targetPlayer || !actualTargetName) {
    socket.emit('message', { type: 'system', data: 'Player not found.' });
    return;
  }

  // Check if target is online
  const isOnline = Array.from(activePlayers.values()).some(
    username => username.toLowerCase() === actualTargetName!.toLowerCase()
  );

  if (!isOnline) {
    socket.emit('message', { type: 'system', data: `${actualTargetName} is not online.` });
    return;
  }

  // Can't trade with yourself
  if (player.username.toLowerCase() === actualTargetName.toLowerCase()) {
    socket.emit('message', { type: 'error', data: 'You cannot trade with yourself.' });
    return;
  }

  // Check if both players are in the same location
  if (player.location !== targetPlayer.location) {
    socket.emit('message', { type: 'error', data: `${actualTargetName} is not in the same location as you.` });
    return;
  }

  // Check if target already has active trade
  if (targetPlayer.activeTrade) {
    socket.emit('message', { type: 'error', data: `${actualTargetName} is already in a trade.` });
    return;
  }

  // Create pending trade request for target player
  const timestamp = Date.now();
  
  targetPlayer.activeTrade = {
    with: player.username,
    myItems: [],
    myGold: 0,
    theirItems: [],
    theirGold: 0,
    myReady: false,
    theirReady: false,
    initiatedBy: player.username,
    timestamp,
    pending: true
  };

  socket.emit('message', { 
    type: 'message', 
    data: { text: `Trade request sent to ${actualTargetName}. Waiting for acceptance...`, type: 'success' } 
  });

  sendToPlayer(actualTargetName, { 
    type: 'message', 
    data: { text: `${player.username} wants to trade with you! Use 'trade accept' to accept or 'trade cancel' to decline.`, type: 'system' } 
  });
}

function handleTradeAccept(socket: any, player: Player): void {
  if (!player.activeTrade) {
    socket.emit('message', { type: 'error', data: 'You have no pending trade request.' });
    return;
  }

  if (!player.activeTrade.pending) {
    socket.emit('message', { type: 'error', data: 'Trade already active.' });
    return;
  }

  const trade = player.activeTrade;
  const initiator = gameState.players.get(trade.with);

  if (!initiator) {
    socket.emit('message', { type: 'error', data: 'Trade initiator is no longer available.' });
    player.activeTrade = undefined;
    return;
  }

  // Check if initiator is still online
  const isOnline = Array.from(activePlayers.values()).some(
    username => username.toLowerCase() === trade.with.toLowerCase()
  );

  if (!isOnline) {
    socket.emit('message', { type: 'error', data: `${trade.with} is no longer online.` });
    player.activeTrade = undefined;
    return;
  }

  // Accept trade - remove pending flag from target and create trade for initiator
  player.activeTrade.pending = false;

  initiator.activeTrade = {
    with: player.username,
    myItems: [],
    myGold: 0,
    theirItems: [],
    theirGold: 0,
    myReady: false,
    theirReady: false,
    initiatedBy: trade.initiatedBy,
    timestamp: trade.timestamp
  };

  socket.emit('message', { 
    type: 'message', 
    data: { text: `Trade accepted with ${trade.with}. Use 'trade add' to add items or gold.`, type: 'success' } 
  });

  sendToPlayer(trade.with, { 
    type: 'message', 
    data: { text: `${player.username} accepted your trade request!`, type: 'success' } 
  });

  // Show initial empty trade window to both players
  handleTradeStatus(socket, player);
  
  // Send status to initiator using sendToPlayer
  const initiatorSocketId = Array.from(activePlayers.entries()).find(
    ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
  )?.[0];
  
  if (initiatorSocketId) {
    const initiatorSocket = io.sockets.sockets.get(initiatorSocketId);
    if (initiatorSocket) {
      handleTradeStatus(initiatorSocket, initiator);
    }
  }
}

function handleTradeAdd(socket: any, player: Player, args: string[]): void {
  if (!player.activeTrade) {
    socket.emit('message', { type: 'error', data: 'You are not in a trade. Use "trade start <player>" first.' });
    return;
  }

  if (player.activeTrade.pending) {
    socket.emit('message', { type: 'error', data: 'Use "trade accept" to accept the trade request first.' });
    return;
  }

  if (args.length === 0) {
    socket.emit('message', { type: 'system', data: 'Add what? Specify item name or "<amount> gold"' });
    return;
  }

  const trade = player.activeTrade;
  
  // Reset ready status when adding items - both players must ready up again
  trade.myReady = false;
  trade.theirReady = false;
  const partner = gameState.players.get(trade.with);
  if (partner && partner.activeTrade) {
    partner.activeTrade.myReady = false;
    partner.activeTrade.theirReady = false;
  }

  // Check if adding gold
  if (args[args.length - 1].toLowerCase() === 'gold') {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      socket.emit('message', { type: 'error', data: 'Invalid gold amount.' });
      return;
    }

    if (player.gold < amount) {
      socket.emit('message', { type: 'error', data: `You only have ${player.gold} gold.` });
      return;
    }

    trade.myGold += amount;
    player.gold -= amount; // Remove from player immediately

    // Update partner's view and show their trade window
    if (partner && partner.activeTrade) {
      partner.activeTrade.theirGold = trade.myGold;
      
      // Find partner's socket and show them the updated trade window
      const partnerSocketId = Array.from(activePlayers.entries()).find(
        ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
      )?.[0];
      
      if (partnerSocketId) {
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        if (partnerSocket) {
          handleTradeStatus(partnerSocket, partner);
        }
      }
    }

    handleTradeStatus(socket, player);
    return;
  }

  // Adding item
  const itemName = args.join(' ');
  const searchName = itemName.toLowerCase();
  
  const itemIndex = player.inventory.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase().includes(searchName)
  );

  if (itemIndex === -1) {
    socket.emit('message', { type: 'system', data: `You don't have '${itemName}' in your inventory.` });
    return;
  }

  const item = player.inventory[itemIndex];
  
  // Remove from inventory and add to trade
  player.inventory.splice(itemIndex, 1);
  trade.myItems.push(item);

  // Update partner's view and show their trade window
  if (partner && partner.activeTrade) {
    partner.activeTrade.theirItems = trade.myItems;
    
    // Find partner's socket and show them the updated trade window
    const partnerSocketId = Array.from(activePlayers.entries()).find(
      ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
    )?.[0];
    
    if (partnerSocketId) {
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }

  handleTradeStatus(socket, player);
}

function handleTradeRemove(socket: any, player: Player, args: string[]): void {
  if (!player.activeTrade) {
    socket.emit('message', { type: 'error', data: 'You are not in a trade.' });
    return;
  }

  if (player.activeTrade.pending) {
    socket.emit('message', { type: 'error', data: 'Use "trade accept" to accept the trade request first.' });
    return;
  }

  if (args.length === 0) {
    socket.emit('message', { type: 'system', data: 'Remove what? Specify item name or "<amount> gold"' });
    return;
  }

  const trade = player.activeTrade;
  
  // Reset ready status when removing items - both players must ready up again
  trade.myReady = false;
  trade.theirReady = false;
  const partner = gameState.players.get(trade.with);
  if (partner && partner.activeTrade) {
    partner.activeTrade.myReady = false;
    partner.activeTrade.theirReady = false;
  }

  // Check if removing gold
  if (args[args.length - 1].toLowerCase() === 'gold') {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      socket.emit('message', { type: 'error', data: 'Invalid gold amount.' });
      return;
    }

    if (trade.myGold < amount) {
      socket.emit('message', { type: 'error', data: `You only have ${trade.myGold} gold in the trade.` });
      return;
    }

    trade.myGold -= amount;
    player.gold += amount; // Return to player

    // Update partner's view and show their trade window
    if (partner && partner.activeTrade) {
      partner.activeTrade.theirGold = trade.myGold;
      
      // Find partner's socket and show them the updated trade window
      const partnerSocketId = Array.from(activePlayers.entries()).find(
        ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
      )?.[0];
      
      if (partnerSocketId) {
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        if (partnerSocket) {
          handleTradeStatus(partnerSocket, partner);
        }
      }
    }

    handleTradeStatus(socket, player);
    return;
  }

  // Removing item
  const itemName = args.join(' ');
  const searchName = itemName.toLowerCase();
  
  const itemIndex = trade.myItems.findIndex(item => 
    item.name.toLowerCase().includes(searchName) || item.id.toLowerCase().includes(searchName)
  );

  if (itemIndex === -1) {
    socket.emit('message', { type: 'system', data: `'${itemName}' is not in your trade offer.` });
    return;
  }

  const item = trade.myItems[itemIndex];
  
  // Remove from trade and return to inventory
  trade.myItems.splice(itemIndex, 1);
  player.inventory.push(item);

  // Update partner's view and show their trade window
  if (partner && partner.activeTrade) {
    partner.activeTrade.theirItems = trade.myItems;
    
    // Find partner's socket and show them the updated trade window
    const partnerSocketId = Array.from(activePlayers.entries()).find(
      ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
    )?.[0];
    
    if (partnerSocketId) {
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }

  handleTradeStatus(socket, player);
}

function handleTradeReady(socket: any, player: Player): void {
  if (!player.activeTrade) {
    socket.emit('message', { type: 'error', data: 'You are not in a trade.' });
    return;
  }

  if (player.activeTrade.pending) {
    socket.emit('message', { type: 'error', data: 'Use "trade accept" to accept the trade request first.' });
    return;
  }

  const trade = player.activeTrade;
  trade.myReady = true;

  const partner = gameState.players.get(trade.with);
  if (!partner || !partner.activeTrade) {
    socket.emit('message', { type: 'error', data: 'Trade partner is no longer available.' });
    handleTradeCancel(socket, player);
    return;
  }

  // Update partner's view
  partner.activeTrade.theirReady = true;

  // Check if both are ready
  if (trade.myReady && trade.theirReady) {
    executeTrade(player, partner);
  } else {
    // Show updated trade window to both players with ready status
    handleTradeStatus(socket, player);
    
    // Find partner's socket and show them the updated trade window
    const partnerSocketId = Array.from(activePlayers.entries()).find(
      ([_, username]) => username.toLowerCase() === trade.with.toLowerCase()
    )?.[0];
    
    if (partnerSocketId) {
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }
}

function executeTrade(player1: Player, player2: Player): void {
  const trade1 = player1.activeTrade!;
  const trade2 = player2.activeTrade!;

  // Check inventory space
  const maxSlots = gameState.defaults.player.maxInventorySlots;
  
  if (player1.inventory.length + trade2.myItems.length > maxSlots) {
    sendToPlayer(player1.username, { 
      type: 'message', 
      data: { text: 'Trade failed: Not enough inventory space!', type: 'error' } 
    });
    sendToPlayer(player2.username, { 
      type: 'message', 
      data: { text: `Trade failed: ${player1.username} doesn't have enough inventory space!`, type: 'error' } 
    });
    handleTradeCancel(null, player1);
    return;
  }

  if (player2.inventory.length + trade1.myItems.length > maxSlots) {
    sendToPlayer(player2.username, { 
      type: 'message', 
      data: { text: 'Trade failed: Not enough inventory space!', type: 'error' } 
    });
    sendToPlayer(player1.username, { 
      type: 'message', 
      data: { text: `Trade failed: ${player2.username} doesn't have enough inventory space!`, type: 'error' } 
    });
    handleTradeCancel(null, player2);
    return;
  }

  // Execute the trade - swap items and gold
  player1.inventory.push(...trade2.myItems);
  player1.gold += trade2.myGold;

  player2.inventory.push(...trade1.myItems);
  player2.gold += trade1.myGold;

  // Build trade summary messages
  let p1Summary = `Trade complete with ${player2.username}!\nYou received: `;
  const p1Received = [];
  if (trade2.myGold > 0) p1Received.push(`${trade2.myGold} gold`);
  trade2.myItems.forEach(item => p1Received.push(item.name));
  p1Summary += p1Received.length > 0 ? p1Received.join(', ') : 'nothing';

  let p2Summary = `Trade complete with ${player1.username}!\nYou received: `;
  const p2Received = [];
  if (trade1.myGold > 0) p2Received.push(`${trade1.myGold} gold`);
  trade1.myItems.forEach(item => p2Received.push(item.name));
  p2Summary += p2Received.length > 0 ? p2Received.join(', ') : 'nothing';

  // Clear trades
  player1.activeTrade = undefined;
  player2.activeTrade = undefined;

  // Save both players
  savePlayer(player1);
  savePlayer(player2);

  // Notify both players
  sendToPlayer(player1.username, { 
    type: 'message', 
    data: { text: p1Summary, type: 'success' } 
  });

  sendToPlayer(player2.username, { 
    type: 'message', 
    data: { text: p2Summary, type: 'success' } 
  });
}

function handleTradeCancel(socket: any | null, player: Player): void {
  if (!player.activeTrade) {
    if (socket) {
      socket.emit('message', { type: 'error', data: 'You are not in a trade.' });
    }
    return;
  }

  const trade = player.activeTrade;
  const wasPending = trade.pending;
  const partner = gameState.players.get(trade.with);

  // Return items and gold to player (only if they exist)
  if (trade.myItems && trade.myItems.length > 0) {
    player.inventory.push(...trade.myItems);
  }
  if (trade.myGold && trade.myGold > 0) {
    player.gold += trade.myGold;
  }

  // Notify partner with appropriate message
  const cancelMessage = wasPending 
    ? `${player.username} declined the trade request.`
    : `Trade with ${player.username} was cancelled.`;
  
  sendToPlayer(trade.with, { 
    type: 'message', 
    data: { text: cancelMessage, type: 'info' } 
  });

  // Return items and gold to partner if they have an active trade
  if (partner && partner.activeTrade) {
    if (partner.activeTrade.myItems && partner.activeTrade.myItems.length > 0) {
      partner.inventory.push(...partner.activeTrade.myItems);
    }
    if (partner.activeTrade.myGold && partner.activeTrade.myGold > 0) {
      partner.gold += partner.activeTrade.myGold;
    }
    partner.activeTrade = undefined;
    savePlayer(partner);
  }

  player.activeTrade = undefined;
  savePlayer(player);

  if (socket) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: 'Trade cancelled.', type: 'info' } 
    });
  }
}

function handleTradeStatus(socket: any, player: Player): void {
  if (!player.activeTrade) {
    socket.emit('message', { type: 'error', data: 'You are not in a trade.' });
    return;
  }

  if (player.activeTrade.pending) {
    socket.emit('message', { 
      type: 'message', 
      data: { text: `${player.activeTrade.with} wants to trade with you. Use 'trade accept' to accept or 'trade cancel' to decline.`, type: 'info' } 
    });
    return;
  }

  const trade = player.activeTrade;
  
  let text = `=== Trade with ${trade.with} ===\n\n`;
  
  text += `You offer:\n`;
  if (trade.myItems.length === 0 && trade.myGold === 0) {
    text += '  (nothing)\n';
  } else {
    if (trade.myGold > 0) {
      text += `  - ${trade.myGold} gold\n`;
    }
    trade.myItems.forEach(item => {
      text += `  - ${item.name}\n`;
    });
  }
  
  text += `\n${trade.with} offers:\n`;
  if (trade.theirItems.length === 0 && trade.theirGold === 0) {
    text += '  (nothing)\n';
  } else {
    if (trade.theirGold > 0) {
      text += `  - ${trade.theirGold} gold\n`;
    }
    trade.theirItems.forEach(item => {
      text += `  - ${item.name}\n`;
    });
  }
  
  text += `\n.........................\nStatus: `;
  if (trade.myReady && trade.theirReady) {
    text += `Both ready - executing trade...`;
  } else if (trade.myReady) {
    text += `You are ready, waiting for ${trade.with}...`;
  } else if (trade.theirReady) {
    text += `${trade.with} is ready, waiting for you...`;
  } else {
    text += `Neither is ready`;
  }
  
  text += `\n--------------------------\n`;

  socket.emit('message', { 
    type: 'message', 
    data: { text, type: 'info' } 
  });
}

function handleMove(socket: any, player: Player, direction: string): void {
  try {
    const currentLocation = gameState.locations.get(player.location);
    if (!currentLocation) {
      socket.emit('message', { type: 'system', data: 'Location not found' });
      return;
    }
    
    const exit = currentLocation.exits[direction.toLowerCase()];
    if (!exit) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `You cannot go ${direction} from here.`, type: 'system' } 
      });
      return;
    }
    
    const newLocation = gameState.locations.get(exit);
    if (!newLocation) {
      socket.emit('message', { type: 'error', data: 'Destination not found' });
      return;
    }
    
    // Store old location before moving
    const oldLocation = player.location;
    
    // Cancel any active or pending trade when moving
    if (player.activeTrade) {
      handleTradeCancel(socket, player);
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Trade cancelled (you moved to a different room).', type: 'info' } 
      });
    }
    
    // Also check if anyone has a pending trade request WITH this player
    // (player might be the initiator who doesn't have activeTrade yet)
    gameState.players.forEach((otherPlayer, username) => {
      if (otherPlayer.activeTrade && 
          otherPlayer.activeTrade.with.toLowerCase() === player.username.toLowerCase()) {
        // This other player has a trade (pending or active) with the moving player
        const otherPlayerSocket = Array.from(activePlayers.entries()).find(
          ([_, user]) => user.toLowerCase() === username.toLowerCase()
        )?.[0];
        
        if (otherPlayerSocket) {
          const sock = io.sockets.sockets.get(otherPlayerSocket);
          if (sock) {
            handleTradeCancel(sock, otherPlayer);
          }
        } else {
          // Player offline, just cancel their trade state
          if (otherPlayer.activeTrade.myItems) {
            otherPlayer.inventory.push(...otherPlayer.activeTrade.myItems);
          }
          if (otherPlayer.activeTrade.myGold) {
            otherPlayer.gold += otherPlayer.activeTrade.myGold;
          }
          otherPlayer.activeTrade = undefined;
          savePlayer(otherPlayer);
        }
      }
    });
    
    // Move player
    player.location = exit;
    
    // Clear PvP combat flag when changing rooms
    player.inPvPCombat = false;
    
    // Update player in game state
    gameState.players.set(player.username, player);
    

    
    // Notify players in old location that player is leaving
    try {
      sendToLocation(oldLocation, { 
        type: 'message', 
        data: { text: `${player.username} leaves ${direction}.`, type: 'system' } 
      }, player.username);
    } catch (notifyError) {
      console.error('Error notifying old location:', notifyError);
    }
    
    // Notify players in new location that player has arrived
    try {
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${player.username} arrives.`, type: 'system' } 
      }, player.username);
    } catch (notifyError) {
      console.error('Error notifying new location:', notifyError);
    }
    
    // Show new location to player
    try {
      handleLook(socket, player);
    } catch (lookError) {
      console.error('Error showing new location:', lookError);
      socket.emit('message', { type: 'error', data: 'Error displaying new location' });
    }
    
  } catch (error) {
    console.error('Error in handleMove:', error);
    socket.emit('message', { type: 'error', data: 'Movement failed' });
  }
}

// Helper function to check if player is in combat (enemy or PvP)
function isPlayerInCombat(player: Player): boolean {
  // Check PvP combat flag first
  if (player.inPvPCombat) return true;
  
  // Check enemy combat
  const location = gameState.locations.get(player.location);
  if (!location) return false;

  // Check if any enemy in this location is fighting this player
  return location.enemies.some(enemy => 
    enemy.currentFighters && enemy.currentFighters.includes(player.username)
  );
}

// Helper function to find the enemy a player is currently fighting
function findEnemyPlayerIsFighting(player: Player): Enemy | null {
  const location = gameState.locations.get(player.location);
  if (!location) return null;

  return location.enemies.find(enemy => 
    enemy.currentFighters && enemy.currentFighters.includes(player.username)
  ) || null;
}

// Helper function to handle enemy death (extracted from existing code)
function handleEnemyDeath(socket: any, player: Player, enemy: Enemy): void {
  const location = gameState.locations.get(player.location);
  if (!location) return;

  // Death message
  sendToEnemyLocations(enemy, { 
    type: 'message', 
    data: { text: `${enemy.name} has been defeated!`, type: 'combat-death' } 
  });

  // Get all fighters
  const fighters = enemy.currentFighters || [];

  // Distribute rewards
  if (fighters.length > 0) {
    const goldPerFighter = Math.floor(enemy.gold / fighters.length);
    const expPerFighter = Math.floor(enemy.experience / fighters.length);

    fighters.forEach(fighterName => {
      const fighter = gameState.players.get(fighterName);
      if (fighter) {
        fighter.gold += goldPerFighter;
        fighter.experience += expPerFighter;

        // Check for level up (exponential progression with multiplier)
        const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
        const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
        const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
        let newLevel = fighter.level;
        
        // Keep checking if player has enough XP for next level
        while (newLevel < maxLevel) {
          let totalXPNeeded = 0;
          for (let i = 1; i <= newLevel; i++) {
            totalXPNeeded += Math.floor(baseXP * Math.pow(multiplier, i - 1));
          }
          if (fighter.experience >= totalXPNeeded) {
            newLevel++;
          } else {
            break;
          }
        }
        
        if (newLevel > fighter.level) {
          const levelsGained = newLevel - fighter.level;
          fighter.level = newLevel;
          fighter.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
          fighter.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
          fighter.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
          if (gameState.defaults.levelUp.fullHealOnLevelUp) {
            fighter.health = fighter.maxHealth;
          }

          sendToPlayer(fighterName, { 
            type: 'message', 
            data: { text: `You gained a level! You are now level ${newLevel}.`, type: 'success' } 
          });
        }

        let rewardMessage = '';
        if (goldPerFighter > 0 && expPerFighter > 0) {
          rewardMessage = `You gained ${goldPerFighter} gold and ${expPerFighter} experience!`;
        } else if (goldPerFighter > 0) {
          rewardMessage = `You gained ${goldPerFighter} gold!`;
        } else if (expPerFighter > 0) {
          rewardMessage = `You gained ${expPerFighter} experience!`;
        }

        if (rewardMessage) {
          sendToPlayer(fighterName, { 
            type: 'message', 
            data: { text: rewardMessage, type: 'success' } 
          });
        }

        updateQuestProgress(fighter, 'kill', enemy.id, fighterName);
        savePlayer(fighter);
      }
    });

    // Handle item drops
    if (enemy.drops && enemy.drops.length > 0) {
      enemy.drops.forEach(drop => {
        if (Math.random() <= drop.dropChance) {
          const item = gameState.items.get(drop.itemId);
          if (item) {
            const randomFighter = fighters[Math.floor(Math.random() * fighters.length)];
            const fighter = gameState.players.get(randomFighter);
            if (fighter) {
              const maxSlots = gameState.defaults.player.maxInventorySlots;
              if (fighter.inventory.length < maxSlots) {
                fighter.inventory.push({ ...item });
                sendToPlayer(randomFighter, { 
                  type: 'message', 
                  data: { text: `You found: ${item.name}!`, type: 'success' } 
                });
                sendToEnemyLocations(enemy, { 
                  type: 'message', 
                  data: { text: `${randomFighter} found ${item.name}!`, type: 'system' } 
                }, randomFighter);
                savePlayer(fighter);
              }
            }
          }
        }
      });
    }
  }

  // Remove enemy from location
  const enemyIndex = location.enemies.indexOf(enemy);
  if (enemyIndex > -1) {
    location.enemies.splice(enemyIndex, 1);
  }

  // Respawn enemy after delay
  setTimeout(() => {
    const enemyTemplate = gameState.enemies.get(enemy.id);
    if (enemyTemplate && location) {
      const newEnemy: Enemy = {
        ...enemyTemplate,
        health: enemyTemplate.maxHealth,
        currentFighters: []
      };
      location.enemies.push(newEnemy);

      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${newEnemy.name} appears!`, type: 'system' } 
      });
    }
  }, enemy.respawnTime || 60000);
}

function handleAttack(socket: any, player: Player, enemyName: string): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'error', data: 'Location not found' });
      return;
    }
    
    // First check if attacking another player
    const targetPlayer = Array.from(gameState.players.values()).find(p => 
      p.username.toLowerCase().includes(enemyName.toLowerCase()) && 
      p.location === player.location &&
      p.username !== player.username
    );
    
    if (targetPlayer) {
      // Check if PvP is allowed in this location
      if (!location.pvpAllowed) {
        socket.emit('message', { 
          type: 'message', 
          data: { text: 'PvP combat is not allowed in this area.', type: 'system' } 
        });
        return;
      }
      
      // PvP combat
      handlePvPAttack(socket, player, targetPlayer);
      return;
    }
    
    // Find enemy in current location
    const enemy = location.enemies.find(enemy => {
      return enemy && enemy.name.toLowerCase().includes(enemyName.toLowerCase()) && isEnemyVisibleToPlayer(enemy, player, player.location);
    });
    
    if (!enemy) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `There is no ${enemyName} here to attack.`, type: 'system' } 
      });
      return;
    }
    
    // Check if enemy is already dead (waiting to respawn)
    if (enemy.health <= 0) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: `The ${enemy.name} is already dead.`, type: 'system' } 
      });
      return;
    }
    
    // Add player to current fighters if not already there
    if (!enemy.currentFighters.includes(player.username)) {
      enemy.currentFighters.push(player.username);
    }
    
    // Calculate damage (base damage + weapon bonus)
    // Calculate total damage from base stat and weapon
    let totalDamage = player.damage;
    if (player.equipment.weapon) {
      totalDamage += player.equipment.weapon.stats?.damage || 0;
    }
    const baseDamage = totalDamage;
    
    // Randomize damage: min = damage - damage/3, max = damage + damage/3 (handle 0 damage)
    let randomDamage;
    if (baseDamage <= 0) {
      randomDamage = 0;
    } else {
      const minDamage = Math.max(1, Math.floor(baseDamage - baseDamage / 3));
      const maxDamage = Math.floor(baseDamage + baseDamage / 3);
      randomDamage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
    }
    
    // Apply enemy defense
    const actualDamage = Math.max(1, randomDamage - (enemy.defense || 0));
    enemy.health -= actualDamage;
    
    // Combat messages
    const healthDisplay = enemy.health <= 0 ? '(dead)' : `(${enemy.health}/${enemy.maxHealth})`;
    const attackMessage = `${player.username} hits ${enemy.name} for ${actualDamage} damage! ${healthDisplay}`;
    sendToLocation(player.location, { 
      type: 'message', 
      data: { text: attackMessage, type: 'player-combat' } 
    });
    
    if (enemy.health <= 0) {
      // Enemy died
      const deathMessage = `The ${enemy.name} has been slain!`;
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: deathMessage, type: 'system' } 
      });
      
      // Distribute rewards to all fighters
      const fighters = enemy.currentFighters.slice(); // Copy array
      
      // Randomize gold drop: min = gold - gold/3, max = gold + gold/3 (handle 0 gold)
      const baseGold = enemy.gold || 0;
      let randomGold;
      if (baseGold <= 0) {
        randomGold = 0;
      } else {
        const minGold = Math.max(1, Math.floor(baseGold - baseGold / 3));
        const maxGold = Math.floor(baseGold + baseGold / 3);
        randomGold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
      }
      const goldPerFighter = Math.floor(randomGold / fighters.length);
      
      const baseExp = enemy.experience || 0;
      const expPerFighter = baseExp > 0 ? Math.max(1, Math.floor(baseExp / fighters.length)) : 0;
      
      fighters.forEach(fighterName => {
        const fighter = gameState.players.get(fighterName);
        if (fighter) {
          fighter.gold += goldPerFighter;
          fighter.experience += expPerFighter;
          
          // Check for level up (exponential progression with multiplier)
          const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
          const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
          const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
          let newLevel = fighter.level;
          
          // Keep checking if player has enough XP for next level
          while (newLevel < maxLevel) {
            let totalXPNeeded = 0;
            for (let i = 1; i <= newLevel; i++) {
              totalXPNeeded += Math.floor(baseXP * Math.pow(multiplier, i - 1));
            }
            if (fighter.experience >= totalXPNeeded) {
              newLevel++;
            } else {
              break;
            }
          }
          
          if (newLevel > fighter.level) {
            const levelsGained = newLevel - fighter.level;
            fighter.level = newLevel;
            fighter.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
            fighter.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
            fighter.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
            if (gameState.defaults.levelUp.fullHealOnLevelUp) {
              fighter.health = fighter.maxHealth; // Full heal on level up
            }
            
            sendToPlayer(fighterName, { 
              type: 'message', 
              data: { text: `Congratulations! You are now level ${fighter.level}!`, type: 'success' } 
            });
          }
          
          // Create reward message based on what was actually gained
          let rewardMessage = '';
          if (goldPerFighter > 0 && expPerFighter > 0) {
            rewardMessage = `You gained ${goldPerFighter} gold and ${expPerFighter} experience!`;
          } else if (goldPerFighter > 0) {
            rewardMessage = `You gained ${goldPerFighter} gold!`;
          } else if (expPerFighter > 0) {
            rewardMessage = `You gained ${expPerFighter} experience!`;
          }
          
          if (rewardMessage) {
            sendToPlayer(fighterName, { 
              type: 'message', 
              data: { text: rewardMessage, type: 'success' } 
            });
          }
          
          // Update quest progress for kill quests
          updateQuestProgress(fighter, 'kill', enemy.id, fighterName);
          
          // Track one-time enemies with location-specific key
          if (enemy.oneTime) {
            const enemyLocationId = getEnemyLocation(enemy);
            if (enemyLocationId) {
              const oneTimeKey = `${enemyLocationId}.${enemy.id}`;
              if (!fighter.oneTimeEnemiesDefeated.includes(oneTimeKey)) {
                fighter.oneTimeEnemiesDefeated.push(oneTimeKey);
              }
            }
          }
          
          // Save player progress
          savePlayer(fighter);
        }
      });
      
      // Handle item drops
      if (enemy.drops && enemy.drops.length > 0) {
        enemy.drops.forEach(drop => {
          // Use individual drop chance for each item
          if (Math.random() <= drop.dropChance) {
            const item = gameState.items.get(drop.itemId);
            if (item) {
              // Give item to a random fighter
              const randomFighter = fighters[Math.floor(Math.random() * fighters.length)];
              const fighter = gameState.players.get(randomFighter);
              if (fighter) {
                // Check if inventory has space
                const maxSlots = gameState.defaults.player.maxInventorySlots;
                if (fighter.inventory.length < maxSlots) {
                  fighter.inventory.push({ ...item }); // Copy the item
                  sendToPlayer(randomFighter, { 
                    type: 'message', 
                    data: { text: `You found: ${item.name}!`, type: 'success' } 
                  });
                  
                  // Broadcast to location
                  sendToEnemyLocations(enemy, { 
                    type: 'message', 
                    data: { text: `${randomFighter} found ${item.name}!`, type: 'system' } 
                  }, randomFighter);
                  
                  savePlayer(fighter);
                } else {
                  sendToPlayer(randomFighter, { 
                    type: 'message', 
                    data: { text: `You found ${item.name} but your inventory is full!`, type: 'system' } 
                  });
                }
              }
            }
          }
        });
      }
      
      // Reset enemy for respawn
      enemy.health = 0;
      enemy.lastKilled = Date.now();
      enemy.currentFighters = [];
      
      // Schedule respawn (only if not a one-time enemy)
      if (!enemy.oneTime) {
        setTimeout(() => {
          if (enemy.health <= 0) { // Still dead
            enemy.health = enemy.maxHealth;
            sendToEnemyLocations(enemy, { 
              type: 'message', 
              data: { text: `A ${enemy.name} appears!`, type: 'system' } 
            });
          }
        }, enemy.respawnTime);
      }
      
    } else {
      // Enemy counter-attacks
      setTimeout(() => {
        if (enemy.health > 0 && enemy.currentFighters.length > 0) {
          const targetName = enemy.currentFighters[Math.floor(Math.random() * enemy.currentFighters.length)];
          const target = gameState.players.get(targetName);
          
          if (target && isEnemyInLocation(enemy, target.location)) {
            // Randomize enemy damage: min = damage - damage/3, max = damage + damage/3 (handle 0 damage)
            const baseEnemyDamage = enemy.damage || 0;
            let randomEnemyDamage;
            if (baseEnemyDamage <= 0) {
              randomEnemyDamage = 0;
            } else {
              const minEnemyDamage = Math.max(1, Math.floor(baseEnemyDamage - baseEnemyDamage / 3));
              const maxEnemyDamage = Math.floor(baseEnemyDamage + baseEnemyDamage / 3);
              randomEnemyDamage = Math.floor(Math.random() * (maxEnemyDamage - minEnemyDamage + 1)) + minEnemyDamage;
            }
            
            // Calculate player defense from base stat and equipment
            let defense = target.defense;
            
            // Add equipment defense
            if (target.equipment.armor) {
              defense += target.equipment.armor.stats?.defense || 0;
            }
            if (target.equipment.shield) {
              defense += target.equipment.shield.stats?.defense || 0;
            }
            
            const actualEnemyDamage = Math.max(1, randomEnemyDamage - defense);
            target.health -= actualEnemyDamage;
            
            const targetHealthDisplay = target.health <= 0 ? '(dead)' : `(${target.health}/${target.maxHealth})`;
            const counterMessage = `${enemy.name} hits ${target.username} for ${actualEnemyDamage} damage! ${targetHealthDisplay}`;
            sendToEnemyLocations(enemy, { 
              type: 'message', 
              data: { text: counterMessage, type: 'enemy-combat' } 
            });
            
            if (target.health <= 0) {
              // Player died - respawn at homestone after 1 second delay
              const oldLocation = target.location;
              
              // Remove from combat
              const fighterIndex = enemy.currentFighters.indexOf(target.username);
              if (fighterIndex > -1) {
                enemy.currentFighters.splice(fighterIndex, 1);
              }
              
              // Death message to old location
              sendToLocation(oldLocation, { 
                type: 'message', 
                data: { text: `${target.username} has been slain and vanishes in a flash of light!`, type: 'combat-death' } 
              }, target.username);
              
              // Respawn message to player
              sendToPlayer(target.username, { 
                type: 'message', 
                data: { text: 'You have died! You awaken at your homestone, fully healed.', type: 'system' } 
              });
              
              // Delay respawn by 1 second
              setTimeout(() => {
                target.health = target.maxHealth; // Full heal on respawn
                target.location = target.homestoneLocation;
                
                // Respawn message to homestone location
                sendToLocation(target.homestoneLocation, { 
                  type: 'message', 
                  data: { text: `${target.username} materializes in a flash of light, looking shaken.`, type: 'system' } 
                }, target.username);
                
                // Show new location to player
                const targetSocket = Array.from(activePlayers.entries()).find(([_, user]) => user === target.username)?.[0];
                if (targetSocket) {
                  const socket = io.sockets.sockets.get(targetSocket);
                  if (socket) {
                    handleLook(socket, target);
                  }
                }
                
                // Save player state
                savePlayer(target);
              }, 1000);
            }
          }
        }
      }, gameState.defaults.combat.enemyCounterAttackDelayMs); // Enemy attacks after player
      
      // Continue combat automatically if both combatants are alive
      setTimeout(() => {
        if (enemy.health > 0 && player.health > gameState.defaults.combat.playerDeathHealthThreshold && isEnemyInLocation(enemy, player.location)) {
          // Check if player is still in combat with this enemy
          if (enemy.currentFighters.includes(player.username)) {
            handleAttack(socket, player, enemyName);
          }
        }
      }, gameState.defaults.combat.combatRoundDelayMs); // Next round starts after player's attack
    }
    
  } catch (error) {
    console.error('Error in handleAttack:', error);
    socket.emit('message', { type: 'error', data: 'Combat failed' });
  }
}

function handlePlayerDisconnect(socket: any, player: Player, sendGoodbyeMessage: boolean = false): void {
  try {
    // Cancel any active or pending trade
    if (player.activeTrade) {
      handleTradeCancel(socket, player);
    }
    
    // Also check if anyone has a pending trade request WITH this player
    // (player might be the initiator who doesn't have activeTrade yet)
    gameState.players.forEach((otherPlayer, username) => {
      if (otherPlayer.activeTrade && 
          otherPlayer.activeTrade.with.toLowerCase() === player.username.toLowerCase()) {
        // This other player has a trade (pending or active) with the disconnecting player
        const otherPlayerSocket = Array.from(activePlayers.entries()).find(
          ([_, user]) => user.toLowerCase() === username.toLowerCase()
        )?.[0];
        
        if (otherPlayerSocket) {
          const sock = io.sockets.sockets.get(otherPlayerSocket);
          if (sock) {
            handleTradeCancel(sock, otherPlayer);
          }
        } else {
          // Player offline, just cancel their trade state
          if (otherPlayer.activeTrade.myItems) {
            otherPlayer.inventory.push(...otherPlayer.activeTrade.myItems);
          }
          if (otherPlayer.activeTrade.myGold) {
            otherPlayer.gold += otherPlayer.activeTrade.myGold;
          }
          otherPlayer.activeTrade = undefined;
          savePlayer(otherPlayer);
        }
      }
    });

    // Remove player from any combat
    forEachEnemy(enemy => {
      if (isEnemyInLocation(enemy, player.location)) {
        const fighterIndex = enemy.currentFighters.indexOf(player.username);
        if (fighterIndex > -1) {
          enemy.currentFighters.splice(fighterIndex, 1);
        }
      }
    });

    // Notify other players in the location
    const departureMessage = sendGoodbyeMessage 
      ? `${player.username} has left the realm.` 
      : `${player.username} has departed.`;
    
    sendToLocation(player.location, { 
      type: 'message', 
      data: { text: departureMessage, type: 'system' } 
    }, player.username);

    // Send logout message to player if requested
    if (sendGoodbyeMessage) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Thanks for playing Mudden! Goodbye!', type: 'success' } 
      });
    }

    // Save player data
    player.lastSeen = Date.now();
    savePlayer(player);
    
    // Clean up server state
    gameState.players.delete(player.username);
    activePlayers.delete(socket.id);
    
  } catch (error) {
    console.error('Error in handlePlayerDisconnect:', error);
    if (sendGoodbyeMessage) {
      socket.emit('message', { type: 'error', data: 'Logout failed' });
    }
  }
}

function handleQuit(socket: any, player: Player): void {
  // Use shared disconnect logic with goodbye message
  handlePlayerDisconnect(socket, player, true);
  
  // Send a special quit message to client instead of force disconnecting
  setTimeout(() => {
    socket.emit('message', { type: 'success', data: 'logout_complete' });
  }, 1000);
}

function handlePvPAttack(socket: any, attacker: Player, defender: Player): void {
  try {
    // Mark both players as in PvP combat
    attacker.inPvPCombat = true;
    defender.inPvPCombat = true;
    
    // Calculate attacker's total damage
    let attackerDamage = attacker.damage;
    if (attacker.equipment.weapon) {
      attackerDamage += attacker.equipment.weapon.stats?.damage || 0;
    }
    
    // Randomize damage
    const minDamage = Math.max(1, Math.floor(attackerDamage - attackerDamage / 3));
    const maxDamage = Math.floor(attackerDamage + attackerDamage / 3);
    let randomDamage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
    
    // Calculate defender's total defense
    let defenderDefense = defender.defense;
    if (defender.equipment.armor) {
      defenderDefense += defender.equipment.armor.stats?.defense || 0;
    }
    if (defender.equipment.shield) {
      defenderDefense += defender.equipment.shield.stats?.defense || 0;
    }
    
    // Apply defense
    const actualDamage = Math.max(1, randomDamage - defenderDefense);
    defender.health -= actualDamage;
    
    // Combat messages
    const healthDisplay = defender.health <= 0 ? '(dead)' : `(${defender.health}/${defender.maxHealth})`;
    const attackMessage = `${attacker.username} hits ${defender.username} for ${actualDamage} damage! ${healthDisplay}`;
    sendToLocation(attacker.location, { 
      type: 'message', 
      data: { text: attackMessage, type: 'pvp-combat' } 
    });
    
    // Check if defender died
    if (defender.health <= 0) {
      // Calculate power difference for experience
      let attackerPower = attacker.health + attackerDamage + (attacker.defense + (attacker.equipment.armor?.stats?.defense || 0) + (attacker.equipment.shield?.stats?.defense || 0));
      let defenderPower = defender.maxHealth + (defender.damage + (defender.equipment.weapon?.stats?.damage || 0)) + defenderDefense;
      const powerDiff = attackerPower - defenderPower;
      
      // Calculate experience based on difficulty using defaults
      const pvpConfig = gameState.defaults.pvp;
      let expGain = pvpConfig.baseExperience;
      if (powerDiff > 50) {
        expGain = pvpConfig.experienceByDifficulty.trivial;
      } else if (powerDiff > 25) {
        expGain = pvpConfig.experienceByDifficulty.easy;
      } else if (powerDiff > 0) {
        expGain = pvpConfig.experienceByDifficulty.moderate;
      } else if (powerDiff > -25) {
        expGain = pvpConfig.experienceByDifficulty.challenging;
      } else if (powerDiff > -50) {
        expGain = pvpConfig.experienceByDifficulty.hard;
      } else if (powerDiff > -100) {
        expGain = pvpConfig.experienceByDifficulty.deadly;
      } else {
        expGain = pvpConfig.experienceByDifficulty.impossible;
      }
      
      // Loot gold percentage from defender
      const goldLooted = Math.floor(defender.gold * pvpConfig.goldLootPercentage);
      defender.gold -= goldLooted;
      attacker.gold += goldLooted;
      
      // Award experience
      attacker.experience += expGain;
      
      // Update PvP stats
      attacker.pvpWins = (attacker.pvpWins || 0) + 1;
      defender.pvpLosses = (defender.pvpLosses || 0) + 1;
      
      // Death messages
      sendToLocation(attacker.location, {
        type: 'message',
        data: { text: `${defender.username} has been defeated by ${attacker.username}!`, type: 'player-death' }
      });
      
      sendToPlayer(attacker.username, {
        type: 'message',
        data: { text: `You defeated ${defender.username}! You gain ${expGain} experience and loot ${goldLooted} gold!`, type: 'success' }
      });
      
      sendToPlayer(defender.username, {
        type: 'message',
        data: { text: `You have been defeated! You lost ${goldLooted} gold.`, type: 'death' }
      });
      
      // Clear PvP combat flags
      attacker.inPvPCombat = false;
      defender.inPvPCombat = false;
      
      // Respawn defender after 1 second delay
      setTimeout(() => {
        const defaults = gameState.defaults;
        defender.health = defender.maxHealth;
        
        // Get homestone location or default to starting location
        const respawnLocation = defender.homestoneLocation || defaults.player.startingLocation;
        defender.location = respawnLocation;
        
        sendToPlayer(defender.username, {
          type: 'message',
          data: { text: `You respawn at ${gameState.locations.get(respawnLocation)?.name || respawnLocation}.`, type: 'system' }
        });
        
        // Broadcast respawn to new location
        sendToLocation(respawnLocation, {
          type: 'message',
          data: { text: `${defender.username} appears.`, type: 'system' }
        }, defender.username);
        
        savePlayer(defender);
      }, 1000);
      
      // Check for level up
      const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
      const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
      const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
      let newLevel = attacker.level;
      
      while (newLevel < maxLevel) {
        let totalXPNeeded = 0;
        for (let i = 1; i <= newLevel; i++) {
          totalXPNeeded += Math.floor(baseXP * Math.pow(multiplier, i - 1));
        }
        if (attacker.experience >= totalXPNeeded) {
          newLevel++;
        } else {
          break;
        }
      }
      
      if (newLevel > attacker.level) {
        const levelsGained = newLevel - attacker.level;
        attacker.level = newLevel;
        attacker.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
        attacker.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
        attacker.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
        if (gameState.defaults.levelUp.fullHealOnLevelUp) {
          attacker.health = attacker.maxHealth;
        }
        
        sendToPlayer(attacker.username, { 
          type: 'message', 
          data: { text: `Congratulations! You are now level ${attacker.level}!`, type: 'success' } 
        });
      }
      
      // Save attacker (defender will be saved after respawn)
      savePlayer(attacker);
    } else {
      // Defender counter-attacks
      setTimeout(() => {
        if (defender.health > 0) {
          // Calculate defender's damage
          let defenderDamage = defender.damage;
          if (defender.equipment.weapon) {
            defenderDamage += defender.equipment.weapon.stats?.damage || 0;
          }
          
          const minCounterDamage = Math.max(1, Math.floor(defenderDamage - defenderDamage / 3));
          const maxCounterDamage = Math.floor(defenderDamage + defenderDamage / 3);
          let counterDamage = Math.floor(Math.random() * (maxCounterDamage - minCounterDamage + 1)) + minCounterDamage;
          
          // Calculate attacker's defense
          let attackerDefense = attacker.defense;
          if (attacker.equipment.armor) {
            attackerDefense += attacker.equipment.armor.stats?.defense || 0;
          }
          if (attacker.equipment.shield) {
            attackerDefense += attacker.equipment.shield.stats?.defense || 0;
          }
          
          const actualCounterDamage = Math.max(1, counterDamage - attackerDefense);
          attacker.health -= actualCounterDamage;
          
          const attackerHealthDisplay = attacker.health <= 0 ? '(dead)' : `(${attacker.health}/${attacker.maxHealth})`;
          const counterMessage = `${defender.username} hits ${attacker.username} for ${actualCounterDamage} damage! ${attackerHealthDisplay}`;
          
          sendToLocation(attacker.location, {
            type: 'message',
            data: { text: counterMessage, type: 'pvp-combat' }
          });
          
          // Check if attacker died from counter
          if (attacker.health <= 0) {
            // Defender won! Calculate rewards
            // Calculate power difference for experience
            let defenderPower = defender.health + defenderDamage + (defender.defense + (defender.equipment.armor?.stats?.defense || 0) + (defender.equipment.shield?.stats?.defense || 0));
            let attackerPower = attacker.maxHealth + (attacker.damage + (attacker.equipment.weapon?.stats?.damage || 0)) + attackerDefense;
            const powerDiff = defenderPower - attackerPower;
            
            // Calculate experience based on difficulty using defaults
            const pvpConfig = gameState.defaults.pvp;
            let expGain = pvpConfig.baseExperience;
            if (powerDiff > 50) {
              expGain = pvpConfig.experienceByDifficulty.trivial;
            } else if (powerDiff > 25) {
              expGain = pvpConfig.experienceByDifficulty.easy;
            } else if (powerDiff > 0) {
              expGain = pvpConfig.experienceByDifficulty.moderate;
            } else if (powerDiff > -25) {
              expGain = pvpConfig.experienceByDifficulty.challenging;
            } else if (powerDiff > -50) {
              expGain = pvpConfig.experienceByDifficulty.hard;
            } else if (powerDiff > -100) {
              expGain = pvpConfig.experienceByDifficulty.deadly;
            } else {
              expGain = pvpConfig.experienceByDifficulty.impossible;
            }
            
            // Loot gold percentage from attacker
            const goldLooted = Math.floor(attacker.gold * pvpConfig.goldLootPercentage);
            attacker.gold -= goldLooted;
            defender.gold += goldLooted;
            
            // Award experience
            defender.experience += expGain;
            
            // Update PvP stats
            defender.pvpWins = (defender.pvpWins || 0) + 1;
            attacker.pvpLosses = (attacker.pvpLosses || 0) + 1;
            
            // Victory messages
            sendToPlayer(defender.username, {
              type: 'message',
              data: { text: `You defeated ${attacker.username} in retaliation! You gain ${expGain} experience and loot ${goldLooted} gold!`, type: 'success' }
            });
            
            sendToPlayer(attacker.username, {
              type: 'message',
              data: { text: `You have been defeated in retaliation! You lost ${goldLooted} gold.`, type: 'death' }
            });
            
            // Check for defender level up
            const baseXP = gameState.defaults.levelUp.baseExperiencePerLevel || 100;
            const multiplier = gameState.defaults.levelUp.experienceMultiplier || 1.5;
            const maxLevel = gameState.defaults.levelUp.maxLevel || 20;
            let newLevel = defender.level;
            
            while (newLevel < maxLevel) {
              let totalXPNeeded = 0;
              for (let i = 1; i <= newLevel; i++) {
                totalXPNeeded += Math.floor(baseXP * Math.pow(multiplier, i - 1));
              }
              if (defender.experience >= totalXPNeeded) {
                newLevel++;
              } else {
                break;
              }
            }
            
            if (newLevel > defender.level) {
              const levelsGained = newLevel - defender.level;
              defender.level = newLevel;
              defender.maxHealth += gameState.defaults.levelUp.healthGainPerLevel * levelsGained;
              defender.damage += gameState.defaults.levelUp.damageGainPerLevel * levelsGained;
              defender.defense += gameState.defaults.levelUp.defenseGainPerLevel * levelsGained;
              if (gameState.defaults.levelUp.fullHealOnLevelUp) {
                defender.health = defender.maxHealth;
              }
              
              sendToPlayer(defender.username, { 
                type: 'message', 
                data: { text: `Congratulations! You are now level ${defender.level}!`, type: 'success' } 
              });
            }
            
            // Clear PvP combat flags
            attacker.inPvPCombat = false;
            defender.inPvPCombat = false;
            
            // Respawn attacker after 1 second delay
            setTimeout(() => {
              const defaults = gameState.defaults;
              attacker.health = attacker.maxHealth;
              
              const respawnLocation = attacker.homestoneLocation || defaults.player.startingLocation;
              attacker.location = respawnLocation;
              
              sendToPlayer(attacker.username, {
                type: 'message',
                data: { text: `You respawn at ${gameState.locations.get(respawnLocation)?.name || respawnLocation}.`, type: 'system' }
              });
              
              sendToLocation(respawnLocation, {
                type: 'message',
                data: { text: `${attacker.username} appears.`, type: 'system' }
              }, attacker.username);
              
              savePlayer(attacker);
            }, 1000);
            
            // Save defender (winner)
            savePlayer(defender);
          } else {
            // Attacker survived, save both players
            savePlayer(attacker);
            savePlayer(defender);
          }
        }
      }, gameState.defaults.combat.enemyCounterAttackDelayMs); // Use combat delay constant
      
      // Continue PvP combat automatically if both combatants are alive and in same location
      setTimeout(() => {
        if (attacker.health > gameState.defaults.combat.playerDeathHealthThreshold && 
            defender.health > gameState.defaults.combat.playerDeathHealthThreshold && 
            attacker.location === defender.location &&
            attacker.inPvPCombat && defender.inPvPCombat) { // Check PvP flags still active
          // Get attacker's socket and continue combat
          const attackerSocketId = Array.from(activePlayers.entries()).find(
            ([_, user]) => user === attacker.username
          )?.[0];
          
          if (attackerSocketId) {
            const attackerSocket = io.sockets.sockets.get(attackerSocketId);
            if (attackerSocket) {
              handleAttack(attackerSocket, attacker, defender.username);
            }
          }
        }
      }, gameState.defaults.combat.combatRoundDelayMs); // Next round starts after counter-attack
    }
  } catch (error) {
    console.error('Error in handlePvPAttack:', error);
    socket.emit('message', { type: 'error', data: 'Error during PvP combat' });
  }
}

function handleFlee(socket: any, player: Player): void {
  try {
    const currentLocation = gameState.locations.get(player.location);
    if (!currentLocation) {
      socket.emit('message', { type: 'error', data: 'Invalid location!' });
      return;
    }

    // Check if player is actually in combat (either with enemies or other players)
    let inCombat = false;
    
    // Check for enemy combat
    forEachEnemy(enemy => {
      if (isEnemyInLocation(enemy, player.location) && enemy.currentFighters.includes(player.username)) {
        inCombat = true;
      }
    });
    
    // Check for PvP combat flag
    if (!inCombat && player.inPvPCombat) {
      inCombat = true;
    }

    if (!inCombat) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'You are not in combat.', type: 'status' } 
      });
      return;
    }

    // Check chance to successfully flee
    const fleeChance = Math.random();
    if (fleeChance <= gameState.defaults.combat.fleeSuccessChance) {
      // Successful flee - Remove player from all enemy combat
      forEachEnemy(enemy => {
        if (isEnemyInLocation(enemy, player.location)) {
          const fighterIndex = enemy.currentFighters.indexOf(player.username);
          if (fighterIndex > -1) {
            enemy.currentFighters.splice(fighterIndex, 1);
          }
        }
      });
      
      // For PvP or any combat, move to random adjacent location
      const exits = Object.keys(currentLocation.exits);
      if (exits.length > 0) {
        const randomExit = exits[Math.floor(Math.random() * exits.length)];
        const oldLocation = player.location;
        player.location = currentLocation.exits[randomExit];
        
        // Clear PvP combat flag when fleeing
        player.inPvPCombat = false;
        
        // Broadcast flee message to old location
        sendToLocation(oldLocation, { 
          type: 'message', 
          data: { text: `${player.username} flees ${randomExit}!`, type: 'system' } 
        });
        
        // Broadcast arrival to new location
        sendToLocation(player.location, { 
          type: 'message', 
          data: { text: `${player.username} arrives, fleeing from combat!`, type: 'system' } 
        }, player.username);
        
        // Show new location to player
        handleLook(socket, player);
        savePlayer(player);
      } else {
        socket.emit('message', { 
          type: 'error', 
          data: 'There is nowhere to flee to!' 
        });
      }
    } else {
      // Failed to flee
      sendToLocation(player.location, { 
        type: 'message', 
        data: { text: `${player.username} tries to flee but fails!`, type: 'system' } 
      });
    }
    
  } catch (error) {
    console.error('Error in handleFlee:', error);
    socket.emit('message', { type: 'error', data: 'Failed to flee' });
  }
}

function handleHomestoneBind(socket: any, player: Player): void {
  try {
    const location = gameState.locations.get(player.location);
    if (!location) {
      socket.emit('message', { type: 'error', data: 'Location not found' });
      return;
    }

    // Check if this location allows homestone binding
    if (!location.homestone) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'You cannot bind your homestone at this location.', type: 'system' } 
      });
      return;
    }

    // Set homestone location
    player.homestoneLocation = player.location;
    savePlayer(player);

    socket.emit('message', { 
      type: 'message', 
      data: { text: `You bind your homestone to ${location.name}. You will respawn here if you die.`, type: 'info' } 
    });

    // Broadcast to location
    sendToLocation(player.location, { 
      type: 'message', 
      data: { text: `${player.username} binds their homestone here.`, type: 'system' } 
    }, player.username);

  } catch (error) {
    console.error('Error in handleHomestoneBind:', error);
    socket.emit('message', { type: 'error', data: 'Failed to bind homestone' });
  }
}

function handleHomestoneWhere(socket: any, player: Player): void {
  try {
    const homestoneLocation = gameState.locations.get(player.homestoneLocation);
    if (!homestoneLocation) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Your homestone location could not be found. It may have been removed.', type: 'error' } 
      });
      return;
    }

    socket.emit('message', { 
      type: 'message', 
      data: { text: `Your homestone is bound to: ${homestoneLocation.name}`, type: 'info' } 
    });

  } catch (error) {
    console.error('Error in handleHomestoneWhere:', error);
    socket.emit('message', { type: 'error', data: 'Failed to check homestone location' });
  }
}

function handleHomestoneRecall(socket: any, player: Player): void {
  try {
    // Check if player is in combat (enemy or PvP)
    if (isPlayerInCombat(player)) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'You cannot use your homestone while in combat!', type: 'system' } 
      });
      return;
    }

    // Check if homestone location exists
    const homestoneLocation = gameState.locations.get(player.homestoneLocation);
    if (!homestoneLocation) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'Your homestone location could not be found. It may have been removed.', type: 'error' } 
      });
      return;
    }

    // Check if already at homestone location
    if (player.location === player.homestoneLocation) {
      socket.emit('message', { 
        type: 'message', 
        data: { text: 'You are already at your homestone location.', type: 'system' } 
      });
      return;
    }

    // Store old location for messaging
    const oldLocation = player.location;
    const currentLocation = gameState.locations.get(oldLocation);

    // Teleport player
    player.location = player.homestoneLocation;
    savePlayer(player);

    // Message to old location
    if (currentLocation) {
      sendToLocation(oldLocation, { 
        type: 'message', 
        data: { text: `${player.username} disappears in a swirl of magical energy.`, type: 'info' } 
      }, player.username);
    }

    // Message to player
    socket.emit('message', { 
      type: 'message', 
      data: { text: `You focus on your homestone and feel the world shift around you...`, type: 'info' } 
    });

    // Message to homestone location
    sendToLocation(player.homestoneLocation, { 
      type: 'message', 
      data: { text: `${player.username} appears in a swirl of magical energy.`, type: 'info' } 
    }, player.username);

    // Show new location to player
    setTimeout(() => {
      handleLook(socket, player);
    }, 1000); // Small delay for dramatic effect

  } catch (error) {
    console.error('Error in handleHomestoneRecall:', error);
    socket.emit('message', { type: 'error', data: 'Failed to recall to homestone' });
  }
}

function handleHelp(socket: any): void {
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

// Initialize game data and start server
loadGameData();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mudden server running on port ${PORT}`);
});

// Graceful shutdown - save all players
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  console.log('Saving all player data...');
  
  gameState.players.forEach((player, username) => {
    try {
      player.lastSeen = Date.now();
      savePlayer(player);
      console.log(`Saved ${username}`);
    } catch (error) {
      console.error(`Failed to save ${username}:`, error);
    }
  });
  
  console.log('All players saved. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.kill(process.pid, 'SIGINT');
});