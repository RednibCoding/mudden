/**
 * Command router - handles all player commands
 */
import { Player } from '../types';
import { gameState, activePlayers } from '../gameState';
import { sendToPlayer, sendToLocation } from '../messaging';
import { savePlayer } from '../auth';
import { handlePlayerMove, handleFlee } from '../movement';
import { handleListShop, handleBuy, handleSell } from '../shopSystem';
import { handleHomestoneBind, handleHomestoneWhere, handleHomestoneRecall } from '../homestone';
import { handleAttackCommand, handleExamineCommand } from './combatCommands';
import { handleLook, handleMap, handleInventory, handleHelp } from './infoCommands';
import { handleSay, handleWhisper, handleReply, handleFriend, handleWho } from './socialCommands';
import { handleGetCommand, handleDropCommand, handleEquipCommand, handleUnequipCommand, handleUseCommand } from './itemCommands';
import { handleTalkCommand } from './npcCommands';
import { handleTradeCommand } from './tradeCommands';
import { handleQuitCommand } from './sessionCommands';

/**
 * Routes a command to the appropriate handler
 */
export function routeCommand(socket: any, player: Player, command: string): void {
  const parts = command.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    // Information commands
    case 'look':
    case 'l':
      handleLook(socket, player);
      break;
    case 'map':
    case 'm':
      handleMap(socket, player);
      break;
    case 'inventory':
    case 'inv':
    case 'i':
      handleInventory(socket, player);
      break;
    case 'help':
      handleHelp(socket);
      break;

    // Movement commands
    case 'north':
    case 'n':
      handlePlayerMove(socket, player, 'north', () => handleLook(socket, player));
      break;
    case 'south':
    case 's':
      handlePlayerMove(socket, player, 'south', () => handleLook(socket, player));
      break;
    case 'east':
    case 'e':
      handlePlayerMove(socket, player, 'east', () => handleLook(socket, player));
      break;
    case 'west':
    case 'w':
      handlePlayerMove(socket, player, 'west', () => handleLook(socket, player));
      break;
    case 'up':
    case 'u':
      handlePlayerMove(socket, player, 'up', () => handleLook(socket, player));
      break;
    case 'down':
    case 'd':
      handlePlayerMove(socket, player, 'down', () => handleLook(socket, player));
      break;
    case 'northeast':
    case 'ne':
      handlePlayerMove(socket, player, 'northeast', () => handleLook(socket, player));
      break;
    case 'northwest':
    case 'nw':
      handlePlayerMove(socket, player, 'northwest', () => handleLook(socket, player));
      break;
    case 'southeast':
    case 'se':
      handlePlayerMove(socket, player, 'southeast', () => handleLook(socket, player));
      break;
    case 'southwest':
    case 'sw':
      handlePlayerMove(socket, player, 'southwest', () => handleLook(socket, player));
      break;
    case 'go':
      if (args.length > 0) {
        handlePlayerMove(socket, player, args[0], () => handleLook(socket, player));
      } else {
        socket.emit('message', { type: 'system', data: 'Go where?' });
      }
      break;

    // Combat commands
    case 'attack':
    case 'strike':
    case 'hit':
      if (args.length > 0) {
        handleAttackCommand(socket, player, args[0]);
      } else {
        socket.emit('message', { type: 'error', data: 'Attack what?' });
      }
      break;
    case 'flee':
    case 'run':
      if (handleFlee(socket, player)) {
        handleLook(socket, player);
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
        handleExamineCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Examine what?' });
      }
      break;

    // Social commands
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

    // NPC interaction
    case 'talk':
    case 'speak':
      if (args.length > 0) {
        handleTalkCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Talk to whom?' });
      }
      break;

    // Item commands
    case 'get':
    case 'take':
      if (args.length > 0) {
        handleGetCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'error', data: 'Get what?' });
      }
      break;
    case 'drop':
      if (args.length > 0) {
        handleDropCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'error', data: 'Drop what?' });
      }
      break;
    case 'equip':
    case 'wear':
    case 'wield':
      if (args.length > 0) {
        handleEquipCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Equip what?' });
      }
      break;
    case 'unequip':
    case 'remove':
      if (args.length > 0) {
        handleUnequipCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Unequip what?' });
      }
      break;
    case 'use':
      if (args.length > 0) {
        handleUseCommand(socket, player, args.join(' '));
      } else {
        socket.emit('message', { type: 'system', data: 'Use what?' });
      }
      break;

    // Shop commands
    case 'list':
    case 'shop':
      handleListShop(socket, player);
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

    // Trade commands
    case 'trade':
      handleTradeCommand(socket, player, args);
      break;

    // Homestone commands
    case 'homestone':
      if (args.length > 0 && args[0].toLowerCase() === 'bind') {
        handleHomestoneBind(socket, player);
      } else if (args.length > 0 && args[0].toLowerCase() === 'where') {
        handleHomestoneWhere(socket, player);
      } else if (args.length > 0 && args[0].toLowerCase() === 'recall') {
        handleHomestoneRecall(socket, player, () => handleLook(socket, player));
      } else {
        socket.emit('message', { type: 'info', data: 'Usage: homestone bind | homestone where | homestone recall' });
      }
      break;

    // Session commands
    case 'quit':
    case 'logout':
      handleQuitCommand(socket, player);
      break;

    default:
      socket.emit('message', {
        type: 'message',
        data: { text: 'Unknown command. Type "help" for available commands.', type: 'info' }
      });
  }
}
