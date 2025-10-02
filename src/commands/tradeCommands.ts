/**
 * Trading commands (trade system)
 */
import { Player } from '../types';
import { gameState, getSocketId, activePlayers } from '../gameState';
import { sendToPlayer, getSocket } from '../messaging';
import { savePlayer } from '../auth';

/**
 * Main trade command router
 */
export function handleTradeCommand(socket: any, player: Player, args: string[]): void {
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

/**
 * Starts a trade with another player
 */
function handleTradeStart(socket: any, player: Player, targetName: string): void {
  if (!targetName) {
    socket.emit('message', { type: 'system', data: 'Trade with whom?' });
    return;
  }

  if (player.activeTrade) {
    const tradePartner = player.activeTrade.with || 'someone';
    socket.emit('message', { type: 'error', data: `You're already trading with ${tradePartner}.` });
    return;
  }

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

  const isOnline = Array.from(activePlayers.values()).some(
    username => username.toLowerCase() === actualTargetName!.toLowerCase()
  );

  if (!isOnline) {
    socket.emit('message', { type: 'system', data: `${actualTargetName} is not online.` });
    return;
  }

  if (player.username.toLowerCase() === actualTargetName.toLowerCase()) {
    socket.emit('message', { type: 'error', data: 'You cannot trade with yourself.' });
    return;
  }

  if (player.location !== targetPlayer.location) {
    socket.emit('message', { type: 'error', data: `${actualTargetName} is not in the same location as you.` });
    return;
  }

  if (targetPlayer.activeTrade) {
    socket.emit('message', { type: 'error', data: `${actualTargetName} is already in a trade.` });
    return;
  }

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

/**
 * Accepts a trade request
 */
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

  const isOnline = Array.from(activePlayers.values()).some(
    username => username.toLowerCase() === trade.with.toLowerCase()
  );

  if (!isOnline) {
    socket.emit('message', { type: 'error', data: `${trade.with} is no longer online.` });
    player.activeTrade = undefined;
    return;
  }

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

  handleTradeStatus(socket, player);
  
  const initiatorSocketId = getSocketId(trade.with);
  if (initiatorSocketId) {
    const initiatorSocket = getSocket(initiatorSocketId);
    if (initiatorSocket) {
      handleTradeStatus(initiatorSocket, initiator);
    }
  }
}

/**
 * Adds an item or gold to the trade
 */
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
  
  trade.myReady = false;
  trade.theirReady = false;
  const partner = gameState.players.get(trade.with);
  if (partner && partner.activeTrade) {
    partner.activeTrade.myReady = false;
    partner.activeTrade.theirReady = false;
  }

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
    player.gold -= amount;

    if (partner && partner.activeTrade) {
      partner.activeTrade.theirGold = trade.myGold;
      
      const partnerSocketId = getSocketId(trade.with);
      if (partnerSocketId) {
        const partnerSocket = getSocket(partnerSocketId);
        if (partnerSocket) {
          handleTradeStatus(partnerSocket, partner);
        }
      }
    }

    handleTradeStatus(socket, player);
    return;
  }

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
  player.inventory.splice(itemIndex, 1);
  trade.myItems.push(item);

  if (partner && partner.activeTrade) {
    partner.activeTrade.theirItems = trade.myItems;
    
    const partnerSocketId = getSocketId(trade.with);
    if (partnerSocketId) {
      const partnerSocket = getSocket(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }

  handleTradeStatus(socket, player);
}

/**
 * Removes an item or gold from the trade
 */
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
  
  trade.myReady = false;
  trade.theirReady = false;
  const partner = gameState.players.get(trade.with);
  if (partner && partner.activeTrade) {
    partner.activeTrade.myReady = false;
    partner.activeTrade.theirReady = false;
  }

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
    player.gold += amount;

    if (partner && partner.activeTrade) {
      partner.activeTrade.theirGold = trade.myGold;
      
      const partnerSocketId = getSocketId(trade.with);
      if (partnerSocketId) {
        const partnerSocket = getSocket(partnerSocketId);
        if (partnerSocket) {
          handleTradeStatus(partnerSocket, partner);
        }
      }
    }

    handleTradeStatus(socket, player);
    return;
  }

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
  trade.myItems.splice(itemIndex, 1);
  player.inventory.push(item);

  if (partner && partner.activeTrade) {
    partner.activeTrade.theirItems = trade.myItems;
    
    const partnerSocketId = getSocketId(trade.with);
    if (partnerSocketId) {
      const partnerSocket = getSocket(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }

  handleTradeStatus(socket, player);
}

/**
 * Marks player as ready to complete the trade
 */
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

  partner.activeTrade.theirReady = true;

  if (trade.myReady && trade.theirReady) {
    executeTrade(player, partner);
  } else {
    handleTradeStatus(socket, player);
    
    const partnerSocketId = getSocketId(trade.with);
    if (partnerSocketId) {
      const partnerSocket = getSocket(partnerSocketId);
      if (partnerSocket) {
        handleTradeStatus(partnerSocket, partner);
      }
    }
  }
}

/**
 * Executes the trade between two players
 */
function executeTrade(player1: Player, player2: Player): void {
  const trade1 = player1.activeTrade!;
  const trade2 = player2.activeTrade!;

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

  player1.inventory.push(...trade2.myItems);
  player1.gold += trade2.myGold;

  player2.inventory.push(...trade1.myItems);
  player2.gold += trade1.myGold;

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

  player1.activeTrade = undefined;
  player2.activeTrade = undefined;

  savePlayer(player1);
  savePlayer(player2);

  sendToPlayer(player1.username, { 
    type: 'message', 
    data: { text: p1Summary, type: 'success' } 
  });

  sendToPlayer(player2.username, { 
    type: 'message', 
    data: { text: p2Summary, type: 'success' } 
  });
}

/**
 * Cancels the active trade
 */
export function handleTradeCancel(socket: any | null, player: Player): void {
  if (!player.activeTrade) {
    if (socket) {
      socket.emit('message', { type: 'error', data: 'You are not in a trade.' });
    }
    return;
  }

  const trade = player.activeTrade;
  const wasPending = trade.pending;
  const partner = gameState.players.get(trade.with);

  if (trade.myItems && trade.myItems.length > 0) {
    player.inventory.push(...trade.myItems);
  }
  if (trade.myGold && trade.myGold > 0) {
    player.gold += trade.myGold;
  }

  const cancelMessage = wasPending 
    ? `${player.username} declined the trade request.`
    : `Trade with ${player.username} was cancelled.`;
  
  sendToPlayer(trade.with, { 
    type: 'message', 
    data: { text: cancelMessage, type: 'info' } 
  });

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

/**
 * Shows the current trade status
 */
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
