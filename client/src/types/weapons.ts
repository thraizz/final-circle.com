import { Vector3 } from 'three';

export type WeaponType = 'RIFLE' | 'SMG' | 'PISTOL' | 'SNIPER' | 'KNIFE';

export interface WeaponStats {
  damage: number;
  fireRate: number; // Rounds per second
  reloadTime: number; // Seconds
  magazineSize: number;
  recoilPattern: Vector3[]; // Array of recoil offsets
  recoilRecoverySpeed: number; // How fast the recoil recovers
  accuracy: number; // Base accuracy (0-1)
  movementAccuracyPenalty: number; // Accuracy penalty while moving (0-1)
  range: number; // Effective range in units
  bulletSpeed: number; // Units per second
  zoomLevel: number; // FOV when aiming (lower = more zoom)
  hasScopeOverlay: boolean; // Whether to show scope overlay when aiming
}

export interface Weapon {
  type: WeaponType;
  name: string;
  stats: WeaponStats;
  currentAmmo: number;
  totalAmmo: number;
  isReloading: boolean;
  lastShotTime: number;
}

export interface WeaponState {
  currentRecoil: Vector3;
  isAiming: boolean;
  currentAccuracy: number;
}

export interface ShotInfo {
  origin: Vector3;
  direction: Vector3;
  weapon: Weapon;
  timestamp: number;
  hitPoint?: Vector3;
  hitNormal?: Vector3;
  hitDistance?: number;
  hitObstacle?: boolean;
} 