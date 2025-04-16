import { Vector3 } from 'three';
import { WeaponType } from './weapons';

export interface Player {
  id: string;
  displayName: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  weapon?: WeaponType;
  kills: number;
  deaths: number;
  isAlive: boolean;
}

export interface GameState {
  players: { [id: string]: Player };
  gameTime: number;
  isGameActive: boolean;
  matchId: string;
}

export interface PlayerActionData {
  position?: Vector3;
  rotation?: Vector3;
  target?: Vector3;
  direction?: Vector3;
  weaponId?: string;
  lean?: number;
  hitObstacle?: boolean;
  hitPoint?: Vector3;
  hitDistance?: number;
  damage?: number;     // Weapon damage amount
}

export type PlayerActionType = 'move' | 'jump' | 'shoot' | 'reload' | 'switchWeapon';

export interface PlayerAction {
  type: PlayerActionType;
  data: PlayerActionData;
}

export type GameMessageType = 
  | 'connect'
  | 'disconnect'
  | 'playerUpdate'
  | 'gameState'
  | 'playerAction'
  | 'setName'
  | 'error';

export interface GameMessage {
  type: GameMessageType;
  payload: PlayerAction | GameState | ErrorMessage | SetNamePayload;
  timestamp: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SetNamePayload {
  displayName: string;
} 