import * as THREE from 'three';
import { ShotInfo, Weapon, WeaponState, WeaponStats, WeaponType } from '../types/weapons';

export class WeaponSystem {
  private currentWeapon: Weapon | null;
  private weaponState: WeaponState;
  private camera: THREE.PerspectiveCamera;
  private onShoot: (shot: ShotInfo) => void;

  // Reusable vectors for performance
  private static readonly FORWARD = new THREE.Vector3(0, 0, -1);
  private static readonly tempVector = new THREE.Vector3();
  private static readonly tempDirection = new THREE.Vector3();
  private static readonly tempQuaternion = new THREE.Quaternion();
  private static readonly xAxis = new THREE.Vector3(1, 0, 0);
  private static readonly yAxis = new THREE.Vector3(0, 1, 0);

  // Weapon definitions with balanced stats for competitive play
  private static readonly WEAPONS: Record<WeaponType, WeaponStats> = {
    RIFLE: {
      damage: 25,
      fireRate: 8,
      magazineSize: 30,
      reloadTime: 2.5,
      accuracy: 0.8,
      movementAccuracyPenalty: 0.2,
      recoilPattern: [
        new THREE.Vector3(0.005, 0.01, 0),
        new THREE.Vector3(0.01, 0.015, 0),
        new THREE.Vector3(0.015, 0.02, 0),
        new THREE.Vector3(0.02, 0.025, 0),
        new THREE.Vector3(0.01, 0.02, 0),
      ],
      recoilRecoverySpeed: 0.9,
      range: 100,
      bulletSpeed: 400,
    },
    SMG: {
      damage: 15,
      fireRate: 12,
      magazineSize: 25,
      reloadTime: 1.8,
      accuracy: 0.7,
      movementAccuracyPenalty: 0.1,
      recoilPattern: [
        new THREE.Vector3(0.003, 0.006, 0),
        new THREE.Vector3(0.005, 0.01, 0),
        new THREE.Vector3(0.008, 0.012, 0),
        new THREE.Vector3(0.01, 0.015, 0),
      ],
      recoilRecoverySpeed: 1.2,
      range: 50,
      bulletSpeed: 350,
    },
    PISTOL: {
      damage: 20,
      fireRate: 5,
      magazineSize: 12,
      reloadTime: 1.5,
      accuracy: 0.85,
      movementAccuracyPenalty: 0.1,
      recoilPattern: [
        new THREE.Vector3(0.01, 0.02, 0),
        new THREE.Vector3(0.02, 0.03, 0),
      ],
      recoilRecoverySpeed: 1.0,
      range: 40,
      bulletSpeed: 300,
    },
    SNIPER: {
      damage: 100,
      fireRate: 1,
      magazineSize: 5,
      reloadTime: 3,
      accuracy: 0.95,
      movementAccuracyPenalty: 0.4,
      recoilPattern: [
        new THREE.Vector3(0.02, 0.03, 0),
        new THREE.Vector3(0.03, 0.04, 0),
      ],
      recoilRecoverySpeed: 0.8,
      range: 200,
      bulletSpeed: 500,
    },
  };

  private reloadTimeout: number | null = null;
  private isMoving: boolean = false;
  private weaponMesh: THREE.Mesh | null = null;

  constructor(camera: THREE.PerspectiveCamera, onShoot: (shot: ShotInfo) => void) {
    this.camera = camera;
    this.onShoot = onShoot;
    this.currentWeapon = null;
    this.weaponState = {
      currentRecoil: new THREE.Vector3(),
      isAiming: false,
      currentAccuracy: 1.0,
    };
  }

  public equipWeapon(type: WeaponType, name: string): void {
    if (this.reloadTimeout !== null) {
      window.clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    const stats = WeaponSystem.WEAPONS[type];
    if (!stats) return;

    this.currentWeapon = {
      type,
      name,
      stats,
      currentAmmo: stats.magazineSize,
      totalAmmo: stats.magazineSize * 3,
      isReloading: false,
      lastShotTime: 0,
    };

    // Reset weapon state
    this.weaponState.currentRecoil.set(0, 0, 0);
    this.weaponState.currentAccuracy = stats.accuracy;

    // Create or update weapon model
    this.createWeaponModel(type);
  }

  private createWeaponModel(type: WeaponType): void {
    // Remove existing weapon model if any
    if (this.weaponMesh && this.weaponMesh.parent) {
      this.weaponMesh.parent.remove(this.weaponMesh);
    }

    // Create new weapon model based on type
    // This is a simplified representation
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    let position: THREE.Vector3;
    let scale: THREE.Vector3;

    switch (type) {
      case 'RIFLE':
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        material = new THREE.MeshStandardMaterial({ color: 0x444444 });
        position = new THREE.Vector3(0.3, -0.3, -0.8);
        scale = new THREE.Vector3(1, 1, 1);
        break;
      case 'SMG':
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.6);
        material = new THREE.MeshStandardMaterial({ color: 0x222222 });
        position = new THREE.Vector3(0.25, -0.25, -0.7);
        scale = new THREE.Vector3(1.2, 1, 1);
        break;
      case 'PISTOL':
        geometry = new THREE.BoxGeometry(0.07, 0.15, 0.3);
        material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        position = new THREE.Vector3(0.2, -0.2, -0.5);
        scale = new THREE.Vector3(1, 1, 1);
        break;
      case 'SNIPER':
        geometry = new THREE.BoxGeometry(0.08, 0.08, 1.2);
        material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        position = new THREE.Vector3(0.3, -0.3, -1);
        scale = new THREE.Vector3(1, 1, 1);
        break;
    }

    this.weaponMesh = new THREE.Mesh(geometry, material);
    this.weaponMesh.position.copy(position);
    this.weaponMesh.scale.copy(scale);
    
    // Add to camera to make it follow view
    this.camera.add(this.weaponMesh);
  }

  public startReload(): boolean {
    if (!this.currentWeapon || 
        this.currentWeapon.isReloading || 
        this.currentWeapon.currentAmmo === this.currentWeapon.stats.magazineSize ||
        this.currentWeapon.totalAmmo <= 0) {
      return false;
    }

    this.currentWeapon.isReloading = true;
    this.reloadTimeout = window.setTimeout(
      () => this.completeReload(),
      this.currentWeapon.stats.reloadTime * 1000
    );
    return true;
  }

  private completeReload(): void {
    if (!this.currentWeapon) return;

    const ammoNeeded = this.currentWeapon.stats.magazineSize - this.currentWeapon.currentAmmo;
    const ammoAvailable = Math.min(ammoNeeded, this.currentWeapon.totalAmmo);

    this.currentWeapon.currentAmmo += ammoAvailable;
    this.currentWeapon.totalAmmo -= ammoAvailable;
    this.currentWeapon.isReloading = false;
    this.reloadTimeout = null;
  }

  public shoot(): boolean {
    if (!this.currentWeapon || 
        this.currentWeapon.isReloading || 
        this.currentWeapon.currentAmmo <= 0) {
      return false;
    }

    const now = performance.now();
    const timeSinceLastShot = (now - this.currentWeapon.lastShotTime) / 1000;
    if (timeSinceLastShot < 1 / this.currentWeapon.stats.fireRate) {
      return false;
    }

    // Apply recoil using reusable vector
    const recoilIndex = Math.min(
      this.currentWeapon.stats.recoilPattern.length - 1,
      this.currentWeapon.stats.magazineSize - this.currentWeapon.currentAmmo
    );
    const recoil = this.currentWeapon.stats.recoilPattern[recoilIndex];
    
    // Apply recoil with more visual effect but less impact on actual aim
    // Use a fraction of the recoil for actual aiming, full amount for visual
    const visualRecoil = recoil.clone();
    const aimRecoil = recoil.clone().multiplyScalar(0.4); // Only 40% of recoil affects actual aim
    
    // Track the actual aim impact separately
    this.weaponState.currentRecoil.add(aimRecoil);

    // Apply visual recoil to camera using quaternions
    WeaponSystem.tempQuaternion.setFromAxisAngle(WeaponSystem.xAxis, visualRecoil.y);
    this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);
    
    WeaponSystem.tempQuaternion.setFromAxisAngle(WeaponSystem.yAxis, visualRecoil.x);
    this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);
    
    // Update Euler angles to match quaternion
    this.camera.rotation.setFromQuaternion(this.camera.quaternion);

    // Calculate accuracy with movement penalty
    const movementPenalty = this.isMoving ? this.currentWeapon.stats.movementAccuracyPenalty : 0;
    const aimingBonus = this.weaponState.isAiming ? 0.15 : 0;
    this.weaponState.currentAccuracy = Math.max(
      0.1,
      this.currentWeapon.stats.accuracy + aimingBonus - movementPenalty
    );

    // Calculate shot direction using reusable vectors
    WeaponSystem.tempDirection.copy(WeaponSystem.FORWARD);
    
    // Apply the camera's current rotation including recoil effects
    // This ensures the shot direction matches what the player sees
    WeaponSystem.tempDirection.applyQuaternion(this.camera.quaternion);
    
    // Add spread based on accuracy (reduced to make aiming more reliable)
    const spread = (1 - this.weaponState.currentAccuracy) * 0.07;
    WeaponSystem.tempDirection.x += (Math.random() - 0.5) * spread;
    WeaponSystem.tempDirection.y += (Math.random() - 0.5) * spread;
    WeaponSystem.tempDirection.normalize();

    // Create shot info using reusable vector
    const shotInfo: ShotInfo = {
      origin: WeaponSystem.tempVector.copy(this.camera.position),
      direction: WeaponSystem.tempDirection.clone(), // Need to clone for shot record
      weapon: this.currentWeapon,
      timestamp: now,
    };

    // Update weapon state
    this.currentWeapon.currentAmmo--;
    this.currentWeapon.lastShotTime = now;

    // Auto-reload when empty
    if (this.currentWeapon.currentAmmo === 0 && this.currentWeapon.totalAmmo > 0) {
      this.startReload();
    }

    // Create muzzle flash effect
    this.createMuzzleFlash();

    // Notify shot handler
    this.onShoot(shotInfo);
    return true;
  }

  private createMuzzleFlash(): void {
    if (!this.weaponMesh) return;

    // Create muzzle flash light
    const light = new THREE.PointLight(0xffaa00, 3, 2);
    light.position.set(0, 0, -1).add(this.weaponMesh.position);
    this.weaponMesh.add(light);

    // Remove after a short delay
    setTimeout(() => {
      if (light.parent) {
        light.parent.remove(light);
      }
    }, 50);
  }

  public update(deltaTime: number): void {
    // Update recoil recovery
    if (this.currentWeapon && this.weaponState.currentRecoil.length() > 0) {
      const recovery = this.currentWeapon.stats.recoilRecoverySpeed * deltaTime;
      
      // Track previous recoil for recovery calculation
      const previousRecoil = this.weaponState.currentRecoil.clone();
      
      // Reduce current recoil
      this.weaponState.currentRecoil.multiplyScalar(Math.max(0, 1 - recovery));

      // Calculate the actual recovery amount
      const yRecovery = previousRecoil.y - this.weaponState.currentRecoil.y;
      const xRecovery = previousRecoil.x - this.weaponState.currentRecoil.x;
      
      // Apply recoil recovery to camera at 1:1 ratio for consistent feel
      if (Math.abs(yRecovery) > 0.0001 || Math.abs(xRecovery) > 0.0001) {
        WeaponSystem.tempQuaternion.setFromAxisAngle(WeaponSystem.xAxis, -yRecovery);
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);
        
        WeaponSystem.tempQuaternion.setFromAxisAngle(WeaponSystem.yAxis, -xRecovery);
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);
        
        // Update Euler angles to match quaternion
        this.camera.rotation.setFromQuaternion(this.camera.quaternion);
      }
    }

    // Update weapon model position when aiming
    if (this.weaponMesh) {
      const targetPosition = this.weaponState.isAiming
        ? new THREE.Vector3(0, -0.2, -0.5) // Aim position
        : new THREE.Vector3(0.3, -0.3, -0.8); // Hip position

      // Smoothly interpolate to target position
      this.weaponMesh.position.lerp(targetPosition, 5 * deltaTime);
    }
  }

  public setMoving(moving: boolean): void {
    this.isMoving = moving;
  }

  public setAiming(isAiming: boolean): void {
    if (this.weaponState.isAiming !== isAiming) {
      this.weaponState.isAiming = isAiming;
      
      // Update accuracy for aiming
      if (this.currentWeapon) {
        const aimingBonus = isAiming ? 0.15 : 0;
        const movementPenalty = this.isMoving ? this.currentWeapon.stats.movementAccuracyPenalty : 0;
        this.weaponState.currentAccuracy = Math.max(
          0.1,
          this.currentWeapon.stats.accuracy + aimingBonus - movementPenalty
        );
      }
    }
  }

  public getCurrentWeapon(): Weapon | null {
    return this.currentWeapon;
  }

  public getWeaponState(): WeaponState {
    return this.weaponState;
  }

  public cleanup(): void {
    if (this.reloadTimeout !== null) {
      window.clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }
    
    // Remove weapon model
    if (this.weaponMesh && this.weaponMesh.parent) {
      this.weaponMesh.parent.remove(this.weaponMesh);
      this.weaponMesh = null;
    }
  }
} 