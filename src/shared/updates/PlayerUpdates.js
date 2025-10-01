import { BaseUpdate } from './BaseUpdate.js'
import { UpdateTypes } from '../UpdateTypes.js'

/**
 * Player moved update - sent when a player successfully moves to a new room
 */
export class PlayerMovedUpdate extends BaseUpdate {
  constructor(playerId, commandId, newRoom, oldRoom = null) {
    super(UpdateTypes.PLAYER_MOVED, [playerId])
    this.playerId = playerId
    this.commandId = commandId
    this.newRoom = newRoom
    this.oldRoom = oldRoom
  }
  
  getData() {
    return {
      playerId: this.playerId,
      commandId: this.commandId,
      newRoom: this.newRoom,
      oldRoom: this.oldRoom
    }
  }
}

/**
 * Player entered room update - sent to other players in room when someone enters
 */
export class PlayerEnteredRoomUpdate extends BaseUpdate {
  constructor(roomPlayers, enteringPlayer, playerData) {
    super(UpdateTypes.PLAYER_ENTERED_ROOM, roomPlayers)
    this.enteringPlayer = enteringPlayer
    this.playerData = playerData
  }
  
  getData() {
    return {
      enteringPlayer: this.enteringPlayer,
      playerData: this.playerData
    }
  }
}

/**
 * Player left room update - sent to other players in room when someone leaves
 */
export class PlayerLeftRoomUpdate extends BaseUpdate {
  constructor(roomPlayers, leavingPlayer, playerData) {
    super(UpdateTypes.PLAYER_LEFT_ROOM, roomPlayers)
    this.leavingPlayer = leavingPlayer
    this.playerData = playerData
  }
  
  getData() {
    return {
      leavingPlayer: this.leavingPlayer,
      playerData: this.playerData
    }
  }
}

/**
 * Player stats changed update - sent when player stats are modified
 */
export class PlayerStatsChangedUpdate extends BaseUpdate {
  constructor(playerId, stats, changedStats = []) {
    super(UpdateTypes.PLAYER_STATS_CHANGED, [playerId])
    this.stats = stats
    this.changedStats = changedStats
  }
  
  getData() {
    return {
      stats: this.stats,
      changedStats: this.changedStats
    }
  }
}