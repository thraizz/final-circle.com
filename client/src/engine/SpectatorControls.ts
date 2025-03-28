import * as THREE from 'three';

export class SpectatorControls {
  private camera: THREE.PerspectiveCamera;
  private moveSpeed: number = 50;
  private sprintSpeed: number = 100;
  private rotationSpeed: number = 0.002;
  
  // Movement flags
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;
  private moveUp: boolean = false;
  private moveDown: boolean = false;
  private isSprinting: boolean = false;

  // Camera rotation
  private cameraRotation = {
    x: 0, // Pitch (up/down)
    y: 0  // Yaw (left/right)
  };

  // Bound event handlers
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundContextMenu: (event: Event) => void;
  private pointerLocked: boolean = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    
    // Initialize camera position for overview
    this.camera.position.set(0, 200, 0);
    this.camera.lookAt(0, 0, 0);
    
    // Bind event handlers
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('contextmenu', this.boundContextMenu);
    
    // Set up pointer lock
    document.addEventListener('click', this.requestPointerLock.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }

  private requestPointerLock(): void {
    document.body.requestPointerLock();
  }

  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === document.body;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.pointerLocked) return;
    
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
      case 'Space':
        this.moveUp = true;
        break;
      case 'ShiftLeft':
        this.moveDown = true;
        break;
      case 'KeyR':
        this.isSprinting = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
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
      case 'Space':
        this.moveUp = false;
        break;
      case 'ShiftLeft':
        this.moveDown = false;
        break;
      case 'KeyR':
        this.isSprinting = false;
        break;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.pointerLocked) return;
    
    // Get mouse movement
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    // Update rotation values
    this.cameraRotation.y -= movementX * this.rotationSpeed;
    this.cameraRotation.x -= movementY * this.rotationSpeed;
    
    // Apply limits to vertical rotation (pitch)
    this.cameraRotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.cameraRotation.x));
    
    // Apply rotation
    const euler = new THREE.Euler(this.cameraRotation.x, this.cameraRotation.y, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  public update(deltaTime: number): void {
    if (!this.pointerLocked) return;
    
    const speed = this.isSprinting ? this.sprintSpeed : this.moveSpeed;
    const moveVector = new THREE.Vector3();
    
    // Calculate forward/backward movement
    if (this.moveForward) {
      moveVector.z -= 1;
    }
    if (this.moveBackward) {
      moveVector.z += 1;
    }
    
    // Calculate left/right movement
    if (this.moveLeft) {
      moveVector.x -= 1;
    }
    if (this.moveRight) {
      moveVector.x += 1;
    }
    
    // Calculate up/down movement
    if (this.moveUp) {
      moveVector.y += 1;
    }
    if (this.moveDown) {
      moveVector.y -= 1;
    }
    
    // Normalize movement vector
    if (moveVector.length() > 0) {
      moveVector.normalize();
    }
    
    // Apply camera rotation to movement
    moveVector.applyQuaternion(this.camera.quaternion);
    
    // Apply movement
    this.camera.position.addScaledVector(moveVector, speed * deltaTime);
  }

  public cleanup(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
  }
}