// Game state management

import { Player, GameData, Config } from './types';

export interface GameState {
  players: Map<string, Player>;  // username -> Player
  gameData: GameData;
}

// Global game state
export const gameState: GameState = {
  players: new Map(),
  gameData: {
    locations: new Map(),
    items: new Map(),
    enemies: new Map(),
    npcs: new Map(),
    quests: new Map(),
    shops: new Map(),
    recipes: new Map(),
    materials: new Map(),
    config: null as unknown as Config, // Will be loaded from data/config.json
  }
};

// Helper functions

export function getPlayer(username: string): Player | undefined {
  return gameState.players.get(username);
}

export function addPlayer(player: Player): void {
  gameState.players.set(player.username, player);
}

export function removePlayer(username: string): void {
  gameState.players.delete(username);
}

export function getPlayersInLocation(locationId: string): Player[] {
  return Array.from(gameState.players.values())
    .filter(p => p.location === locationId);
}

export function getOnlinePlayers(): Player[] {
  return Array.from(gameState.players.values())
    .filter(p => p.socket !== undefined);
}
