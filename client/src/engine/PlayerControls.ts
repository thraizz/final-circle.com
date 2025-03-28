import * as THREE from 'three';
import { Vector3 } from 'three';
import { PlayerAction } from '../types/game';
import { ShotInfo } from '../types/weapons';
import { WeaponSystem } from './WeaponSystem';

export class PlayerControls {
  private moveSpeed: number = 5;
  private sprintSpeed: number = 10;
  private jumpForce: number = 10;
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
  private pointerLocked: boolean = false;

  // Add new member variables for tracking rotation
  private cameraRotation = {
    x: 0, // Pitch (up/down)
    y: 0  // Yaw (left/right)
  };

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

    // Bind event handlers once
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();

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
    
    // Apply movement to velocity - use sprint speed if sprinting
    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.moveSpeed;
    this.velocity.x = PlayerControls.moveDirection.x * currentSpeed;
    this.velocity.z = PlayerControls.moveDirection.z * currentSpeed;
    
    // Apply jumping
    if (this.isJumping && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.canJump = false;
    }
    
    // Apply gravity
    this.velocity.y -= 9.8 * deltaTime;
    
    // Calculate new position
    PlayerControls.newPosition.copy(this.player.position);
    PlayerControls.newPosition.x += this.velocity.x * deltaTime;
    PlayerControls.newPosition.y += this.velocity.y * deltaTime;
    PlayerControls.newPosition.z += this.velocity.z * deltaTime;
    
    // Check for collisions
    if (!this.checkCollision(PlayerControls.newPosition)) {
      this.player.position.copy(PlayerControls.newPosition);
      
      // Reset jump state if on ground
      if (this.player.position.y <= 0.1) {
        this.player.position.y = 0.1; // Slightly above ground level
        this.velocity.y = 0;
        this.canJump = true;
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
      // Handle collision response
      // This is a simplified approach
      this.velocity.set(0, this.velocity.y, 0);
    }
    
    // Update weapon system
    this.weaponSystem.update(deltaTime);
  }

  private checkCollision(newPosition: Vector3): boolean {
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
        return true;
      }
    }
    
    return false;
  }

  public cleanup(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mousedown', this.boundMouseDown);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('click', this.boundMouseClick);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.removeEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    
    document.exitPointerLock();
    
    this.weaponSystem.cleanup();
    this.stopShooting();
  }

  public getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
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