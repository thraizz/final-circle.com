import * as THREE from 'three';
import { Vector3 } from 'three';
import { PlayerAction } from '../types/game';
import { ShotInfo, WeaponType } from '../types/weapons';
import { SoundManager } from './SoundManager';
import { WeaponSystem } from './WeaponSystem';

// Define the collision info interface
interface CollisionInfo {
  collided: boolean;
  normal?: THREE.Vector3;
  penetration?: number;
  obstacle?: THREE.Mesh;
}

export class PlayerControls {
  private moveSpeed: number = 6;
  private sprintSpeed: number = 12;
  private superSpeed: number = 30; // Super speed value
  private isSuperSpeed: boolean = false; // Super speed state
  private jumpForce: number = 6.5;
  private isJumping: boolean = false;
  private isSprinting: boolean = false;
  private velocity: Vector3 = new THREE.Vector3();
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;
  private canJump: boolean = true;
  private camera: THREE.PerspectiveCamera;
  private player: THREE.Object3D;
  private onAction: (action: PlayerAction) => void;
  private playerHeight: number = 2;
  private playerRadius: number = 0.5;
  private obstacles: THREE.Mesh[];
  private weaponSystem: WeaponSystem;
  private isMoving: boolean = false;
  private lastPosition: THREE.Vector3 = new THREE.Vector3();
  private controlsEnabled: boolean = false;
  private soundManager: SoundManager;
  private lastStepTime: number = 0;
  private stepInterval: number = 0.3; // Time between step sounds in seconds
  private wasInAir: boolean = false;
  
  // Lean properties
  private isLeaningLeft: boolean = false;
  private isLeaningRight: boolean = false;
  private currentLean: number = 0; // 0 = center, -1 = left, 1 = right
  private maxLeanAngle: number = Math.PI / 12; // 15 degrees
  private maxLeanOffset: number = 0.5; // 0.5 units horizontal offset
  private leanSpeed: number = 5; // Speed of lean transition

  // Reusable objects for performance
  private static readonly moveDirection = new THREE.Vector3();
  private static readonly newPosition = new THREE.Vector3();
  private static readonly playerBox = new THREE.Box3();
  private static readonly obstacleBox = new THREE.Box3();
  private static readonly rotationVector = new THREE.Vector3();
  private static readonly rotationEuler = new THREE.Euler();

  // Bound event handlers
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
  private boundMouseClick: (event: MouseEvent) => void;
  private boundContextMenu: (event: Event) => void;
  private boundWheel: (event: WheelEvent) => void;
  private pointerLocked: boolean = false;

  // Add new member variables for tracking rotation
  private cameraRotation = {
    x: 0, // Pitch (up/down)
    y: 0  // Yaw (left/right)
  };

  // Add inertia parameters
  private acceleration: number = 20.0; // How quickly player reaches target speed
  private friction: number = 10.0; // How quickly player slows down when not pressing movement keys

  // Add new member variables for super speed
  private shiftPressCount: number = 0; // Counter for shift presses
  private lastShiftPressTime: number = 0; // Time of last shift press
  private shiftPressTimeout: number = 1000; // Time window for shift presses (1 second)

  constructor(
    camera: THREE.PerspectiveCamera,
    player: THREE.Object3D,
    onAction: (action: PlayerAction) => void,
    obstacles: THREE.Mesh[] = []
  ) {
    this.camera = camera;
    this.player = player;
    this.onAction = onAction;
    this.obstacles = obstacles;
    this.weaponSystem = new WeaponSystem(camera, this.handleShot.bind(this));
    this.lastPosition.copy(player.position);
    this.soundManager = SoundManager.getInstance();

    // Bind event handlers once
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
    this.boundWheel = this.onWheel.bind(this);

    this.setupEventListeners();
    
    // Equip default weapon
    this.weaponSystem.equipWeapon('RIFLE', 'Default Rifle');
  }

  /**
   * Enable player controls after player ID is received
   */
  public enableControls(): void {
    console.log("Enabling player controls");
    this.controlsEnabled = true;
  }

  /**
   * Check if controls are enabled
   */
  public areControlsEnabled(): boolean {
    return this.controlsEnabled;
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mousedown', this.boundMouseDown);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('click', this.boundMouseClick);
    document.addEventListener('contextmenu', this.boundContextMenu);
    document.addEventListener('wheel', this.boundWheel);
    
    // Set up pointer lock
    document.addEventListener('click', this.requestPointerLock.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
  }
  
  private requestPointerLock(): void {
    if (!this.pointerLocked && this.controlsEnabled) {
      document.body.requestPointerLock();
    }
  }
  
  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === document.body;
  }
  
  private onPointerLockError(): void {
    console.error('Pointer lock error');
  }


  // Add a helper method to get camera rotation as Vector3
  private getCameraRotationAsVector3(): Vector3 {
    return PlayerControls.rotationVector.set(this.cameraRotation.x, this.cameraRotation.y, 0);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.pointerLocked || !this.controlsEnabled) return;
    
    const currentTime = Date.now();
    
    switch (event.code) {
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'KeyQ':
        this.isLeaningLeft = true;
        break;
      case 'KeyE':
        this.isLeaningRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (currentTime - this.lastShiftPressTime > this.shiftPressTimeout) {
          this.shiftPressCount = 0;
        }
        this.shiftPressCount++;
        this.lastShiftPressTime = currentTime;
        
        if (this.shiftPressCount >= 3) {
          this.isSuperSpeed = !this.isSuperSpeed;
          this.shiftPressCount = 0;
        }
        this.isSprinting = true;
        break;
      case 'Space':
        if (this.canJump) {
          this.isJumping = true;
          this.canJump = false;
          this.onAction({
            type: 'jump',
            data: {
              position: this.player.position,
              rotation: this.getCameraRotationAsVector3(),
            },
          });
        }
        break;
      case 'KeyR':
        this.weaponSystem.startReload();
        break;
      case 'Digit1':
        this.weaponSystem.equipWeapon('RIFLE', 'Default Rifle');
        break;
      case 'Digit2':
        this.weaponSystem.equipWeapon('SMG', 'Default SMG');
        break;
      case 'Digit3':
        this.weaponSystem.equipWeapon('PISTOL', 'Default Pistol');
        break;
      case 'Digit4':
        this.weaponSystem.equipWeapon('SNIPER', 'Default Sniper');
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!this.controlsEnabled) return;
    
    switch (event.code) {
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'KeyQ':
        this.isLeaningLeft = false;
        break;
      case 'KeyE':
        this.isLeaningRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
      case 'Space':
        this.isJumping = false;
        break;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.pointerLocked || !this.controlsEnabled) return;
    
    // Get mouse movement
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    // Update rotation values directly
    this.cameraRotation.y -= movementX * 0.002; // Reversed because camera moves opposite to mouse
    this.cameraRotation.x -= movementY * 0.002;
    
    // Apply limits to vertical rotation (pitch)
    this.cameraRotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.cameraRotation.x));
    
    // Apply rotation to player (only horizontal rotation)
    this.player.rotation.y = this.cameraRotation.y;
    this.player.quaternion.setFromEuler(this.player.rotation);
    
    // Create Euler for camera with proper rotation order
    const euler = new THREE.Euler(this.cameraRotation.x, this.cameraRotation.y, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
    this.camera.rotation.copy(euler);
    
    // Notify about rotation change
    this.onAction({
      type: 'move',
      data: {
        rotation: this.getCameraRotationAsVector3(),
      },
    });
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.pointerLocked || !this.controlsEnabled) return;
    
    if (event.button === 0) { // Left click
      this.startShooting();
    } else if (event.button === 2) { // Right click
      this.weaponSystem.setAiming(true);
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.controlsEnabled) return;
    
    if (event.button === 0) { // Left click
      this.stopShooting();
    } else if (event.button === 2) { // Right click
      this.weaponSystem.setAiming(false);
    }
  }

  private shooting: boolean = false;
  private shootingInterval: number | null = null;

  private startShooting(): void {
    this.shooting = true;
    this.shoot();
  }

  private stopShooting(): void {
    this.shooting = false;
    if (this.shootingInterval !== null) {
      clearTimeout(this.shootingInterval);
      this.shootingInterval = null;
    }
  }

  private shoot(): void {
    if (!this.shooting) return;
    
    if (this.weaponSystem.shoot()) {
      // If shot was successful, schedule next shot based on fire rate
      const currentWeapon = this.weaponSystem.getCurrentWeapon();
      if (currentWeapon) {
        const fireInterval = 1000 / currentWeapon.stats.fireRate;
        this.shootingInterval = window.setTimeout(() => this.shoot(), fireInterval);
      }
    }
  }

  private handleShot(shot: ShotInfo): void {
    // Use the actual direction from shot info which includes recoil effects
    // instead of relying on camera rotation which may not match
    this.onAction({
      type: 'shoot',
      data: {
        position: this.player.position,
        rotation: this.getCameraRotationAsVector3(),
        direction: shot.direction,
      },
    });
  }

  private onMouseClick(): void {
    // Additional click handling if needed
  }

  private onWheel(event: WheelEvent): void {
    if (!this.pointerLocked || !this.controlsEnabled) return;

    const weapons: WeaponType[] = ['RIFLE', 'SMG', 'PISTOL', 'SNIPER'];
    const currentWeapon = this.weaponSystem.getCurrentWeapon();
    
    if (!currentWeapon) return;

    const currentIndex = weapons.indexOf(currentWeapon.type);
    let newIndex: number;

    if (event.deltaY > 0) {
      // Scrolling down - next weapon
      newIndex = (currentIndex + 1) % weapons.length;
    } else {
      // Scrolling up - previous weapon
      newIndex = (currentIndex - 1 + weapons.length) % weapons.length;
    }

    this.weaponSystem.equipWeapon(weapons[newIndex], `Default ${weapons[newIndex]}`);
  }

  public update(deltaTime: number): void {
    if (!this.pointerLocked) return;
    
    // Store previous position
    this.lastPosition.copy(this.player.position);
    
    // Update leaning
    this.updateLean(deltaTime);
    
    // Calculate movement direction
    PlayerControls.moveDirection.set(0, 0, 0);
    
    if (this.moveForward) {
      PlayerControls.moveDirection.z = -1;
    }
    if (this.moveBackward) {
      PlayerControls.moveDirection.z = 1;
    }
    if (this.moveLeft) {
      PlayerControls.moveDirection.x = -1;
    }
    if (this.moveRight) {
      PlayerControls.moveDirection.x = 1;
    }
    
    // Normalize movement direction
    if (PlayerControls.moveDirection.length() > 0) {
      PlayerControls.moveDirection.normalize();
    }
    
    // Apply rotation to movement direction - use cameraRotation instead of player.rotation
    PlayerControls.moveDirection.applyEuler(
      PlayerControls.rotationEuler.set(0, this.cameraRotation.y, 0)
    );
    
    // Check if player is moving
    const wasMoving = this.isMoving;
    this.isMoving = PlayerControls.moveDirection.length() > 0;
    
    // Update weapon system movement state if changed
    if (wasMoving !== this.isMoving) {
      this.weaponSystem.setMoving(this.isMoving);
    }
    
    // Apply movement to velocity with inertia - use appropriate speed based on state
    let currentSpeed = this.moveSpeed;
    if (this.isSuperSpeed) {
      currentSpeed = this.superSpeed;
    } else if (this.isSprinting) {
      currentSpeed = this.sprintSpeed;
    }
    
    // Calculate target velocity based on input
    const targetVelocityX = PlayerControls.moveDirection.x * currentSpeed;
    const targetVelocityZ = PlayerControls.moveDirection.z * currentSpeed;
    
    // Apply acceleration or friction based on input
    if (this.isMoving) {
      // Accelerate toward target velocity
      this.velocity.x += (targetVelocityX - this.velocity.x) * Math.min(this.acceleration * deltaTime, 1.0);
      this.velocity.z += (targetVelocityZ - this.velocity.z) * Math.min(this.acceleration * deltaTime, 1.0);
    } else {
      // Apply friction to slow down when not moving
      const frictionFactor = Math.min(this.friction * deltaTime, 1.0);
      this.velocity.x *= (1 - frictionFactor);
      this.velocity.z *= (1 - frictionFactor);
      
      // Snap to zero if very small to prevent sliding forever
      if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
    }
    
    // Apply jumping - unchanged but now with lower jump force
    if (this.isJumping && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.canJump = false;
      this.wasInAir = true;
    }
    
    // Apply higher gravity for faster, more realistic falling
    this.velocity.y -= 12.0 * deltaTime; // Increased from 9.8
    
    // Calculate new position
    PlayerControls.newPosition.copy(this.player.position);
    PlayerControls.newPosition.x += this.velocity.x * deltaTime;
    PlayerControls.newPosition.y += this.velocity.y * deltaTime;
    PlayerControls.newPosition.z += this.velocity.z * deltaTime;
    
    // Check for collisions
    const collisionInfo = this.checkCollision(PlayerControls.newPosition);
    
    if (!collisionInfo.collided) {
      this.player.position.copy(PlayerControls.newPosition);
      
      // Reset jump state if on ground
      if (this.player.position.y <= 0.1) {
        this.player.position.y = 0.1; // Slightly above ground level
        this.velocity.y = 0;
        this.canJump = true;
        
        // Play impact sound when landing from a jump
        if (this.wasInAir) {
          this.soundManager.playSound('impact', 0.5);
          this.wasInAir = false;
        }
        
        // Play step sound when moving on ground
        if (this.isMoving) {
          const currentTime = performance.now() / 1000;
          if (currentTime - this.lastStepTime >= this.stepInterval) {
            this.soundManager.playSound('step', 0.3);
            this.lastStepTime = currentTime;
          }
        }
      }
      
      // Update camera position to match player position
      // The camera should be positioned at eye level
      this.camera.position.set(
        this.player.position.x + this.maxLeanOffset * this.currentLean,
        this.player.position.y + this.playerHeight * 0.8, // Eye level
        this.player.position.z
      );
      
      // Apply camera roll based on lean
      const leanRoll = -this.currentLean * this.maxLeanAngle;
      const euler = new THREE.Euler(this.cameraRotation.x, this.cameraRotation.y, leanRoll, 'YXZ');
      this.camera.quaternion.setFromEuler(euler);
      this.camera.rotation.copy(euler);
      
      // Notify about position change if significant
      if (this.lastPosition.distanceToSquared(this.player.position) > 0.001) {
        this.onAction({
          type: 'move',
          data: {
            position: this.player.position,
          },
        });
      }
    } else {
      // Handle collision response with sliding
      if (collisionInfo.normal) {
        // Calculate the component of velocity along the collision normal
        const dotProduct = this.velocity.dot(collisionInfo.normal);
        
        // Create a new velocity that removes the component in the direction of the normal
        const tempVector = new THREE.Vector3();
        tempVector.copy(collisionInfo.normal).multiplyScalar(dotProduct);
        
        // Subtract the normal component to get a sliding velocity
        this.velocity.sub(tempVector);
        
        // Apply the sliding velocity
        PlayerControls.newPosition.copy(this.player.position);
        PlayerControls.newPosition.x += this.velocity.x * deltaTime;
        // Preserve y velocity for jumping/falling
        PlayerControls.newPosition.y += this.velocity.y * deltaTime;
        PlayerControls.newPosition.z += this.velocity.z * deltaTime;
        
        // Check if the new sliding position is valid
        const slideCollision = this.checkCollision(PlayerControls.newPosition);
        if (!slideCollision.collided) {
          this.player.position.copy(PlayerControls.newPosition);
        } else {
          // If still colliding, just preserve the Y position and stop horizontal movement
          this.player.position.y += this.velocity.y * deltaTime;
          this.velocity.x = 0;
          this.velocity.z = 0;
        }
      } else {
        // Fallback to simple collision response if no normal calculated
        this.velocity.set(0, this.velocity.y, 0);
      }
    }
    
    // Update weapon system
    this.weaponSystem.update(deltaTime);
  }

  private checkCollision(newPosition: Vector3): CollisionInfo {
    // Create player bounding box
    PlayerControls.playerBox.setFromCenterAndSize(
      new THREE.Vector3(
        newPosition.x,
        newPosition.y + this.playerHeight / 2,
        newPosition.z
      ),
      new THREE.Vector3(
        this.playerRadius * 2,
        this.playerHeight,
        this.playerRadius * 2
      )
    );
    
    // Check collision with each obstacle
    for (const obstacle of this.obstacles) {
      obstacle.geometry.computeBoundingBox();
      PlayerControls.obstacleBox.copy(obstacle.geometry.boundingBox!)
        .applyMatrix4(obstacle.matrixWorld);
      
      if (PlayerControls.playerBox.intersectsBox(PlayerControls.obstacleBox)) {
        // Calculate collision normal - direction to push the player away from the obstacle
        const playerCenter = new THREE.Vector3();
        PlayerControls.playerBox.getCenter(playerCenter);
        
        const obstacleCenter = new THREE.Vector3();
        PlayerControls.obstacleBox.getCenter(obstacleCenter);
        
        // Get direction from obstacle to player
        const normal = new THREE.Vector3().subVectors(playerCenter, obstacleCenter).normalize();
        
        // Calculate penetration depth (approximation)
        const playerSize = new THREE.Vector3();
        PlayerControls.playerBox.getSize(playerSize);
        
        const obstacleSize = new THREE.Vector3();
        PlayerControls.obstacleBox.getSize(obstacleSize);
        
        // Calculate half-extents
        const playerHalfExtents = playerSize.clone().multiplyScalar(0.5);
        const obstacleHalfExtents = obstacleSize.clone().multiplyScalar(0.5);
        
        // Calculate overlap on each axis
        const deltaX = Math.abs(playerCenter.x - obstacleCenter.x);
        const deltaY = Math.abs(playerCenter.y - obstacleCenter.y);
        const deltaZ = Math.abs(playerCenter.z - obstacleCenter.z);
        
        const overlapX = playerHalfExtents.x + obstacleHalfExtents.x - deltaX;
        const overlapY = playerHalfExtents.y + obstacleHalfExtents.y - deltaY;
        const overlapZ = playerHalfExtents.z + obstacleHalfExtents.z - deltaZ;
        
        // Find the minimum overlap axis
        let penetration = overlapX;
        normal.set(Math.sign(playerCenter.x - obstacleCenter.x), 0, 0);
        
        if (overlapY < penetration) {
          penetration = overlapY;
          normal.set(0, Math.sign(playerCenter.y - obstacleCenter.y), 0);
        }
        
        if (overlapZ < penetration) {
          penetration = overlapZ;
          normal.set(0, 0, Math.sign(playerCenter.z - obstacleCenter.z));
        }
        
        return {
          collided: true,
          normal,
          penetration,
          obstacle
        };
      }
    }
    
    return { collided: false };
  }

  public cleanup(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mousedown', this.boundMouseDown);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('click', this.boundMouseClick);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    document.removeEventListener('wheel', this.boundWheel);
    document.removeEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    
    document.exitPointerLock();
    
    this.weaponSystem.cleanup();
    this.stopShooting();
  }

  public getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }

  // Add method to update obstacles dynamically
  public updateObstacles(obstacles: THREE.Mesh[]): void {
    this.obstacles = obstacles;
  }

  // Add this new method for leaning
  private updateLean(deltaTime: number): void {
    // Determine target lean value
    let targetLean = 0;
    
    if (this.isLeaningLeft && !this.isLeaningRight) {
      targetLean = -1;
    } else if (this.isLeaningRight && !this.isLeaningLeft) {
      targetLean = 1;
    }
    
    // Smoothly transition to target lean
    if (this.currentLean !== targetLean) {
      if (this.currentLean < targetLean) {
        this.currentLean = Math.min(targetLean, this.currentLean + this.leanSpeed * deltaTime);
      } else {
        this.currentLean = Math.max(targetLean, this.currentLean - this.leanSpeed * deltaTime);
      }
      
      // Notify about leaning
      this.onAction({
        type: 'move',
        data: {
          lean: this.currentLean,
          rotation: this.getCameraRotationAsVector3(),
        },
      });
    }
  }
} 