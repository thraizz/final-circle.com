import * as THREE from "three";
import {
    ShotInfo,
    Weapon,
    WeaponState,
    WeaponStats,
    WeaponType,
} from "../types/weapons";
import { SoundManager } from "./SoundManager";

export class WeaponSystem {
  private currentWeapon: Weapon | null;
  private weaponState: WeaponState;
  private camera: THREE.PerspectiveCamera;
  private onShoot: (shot: ShotInfo) => void;
  private soundManager: SoundManager;
  private weaponMesh: THREE.Object3D | null;
  private magazineMesh: THREE.Mesh | null;
  private isKnifeStriking: boolean = false;
  private knifeStrikeStartTime: number | null = null;
  private readonly KNIFE_STRIKE_DURATION = 0.3; // seconds
  private scopeOverlay: THREE.Object3D | null = null;
  private defaultFOV: number = 90;
  private currentFOV: number = 90;
  private targetFOV: number = 90;
  private readonly ZOOM_TRANSITION_SPEED = 5; // Speed of zoom transition

  // Reusable vectors for performance
  private static readonly FORWARD = new THREE.Vector3(0, 0, -1);
  private static readonly tempVector = new THREE.Vector3();
  private static readonly tempDirection = new THREE.Vector3();
  private static readonly tempQuaternion = new THREE.Quaternion();
  private static readonly xAxis = new THREE.Vector3(1, 0, 0);
  private static readonly yAxis = new THREE.Vector3(0, 1, 0);
  private static readonly raycaster = new THREE.Raycaster();

  // Weapon definitions with balanced stats for competitive play
  private static readonly WEAPONS: Record<WeaponType, WeaponStats> = {
    RIFLE: {
      damage: 25,
      fireRate: 8,
      magazineSize: 30,
      reloadTime: 1.8,
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
      zoomLevel: 60, // Moderate zoom
      hasScopeOverlay: false,
    },
    SMG: {
      damage: 15,
      fireRate: 12,
      magazineSize: 25,
      reloadTime: 1.2,
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
      zoomLevel: 70, // Light zoom
      hasScopeOverlay: false,
    },
    PISTOL: {
      damage: 20,
      fireRate: 5,
      magazineSize: 12,
      reloadTime: 1.0,
      accuracy: 0.85,
      movementAccuracyPenalty: 0.1,
      recoilPattern: [
        new THREE.Vector3(0.01, 0.02, 0),
        new THREE.Vector3(0.02, 0.03, 0),
      ],
      recoilRecoverySpeed: 1.0,
      range: 40,
      bulletSpeed: 300,
      zoomLevel: 75, // Very light zoom
      hasScopeOverlay: false,
    },
    SNIPER: {
      damage: 100,
      fireRate: 1,
      magazineSize: 5,
      reloadTime: 2.0,
      accuracy: 0.95,
      movementAccuracyPenalty: 0.4,
      recoilPattern: [
        new THREE.Vector3(0.02, 0.03, 0),
        new THREE.Vector3(0.03, 0.04, 0),
      ],
      recoilRecoverySpeed: 0.8,
      range: 200,
      bulletSpeed: 500,
      zoomLevel: 30, // Heavy zoom
      hasScopeOverlay: true,
    },
    KNIFE: {
      damage: 50,
      fireRate: 1.5,
      magazineSize: 1,
      reloadTime: 0.5,
      accuracy: 1.0,
      movementAccuracyPenalty: 0,
      recoilPattern: [new THREE.Vector3(0.01, 0.02, 0)],
      recoilRecoverySpeed: 1.5,
      range: 2,
      bulletSpeed: 0,
      zoomLevel: 90, // No zoom
      hasScopeOverlay: false,
    },
  };

  private reloadTimeout: number | null = null;
  private isMoving: boolean = false;
  private reloadAnimationStartTime: number | null = null;
  private cameraJerkEffect: THREE.Vector3 | null = null;
  private cameraJerkDecay: number = 15; // How fast the jerk effect decays
  private static readonly particleGeometry = new THREE.SphereGeometry(
    0.02,
    4,
    4
  );
  private static readonly particleMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0.8,
  });
  private lastInsertEffectTime: number = 0;
  // Pool of particle objects for reuse
  private particlePool: THREE.Mesh[] = [];

  private obstacles: THREE.Mesh[] = [];

  constructor(
    camera: THREE.PerspectiveCamera,
    onShoot: (shot: ShotInfo) => void
  ) {
    this.camera = camera;
    this.onShoot = onShoot;
    this.currentWeapon = null;
    this.weaponState = {
      currentRecoil: new THREE.Vector3(),
      isAiming: false,
      currentAccuracy: 1.0,
    };
    this.soundManager = SoundManager.getInstance();
    this.weaponMesh = null;
    this.magazineMesh = null;
    this.defaultFOV = camera.fov;
    this.currentFOV = this.defaultFOV;
    this.targetFOV = this.defaultFOV;

    // Create scope overlay
    this.createScopeOverlay();

    // Create particle pool - pre-allocate objects
    for (let i = 0; i < 3; i++) {
      const particle = new THREE.Mesh(
        WeaponSystem.particleGeometry,
        WeaponSystem.particleMaterial.clone()
      );
      particle.visible = false;
      this.particlePool.push(particle);
    }
  }

  private createScopeOverlay(): void {
    // Create a more detailed scope overlay for sniper
    const scopeGroup = new THREE.Group();
    
    // Outer ring (black border)
    const outerRingGeometry = new THREE.RingGeometry(0.35, 0.4, 32);
    const outerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    scopeGroup.add(outerRing);
    
    // Inner ring (lens)
    const innerRingGeometry = new THREE.RingGeometry(0.36, 0.39, 32);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    scopeGroup.add(innerRing);
    
    // Crosshair
    const crosshairMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    
    // Horizontal line
    const horizontalGeometry = new THREE.PlaneGeometry(0.05, 0.001);
    const horizontalLine = new THREE.Mesh(horizontalGeometry, crosshairMaterial);
    scopeGroup.add(horizontalLine);
    
    // Vertical line
    const verticalGeometry = new THREE.PlaneGeometry(0.001, 0.05);
    const verticalLine = new THREE.Mesh(verticalGeometry, crosshairMaterial);
    scopeGroup.add(verticalLine);
    
    // Distance markers
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    });
    
    // Add distance markers at 12, 3, 6, and 9 o'clock positions
    const markerPositions = [
      { x: 0, y: 0.38, rot: 0 },    // 12 o'clock
      { x: 0.38, y: 0, rot: Math.PI/2 }, // 3 o'clock
      { x: 0, y: -0.38, rot: Math.PI },  // 6 o'clock
      { x: -0.38, y: 0, rot: -Math.PI/2 } // 9 o'clock
    ];
    
    markerPositions.forEach(pos => {
      const markerGeometry = new THREE.PlaneGeometry(0.02, 0.005);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(pos.x, pos.y, 0);
      marker.rotation.z = pos.rot;
      scopeGroup.add(marker);
    });
    
    // Position the scope overlay in front of the camera
    scopeGroup.position.z = -1;
    
    this.scopeOverlay = scopeGroup;
    this.scopeOverlay.visible = false;
    this.camera.add(this.scopeOverlay);
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
    let magazineGeometry: THREE.BufferGeometry;
    let magazinePosition: THREE.Vector3;

    // Variables for knife model
    let knifeGroup: THREE.Group;
    let blade: THREE.Mesh;
    let handle: THREE.Mesh;
    let bladeGeometry: THREE.BufferGeometry;
    let bladeMaterial: THREE.Material;
    let handleGeometry: THREE.BufferGeometry;
    let handleMaterial: THREE.Material;

    switch (type) {
      case "RIFLE":
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        material = new THREE.MeshStandardMaterial({ color: 0x444444 });
        position = new THREE.Vector3(0.3, -0.3, -0.8);
        scale = new THREE.Vector3(1, 1, 1);
        magazineGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.1);
        magazinePosition = new THREE.Vector3(0, -0.1, 0.1);
        break;
      case "SMG":
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.6);
        material = new THREE.MeshStandardMaterial({ color: 0x222222 });
        position = new THREE.Vector3(0.25, -0.25, -0.7);
        scale = new THREE.Vector3(1.2, 1, 1);
        magazineGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.08);
        magazinePosition = new THREE.Vector3(0, -0.1, 0.05);
        break;
      case "PISTOL":
        geometry = new THREE.BoxGeometry(0.07, 0.15, 0.3);
        material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        position = new THREE.Vector3(0.2, -0.2, -0.5);
        scale = new THREE.Vector3(1, 1, 1);
        magazineGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.06);
        magazinePosition = new THREE.Vector3(0, -0.1, 0);
        break;
      case "SNIPER":
        geometry = new THREE.BoxGeometry(0.08, 0.08, 1.2);
        material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        position = new THREE.Vector3(0.3, -0.3, -1);
        scale = new THREE.Vector3(1, 1, 1);
        magazineGeometry = new THREE.BoxGeometry(0.1, 0.16, 0.1);
        magazinePosition = new THREE.Vector3(0, -0.1, 0.2);
        break;
      case "KNIFE":
        // Create a knife model with blade and handle
        knifeGroup = new THREE.Group();

        // Blade
        bladeGeometry = new THREE.BoxGeometry(0.02, 0.05, 0.3); // Swapped width and height
        bladeMaterial = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.8,
          roughness: 0.2,
        });
        blade = new THREE.Mesh(bladeGeometry, bladeMaterial);

        // Handle
        handleGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.15);
        handleMaterial = new THREE.MeshStandardMaterial({
          color: 0x333333,
          metalness: 0.2,
          roughness: 0.8,
        });
        handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.z = 0.225; // Position handle in front of blade

        // Add parts to group
        knifeGroup.add(blade);
        knifeGroup.add(handle);

        // Position the knife in the player's hand
        knifeGroup.position.set(0.3, -0.2, -0.5);
        knifeGroup.rotation.set(0, Math.PI * 1.75, 0); // Rotate 315 degrees around Y axis

        // Set the weapon mesh to the knife group
        this.weaponMesh = knifeGroup;

        // No magazine for knife
        this.magazineMesh = null;

        // Add to camera to make it follow view
        this.camera.add(this.weaponMesh);
        return; // Return early as we've already set up the weapon mesh
    }

    this.weaponMesh = new THREE.Mesh(geometry, material);
    this.weaponMesh.position.copy(position);
    this.weaponMesh.scale.copy(scale);

    // Create magazine
    const magazineMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
    });
    this.magazineMesh = new THREE.Mesh(magazineGeometry, magazineMaterial);
    this.magazineMesh.position.copy(magazinePosition);
    this.weaponMesh.add(this.magazineMesh);

    // Add to camera to make it follow view
    this.camera.add(this.weaponMesh);
  }

  public startReload(): boolean {
    if (
      !this.currentWeapon ||
      this.currentWeapon.isReloading ||
      this.currentWeapon.type === "KNIFE" ||
      this.currentWeapon.currentAmmo ===
        this.currentWeapon.stats.magazineSize ||
      this.currentWeapon.totalAmmo <= 0
    ) {
      return false;
    }

    this.currentWeapon.isReloading = true;
    this.reloadAnimationStartTime = performance.now();
    this.reloadTimeout = window.setTimeout(
      () => this.completeReload(),
      this.currentWeapon.stats.reloadTime * 1000
    );

    // Play reload sound
    this.soundManager.playSound(
      `${this.currentWeapon.type.toLowerCase()}_reload`
    );

    // Add start reload camera jerk effect
    this.applyCameraJerkEffect(0.02, 0.01);

    return true;
  }

  private completeReload(): void {
    if (!this.currentWeapon) return;

    const ammoNeeded =
      this.currentWeapon.stats.magazineSize - this.currentWeapon.currentAmmo;
    const ammoAvailable = Math.min(ammoNeeded, this.currentWeapon.totalAmmo);

    this.currentWeapon.currentAmmo += ammoAvailable;
    this.currentWeapon.totalAmmo -= ammoAvailable;
    this.currentWeapon.isReloading = false;
    this.reloadTimeout = null;
    this.reloadAnimationStartTime = null;

    // Add completion reload camera jerk effect
    this.applyCameraJerkEffect(0.015, 0.02);
  }

  // Apply a quick jerk effect to the camera - optimized
  private applyCameraJerkEffect(x: number, y: number): void {
    // Less intense jerk effect to reduce visual impact and performance cost
    const randomX = (Math.random() - 0.5) * 2 * x * 0.8;
    const randomY = -Math.abs(y) * 0.8;

    this.cameraJerkEffect = new THREE.Vector3(randomX, randomY, 0);

    // Apply initial jerk directly without extra operations
    this.camera.rotation.x += this.cameraJerkEffect.y;
    this.camera.rotation.y += this.cameraJerkEffect.x;
  }

  private isKnifeWeapon(weapon: Weapon): weapon is Weapon & { type: 'KNIFE' } {
    return weapon.type === 'KNIFE';
  }

  public updateObstacles(obstacles: THREE.Mesh[]): void {
    this.obstacles = obstacles;
    console.log(`WeaponSystem: Updated obstacles, count=${obstacles.length}`);
    
    // Log the first few obstacles with their positions for debugging
    if (obstacles.length > 0) {
      for (let i = 0; i < Math.min(3, obstacles.length); i++) {
        const pos = new THREE.Vector3();
        obstacles[i].getWorldPosition(pos);
        console.log(`Obstacle ${i}: Position (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}), Name: ${obstacles[i].name || 'unnamed'}`);
      }
    }
  }

  /**
   * Performs a raycast to check if there's any obstacle between the origin and the target direction
   * @param origin The starting point of the ray
   * @param direction The direction of the ray
   * @param maxDistance Maximum distance to check for obstacles
   * @returns Information about the hit or null if no obstacle was hit
   */
  private checkRaycastCollision(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number
  ): THREE.Intersection | null {
    // Set up the raycaster
    WeaponSystem.raycaster.set(origin, direction);
    WeaponSystem.raycaster.far = maxDistance;
    
    // Perform the raycast against obstacles
    const intersections = WeaponSystem.raycaster.intersectObjects(this.obstacles, true);
    
    // Return the first intersection if any
    return intersections.length > 0 ? intersections[0] : null;
  }

  public shoot(): boolean {
    if (
      !this.currentWeapon ||
      this.currentWeapon.isReloading ||
      (!this.isKnifeWeapon(this.currentWeapon) &&
        this.currentWeapon.currentAmmo <= 0)
    ) {
      return false;
    }

    const now = performance.now();
    const timeSinceLastShot = (now - this.currentWeapon.lastShotTime) / 1000;
    if (timeSinceLastShot < 1 / this.currentWeapon.stats.fireRate) {
      return false;
    }

    // Start knife strike animation if it's a knife
    if (this.isKnifeWeapon(this.currentWeapon)) {
      this.isKnifeStriking = true;
      this.knifeStrikeStartTime = now;
      
      // Play melee sound instead of regular shot sound
      this.soundManager.playSound("melee_shot");
      
      // Create shot info for melee attack
      const shotInfo: ShotInfo = {
        origin: WeaponSystem.tempVector.copy(this.camera.position),
        direction: WeaponSystem.tempDirection.copy(WeaponSystem.FORWARD).applyQuaternion(this.camera.quaternion),
        weapon: this.currentWeapon,
        timestamp: now,
      };
      
      // Notify shot handler
      this.onShoot(shotInfo);
      
      // Update last shot time
      this.currentWeapon.lastShotTime = now;
      return true;
    }

    // Play weapon sound for non-knife weapons
    this.soundManager.playSound(
      `${this.currentWeapon.type.toLowerCase()}_shot`
    );

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
    WeaponSystem.tempQuaternion.setFromAxisAngle(
      WeaponSystem.xAxis,
      visualRecoil.y
    );
    this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

    WeaponSystem.tempQuaternion.setFromAxisAngle(
      WeaponSystem.yAxis,
      visualRecoil.x
    );
    this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

    // Update Euler angles to match quaternion
    this.camera.rotation.setFromQuaternion(this.camera.quaternion);

    // Calculate accuracy with movement penalty
    const movementPenalty = this.isMoving
      ? this.currentWeapon.stats.movementAccuracyPenalty
      : 0;
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

    // Check for collisions with obstacles using raycasting
    const origin = WeaponSystem.tempVector.copy(this.camera.position);
    const raycastHit = this.checkRaycastCollision(
      origin,
      WeaponSystem.tempDirection,
      this.currentWeapon.stats.range
    );
    
    // Create visual hit effect at the point of impact
    if (raycastHit) {
      this.createHitEffect(raycastHit.point, raycastHit.face?.normal);
    }

    // Create shot info using reusable vector
    const shotInfo: ShotInfo = {
      origin: origin.clone(), // Clone for shot record
      direction: WeaponSystem.tempDirection.clone(), // Clone for shot record
      weapon: this.currentWeapon,
      timestamp: now,
      hitPoint: raycastHit ? raycastHit.point.clone() : undefined,
      hitNormal: raycastHit && raycastHit.face ? raycastHit.face.normal.clone() : undefined,
      hitDistance: raycastHit ? raycastHit.distance : undefined,
      hitObstacle: raycastHit ? true : false,
    };
    
    // Update weapon state
    if (this.currentWeapon.type !== "KNIFE") {
      this.currentWeapon.currentAmmo--;
    }
    this.currentWeapon.lastShotTime = now;

    // Auto-reload when empty (only for non-knife weapons)
    if (
      this.currentWeapon.type !== "KNIFE" &&
      this.currentWeapon.currentAmmo === 0 &&
      this.currentWeapon.totalAmmo > 0
    ) {
      this.startReload();
    }

    // Create muzzle flash effect
    this.createMuzzleFlash();

    // Notify shot handler
    this.onShoot(shotInfo);
    return true;
  }

  private createHitEffect(position: THREE.Vector3, normal?: THREE.Vector3): void {
    // Create a small particle effect at the hit position
    const hitParticle = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 1.0,
      })
    );
    
    // Position at the hit point
    hitParticle.position.copy(position);
    
    // If we have a normal, offset slightly to avoid z-fighting
    if (normal) {
      hitParticle.position.addScaledVector(normal, 0.01);
    }
    
    // Add to the scene
    this.camera.parent?.add(hitParticle);
    
    // Animate the particle effect
    let progress = 0;
    const animateHit = () => {
      progress += 0.05;
      if (progress >= 1) {
        hitParticle.parent?.remove(hitParticle);
        return;
      }
      
      hitParticle.scale.set(1 + progress, 1 + progress, 1 + progress);
      (hitParticle.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
      
      requestAnimationFrame(animateHit);
    };
    
    animateHit();
  }

  private createMuzzleFlash(): void {
    if (!this.weaponMesh) return;

    if (this.currentWeapon?.type === "KNIFE") {
      // Create a diagonal slash effect
      const slashGeometry = new THREE.PlaneGeometry(0.4, 0.08);
      const slashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });

      const slashMesh = new THREE.Mesh(slashGeometry, slashMaterial);
      slashMesh.position.set(0.1, 0.1, -0.8); // Position for diagonal slash
      // slashMesh.rotation.set(0, 0, -Math.PI / 4); // 45-degree diagonal
      this.weaponMesh.add(slashMesh);

      // Animate the slash effect
      let progress = 0;
      const animateSlash = () => {
        progress += 0.1;
        if (progress >= 1) {
          if (slashMesh.parent) {
            slashMesh.parent.remove(slashMesh);
          }
          return;
        }

        // Move the slash diagonally
        slashMesh.position.x -= 0.02;
        slashMesh.position.y -= 0.02;
        slashMaterial.opacity = 0.6 * (1 - progress);

        requestAnimationFrame(animateSlash);
      };

      animateSlash();
      return;
    } else {
      // Create muzzle flash light
      const light = new THREE.PointLight(0xffaa00, 5, 2); // Increased intensity
      light.position.set(0, 0, -1).add(this.weaponMesh.position);
      this.weaponMesh.add(light);

      // Create visible muzzle flash mesh - cone shape pointing forward
      const flashGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
      const flashMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00, // Brighter yellow
        transparent: true,
        opacity: 0.9,
        emissive: 0xffaa00,
        emissiveIntensity: 2.0,
      });

      const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
      // Position at the end of the weapon and rotate to point forward
      flashMesh.position.set(0, 0, -1.05).add(this.weaponMesh.position);
      flashMesh.rotation.x = -Math.PI / 2; // Rotate to point forward
      this.weaponMesh.add(flashMesh);

      // Add small bright core at the center
      const coreGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pure white
        transparent: true,
        opacity: 1.0,
        emissive: 0xffffff,
        emissiveIntensity: 3.0,
      });

      const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
      coreMesh.position.copy(flashMesh.position);
      this.weaponMesh.add(coreMesh);

      // Remove after a short delay
      setTimeout(() => {
        if (light.parent) {
          light.parent.remove(light);
        }
        if (flashMesh.parent) {
          flashMesh.parent.remove(flashMesh);
        }
        if (coreMesh.parent) {
          coreMesh.parent.remove(coreMesh);
        }
      }, 50);
    }
  }

  public update(deltaTime: number): void {
    // Update camera jerk effect - optimize this code
    if (this.cameraJerkEffect && this.cameraJerkEffect.length() > 0.0001) {
      // Apply camera jerk recovery
      const recovery = Math.min(1, this.cameraJerkDecay * deltaTime);

      // Reduce jerk effect over time - simplified calculation
      this.cameraJerkEffect.multiplyScalar(Math.max(0, 1 - recovery));

      // Apply recovery only if effect is significant enough
      if (this.cameraJerkEffect.length() > 0.001) {
        // Apply smooth recovery directly without redundant calculations
        WeaponSystem.tempQuaternion.setFromAxisAngle(
          WeaponSystem.xAxis,
          -this.cameraJerkEffect.y * recovery
        );
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

        WeaponSystem.tempQuaternion.setFromAxisAngle(
          WeaponSystem.yAxis,
          -this.cameraJerkEffect.x * recovery
        );
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

        this.camera.rotation.setFromQuaternion(this.camera.quaternion);
      } else {
        // Clear effect when it's small enough
        this.cameraJerkEffect = null;
      }
    }

    // Update knife strike animation
    if (
      this.isKnifeStriking &&
      this.knifeStrikeStartTime !== null &&
      this.weaponMesh &&
      this.currentWeapon?.type === "KNIFE"
    ) {
      const elapsedTime =
        (performance.now() - this.knifeStrikeStartTime) / 1000;
      const progress = Math.min(elapsedTime / this.KNIFE_STRIKE_DURATION, 1);

      // Simple diagonal slash from top right to bottom left

      // Start from top right, move to bottom left
      const startX = 0.4; // Start further right
      const startY = -0.1; // Start higher
      const endX = 0.2; // End more left
      const endY = -0.3; // End lower

      // Linear interpolation for position
      const currentX = startX + (endX - startX) * progress;
      const currentY = startY + (endY - startY) * progress;

      // Apply the strike animation
      this.weaponMesh.position.set(
        currentX,
        currentY,
        -0.5 // Keep Z position constant
      );


      // End the strike animation
      if (progress >= 1) {
        this.isKnifeStriking = false;
        this.knifeStrikeStartTime = null;
        // Keep the knife in its final position after the strike
        // No need to reset position or rotation
      }
    }

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
        WeaponSystem.tempQuaternion.setFromAxisAngle(
          WeaponSystem.xAxis,
          -yRecovery
        );
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

        WeaponSystem.tempQuaternion.setFromAxisAngle(
          WeaponSystem.yAxis,
          -xRecovery
        );
        this.camera.quaternion.multiply(WeaponSystem.tempQuaternion);

        // Update Euler angles to match quaternion
        this.camera.rotation.setFromQuaternion(this.camera.quaternion);
      }
    }

    // Update weapon model position when aiming or reloading
    if (this.weaponMesh && !this.isKnifeStriking) {
      // Don't interfere with knife strike animation
      let targetPosition;
      const targetRotation = new THREE.Euler(0, 0, 0);

      if (
        this.currentWeapon?.isReloading &&
        this.reloadAnimationStartTime !== null
      ) {
        // Calculate reload progress (0 to 1)
        const elapsedTime =
          (performance.now() - this.reloadAnimationStartTime) / 1000;
        const reloadDuration = this.currentWeapon.stats.reloadTime;
        const progress = Math.min(elapsedTime / reloadDuration, 1);

        // Animate the magazine during reload - optimize animation
        if (this.magazineMesh) {
          // Simplified animation with fewer phase calculations
          if (progress < 0.4) {
            // Magazine moving out - dropping down and rotating
            const dropProgress = progress / 0.4;
            this.magazineMesh.position.y =
              this.getMagazineOriginForWeapon(this.currentWeapon.type).y -
              dropProgress * 0.3;
            this.magazineMesh.rotation.x = dropProgress * 0.2;
            this.magazineMesh.visible = true;
          } else if (progress < 0.6) {
            // Magazine out - not visible
            this.magazineMesh.visible = false;
          } else {
            // New magazine coming in - simplified calculation
            const insertProgress = (progress - 0.6) / 0.4;
            this.magazineMesh.position.y =
              this.getMagazineOriginForWeapon(this.currentWeapon.type).y -
              (1 - insertProgress) * 0.3;
            this.magazineMesh.rotation.x = (1 - insertProgress) * 0.2;
            this.magazineMesh.visible = true;

            // Less frequent effect creation - only run once at 85% completion
            if (insertProgress > 0.84 && insertProgress < 0.87) {
              this.createMagazineInsertEffect();
            }
          }
        }

        // Create reload animation based on weapon type - simplified animations
        switch (this.currentWeapon.type) {
          case "RIFLE":
          case "SMG": {
            // Simplified reload animation
            targetPosition = new THREE.Vector3(0.4, -0.1, -0.6);
            // Use simpler sin calculation
            const tiltAmount = Math.sin(progress * Math.PI) * 0.5;
            targetRotation.z = tiltAmount;
            targetRotation.x = tiltAmount * 0.2; // Reduced from 0.3
            break;
          }
          case "PISTOL":
            targetPosition = new THREE.Vector3(0.4, -0.4, -0.6);
            targetRotation.z = Math.sin(progress * Math.PI) * 0.25; // Reduced from 0.3
            break;
          case "SNIPER":
            targetPosition = new THREE.Vector3(0.5, -0.3, -0.7);
            targetRotation.z = Math.sin(progress * Math.PI) * 0.3; // Reduced from 0.4
            targetRotation.y = Math.sin(progress * Math.PI) * 0.15; // Reduced from 0.2
            break;
          default:
            targetPosition = new THREE.Vector3(0.3, -0.3, -0.8);
            break;
        }
      } else {
        // Regular aiming/hip position
        targetPosition = this.weaponState.isAiming
          ? new THREE.Vector3(0, -0.2, -0.5) // Aim position
          : new THREE.Vector3(0.3, -0.3, -0.8); // Hip position
      }

      // Less aggressive interpolation (reduced from 5 to 4)
      const lerpFactor = 4 * deltaTime;
      this.weaponMesh.position.lerp(targetPosition, lerpFactor);

      // Smoother rotation with less aggressive interpolation
      this.weaponMesh.rotation.x +=
        (targetRotation.x - this.weaponMesh.rotation.x) * lerpFactor;
      this.weaponMesh.rotation.y +=
        (targetRotation.y - this.weaponMesh.rotation.y) * lerpFactor;
      this.weaponMesh.rotation.z +=
        (targetRotation.z - this.weaponMesh.rotation.z) * lerpFactor;
    }

    // Update zoom transition
    if (Math.abs(this.currentFOV - this.targetFOV) > 0.1) {
      this.currentFOV += (this.targetFOV - this.currentFOV) * this.ZOOM_TRANSITION_SPEED * deltaTime;
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
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
        const movementPenalty = this.isMoving
          ? this.currentWeapon.stats.movementAccuracyPenalty
          : 0;
        this.weaponState.currentAccuracy = Math.max(
          0.1,
          this.currentWeapon.stats.accuracy + aimingBonus - movementPenalty
        );

        // Update zoom level
        this.targetFOV = isAiming ? this.currentWeapon.stats.zoomLevel : this.defaultFOV;

        // Show/hide scope overlay for sniper
        if (this.scopeOverlay) {
          this.scopeOverlay.visible = isAiming && this.currentWeapon.stats.hasScopeOverlay;
        }
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

    this.reloadAnimationStartTime = null;
    this.cameraJerkEffect = null;

    // Clean up particle pool
    this.particlePool.forEach((particle) => {
      if (particle.parent) {
        particle.parent.remove(particle);
      }
    });

    // Remove weapon model
    if (this.weaponMesh && this.weaponMesh.parent) {
      this.weaponMesh.parent.remove(this.weaponMesh);
      this.weaponMesh = null;
      this.magazineMesh = null;
    }
  }

  // Helper method to get original magazine position based on weapon type
  private getMagazineOriginForWeapon(type: WeaponType): THREE.Vector3 {
    switch (type) {
      case "RIFLE":
        return new THREE.Vector3(0, -0.1, 0.1);
      case "SMG":
        return new THREE.Vector3(0, -0.1, 0.05);
      case "PISTOL":
        return new THREE.Vector3(0, -0.1, 0);
      case "SNIPER":
        return new THREE.Vector3(0, -0.1, 0.2);
      case "KNIFE":
        return new THREE.Vector3(0, 0, 0); // Knife doesn't have a magazine
      default:
        return new THREE.Vector3(0, -0.1, 0);
    }
  }

  // Create a visual effect when inserting a new magazine
  private createMagazineInsertEffect(): void {
    if (!this.weaponMesh || !this.magazineMesh) return;

    // Throttle effect to prevent multiple calls in short succession
    const now = performance.now();
    if (now - this.lastInsertEffectTime < 250) return; // Increased throttle time
    this.lastInsertEffectTime = now;

    // Create a more visible light effect since we're not changing magazine color
    const light = new THREE.PointLight(0x66aaff, 1.5, 0.5);
    light.position.copy(this.magazineMesh.position);
    this.weaponMesh.add(light);

    // Remove magazine glow effect completely - magazine should stay the original color

    // Use more particles to compensate for removed magazine glow
    const particleCount = 2; // Always use 2 particles

    for (let i = 0; i < particleCount; i++) {
      if (i >= this.particlePool.length) break;

      const particle = this.particlePool[i];
      if (!particle.parent) {
        this.weaponMesh.add(particle);
      }

      // Reset particle state
      particle.visible = true;
      const material = particle.material as THREE.MeshBasicMaterial;
      material.opacity = 0.9; // Slightly more visible

      // Position around the magazine
      particle.position.copy(this.magazineMesh.position);
      particle.position.x += (Math.random() - 0.5) * 0.05;
      particle.position.y += (Math.random() - 0.5) * 0.05;
      particle.position.z += (Math.random() - 0.5) * 0.05;

      // More distinctive particle movement
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        0.025 + Math.random() * 0.015, // More noticeable upward movement
        (Math.random() - 0.5) * 0.03
      );

      // Animation frames
      let frameCount = 0;
      const maxFrames = 12; // Slightly longer animation

      const animateParticle = () => {
        if (frameCount >= maxFrames || !particle.parent) {
          particle.visible = false;
          return;
        }

        // Move particle
        particle.position.add(direction);

        // Fade out
        material.opacity = 0.9 * (1 - frameCount / maxFrames);

        // Continue animation
        frameCount++;
        setTimeout(animateParticle, 20);
      };

      // Start animation
      animateParticle();
    }

    // Add a small flash effect at magazine position
    const flashGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0.7,
    });

    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(this.magazineMesh.position);
    this.weaponMesh.add(flashMesh);

    // Animate flash expanding and fading
    let flashScale = 1.0;
    let flashOpacity = 0.7;

    const animateFlash = () => {
      if (flashOpacity <= 0.05 || !flashMesh.parent) {
        if (flashMesh.parent) {
          flashMesh.parent.remove(flashMesh);
        }
        return;
      }

      // Expand and fade
      flashScale += 0.15;
      flashOpacity -= 0.1;

      flashMesh.scale.set(flashScale, flashScale, flashScale);
      flashMaterial.opacity = flashOpacity;

      setTimeout(animateFlash, 16);
    };

    // Start flash animation
    setTimeout(animateFlash, 10);

    // Remove light after a short delay
    setTimeout(() => {
      if (light.parent) {
        light.parent.remove(light);
      }
    }, 150);
  }
}
