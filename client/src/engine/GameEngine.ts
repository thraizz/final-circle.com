import * as THREE from 'three';
import { BACKEND } from '../config';
import { ErrorMessage, GameState, PlayerAction } from '../types/game';
import { GameMap } from './GameMap';
import { HUD, HUDConfig } from './HUD';
import { LODManager } from './LODManager';
import { MedipackSystem } from './MedipackSystem';
import { PlayerControls } from './PlayerControls';
import { SoundManager } from './SoundManager';
import { SpectatorControls } from './SpectatorControls';

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private socket!: WebSocket;
  private gameState: GameState;
  private lastFrameTime: number;
  private isRunning: boolean;
  private playerId: string | null;
  private playerName: string;
  private player: THREE.Object3D;
  private playerControls: PlayerControls;
  private spectatorControls: SpectatorControls | null = null;
  private isSpectatorMode: boolean = false;
  private players: Map<string, THREE.Object3D>;
  private gameMap: GameMap;
  private hud: HUD;
  private medipackSystem: MedipackSystem;
  private maxPlayerHealth: number = 100;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private connectionReady: boolean = false;
  public socketReconnecting: boolean = false;
  private pingInterval: number | null = null;
  private previousKills: number = 0;
  
  // Performance optimizations
  private playerGeometry: THREE.BoxGeometry;
  private playerMaterial: THREE.MeshLambertMaterial;
  private boundHandleResize: () => void;
  private boundHandleKeyDown: (event: KeyboardEvent) => void;
  private lastObstacleUpdate: number = 0;
  private obstacleUpdateInterval: number = 1000; // Update obstacles every 1 second
  private playerPositions: Map<string, { x: number, y: number, z: number }> = new Map();
  private playerRotations: Map<string, { x: number, y: number, z: number }> = new Map();
  
  // Level of Detail management
  private lodManager: LODManager;

  constructor(hudConfig?: Partial<HUDConfig>, playerName: string = 'Player') {
    // Store player name
    this.playerName = playerName;
    console.log(`Initializing game engine for player: ${this.playerName}`);
    
    // Scene setup
    this.scene = new THREE.Scene();
    
    // Skybox setup with background color too
    this.scene.background = new THREE.Color(0x87CEEB); // Set a blue background as fallback
    
    // Sky dome using simple geometry
    const skyGeo = new THREE.SphereGeometry(900, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87CEEB, // Sky blue color
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
    
    // Add fog to create depth
    this.scene.fog = new THREE.Fog(0xccccff, 500, 900);
    
    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000 // Increase far clipping plane to see the sky
    );
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);
    
    // Initialize sound manager
    const soundManager = SoundManager.getInstance();
    soundManager.initialize(this.camera);

    // Load all sounds
    Promise.all([
      soundManager.loadSound('rifle_shot', '/assets/sounds/rifle_shot.wav'),
      soundManager.loadSound('smg_shot', '/assets/sounds/smg_shot.wav'),
      soundManager.loadSound('pistol_shot', '/assets/sounds/pistol_shot.wav'),
      soundManager.loadSound('sniper_shot', '/assets/sounds/sniper_shot.wav'),
      soundManager.loadSound('rifle_reload', '/assets/sounds/rifle_reload.wav'),
      soundManager.loadSound('smg_reload', '/assets/sounds/smg_reload.wav'),
      soundManager.loadSound('pistol_reload', '/assets/sounds/pistol_reload.wav'),
      soundManager.loadSound('sniper_reload', '/assets/sounds/sniper_reload.wav'),
      soundManager.loadSound('player_death', '/assets/sounds/player_death.mp3'),
      soundManager.loadSound('player_kill', '/assets/sounds/player_kill.wav'),
      soundManager.loadSound('step', '/assets/sounds/step_sound.wav'),
      soundManager.loadSound('impact', '/assets/sounds/impact_sound.wav'),
      soundManager.loadSound('melee_shot', '/assets/sounds/melee_shot.wav'),
    ]).catch(error => {
      console.error('Error loading sounds:', error);
    });
    
    // Renderer setup with optimizations
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      stencil: false,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Game state setup
    this.gameState = {
      players: {},
      gameTime: 0,
      isGameActive: false,
      matchId: '',
    };

    // Player setup
    this.player = new THREE.Object3D();
    this.scene.add(this.player);
    this.scene.add(this.camera);
    
    // Set initial camera position at player's eye level
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y + 1.6, // Eye level (1.6 units high)
      this.player.position.z
    );
    
    // Ensure camera rotation matches player rotation
    this.camera.rotation.y = this.player.rotation.y;
    
    this.players = new Map();

    // Game map setup
    this.gameMap = new GameMap(this.scene, this.renderer);

    // Player controls setup with obstacles from the map
    this.playerControls = new PlayerControls(
      this.camera,
      this.player,
      this.handlePlayerAction.bind(this),
      this.gameMap.getObstacles()
    );

    // Initialize medipack system
    this.medipackSystem = new MedipackSystem(this.scene);
    
    // Setup medipacks at predetermined locations
    this.setupMedipacks();

    // Initialize LOD manager for draw distance optimization
    this.lodManager = new LODManager(this.scene, this.camera, {
      maxDrawDistance: 1000,
      updateInterval: 300  // Update LOD every 300ms for better responsiveness
    });
    
    // Register scene objects with the LOD manager
    this.registerObjectsWithLODManager();

    // HUD setup
    this.hud = new HUD(hudConfig);

    // Network setup - use WebSocket
    this.setupWebSocket();

    // Game loop setup
    this.lastFrameTime = performance.now();
    this.isRunning = false;
    this.playerId = null;

    // Performance optimizations - create shared geometry and material
    this.playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    this.playerMaterial = new THREE.MeshLambertMaterial({
      color: 0xff0000 // Default color, will be changed per player
    });
    
    // Bind event handlers once
    this.boundHandleResize = this.handleResize.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    
    // Event listeners
    this.setupEventListeners();
  }

  private setupWebSocket(): void {
    const wsURL = BACKEND.WS_URL;
    console.log(`Attempting WebSocket connection to: ${wsURL}`);
    
    this.socket = new WebSocket(wsURL);
    
    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      this.connectionReady = true;
      this.socketReconnecting = false;
      this.reconnectAttempts = 0;
      this.hud.showConnectionStatus('Connected');
      
      // Setup ping interval to keep connection alive
      this.pingInterval = window.setInterval(() => {
        if (this.socket.readyState === WebSocket.OPEN) {
          // Send a ping message
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Send ping every 30 seconds
      
      // Clear connection status after 3 seconds
      setTimeout(() => {
        this.hud.hideConnectionStatus();
      }, 3000);
    };
    
    this.socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
      this.connectionReady = false;
      
      // Clear ping interval
      if (this.pingInterval !== null) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      this.handleError({
        code: 'NETWORK_ERROR',
        message: `Lost connection to server: ${event.reason || 'Connection closed'}`,
      });
      
      this.hud.showConnectionStatus('Disconnected. Attempting to reconnect...');
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.socketReconnecting = true;
        this.hud.showConnectionStatus(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          this.setupWebSocket();
        }, 2000); // Reconnect after 2 seconds
      } else {
        this.socketReconnecting = false;
        this.hud.showConnectionStatus('Connection failed. Please refresh the page.');
      }
    };
    
    this.socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.handleError({
        code: 'CONNECTION_ERROR',
        message: 'Failed to connect to game server',
      });
    };
    
    this.socket.onmessage = (event) => {
      try {
        const messages = event.data.split('\n');
        
        for (const message of messages) {
          if (!message) continue;
          
          const data = JSON.parse(message);
          this.handleServerMessage(data);
        }
      } catch (error) {
        console.error('Error processing server message:', error);
      }
    };
  }
  
  private handleServerMessage(data: { type: string; payload: unknown }): void {
    let initPayload: { id: string };
    let gameStatePayload: GameState;
    let errorPayload: ErrorMessage;

    switch (data.type) {
      case 'init':
        initPayload = data.payload as { id: string };
        this.playerId = initPayload.id || null;
        break;
        
      case 'playerId':
        initPayload = data.payload as { id: string };
        this.playerId = initPayload.id || null;
        if (this.playerId) {
          console.log('Received player ID:', this.playerId);
          this.playerControls.enableControls();
        }
        break;
        
      case 'gameState':
        gameStatePayload = data.payload as GameState;
        this.gameState = gameStatePayload;
        
        // Synchronize player position with server-side position on initial spawn
        if (this.playerId && this.gameState.players[this.playerId]) {
          const serverPlayerData = this.gameState.players[this.playerId];
          const isPlayerAtOrigin = this.player.position.x === 0 && 
                                  this.player.position.z === 0;
          
          // If player is at origin position, update to match server position
          if (isPlayerAtOrigin && serverPlayerData.isAlive) {
            console.log('Updating player position from server:', serverPlayerData.position);
            this.player.position.set(
              serverPlayerData.position.x,
              serverPlayerData.position.y,
              serverPlayerData.position.z
            );
            
            // Update camera position as well
            this.camera.position.set(
              serverPlayerData.position.x,
              serverPlayerData.position.y + 1.6, // Eye level
              serverPlayerData.position.z
            );
          }
        }
        break;
        
      case 'error':
        errorPayload = data.payload as ErrorMessage;
        this.handleError(errorPayload);
        break;
        
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private handleError(error: ErrorMessage): void {
    console.error('Game error:', error);
    
    if (error.code === 'NETWORK_ERROR' || error.code === 'CONNECTION_ERROR') {
      this.hud.showError(`Network Error: ${error.message}`);
    } else {
      this.hud.showError(`Error: ${error.message}`);
    }
  }

  private handlePlayerAction(action: PlayerAction): void {
    if (!this.connectionReady || !this.playerId) {
      console.warn('Cannot send player action: not connected or no player ID');
      return;
    }
    
    this.sendMessage('playerAction', {
      type: action.type,
      data: action.data
    });
    
    // For better responsiveness, also update local player
    if (action.type === 'move' && action.data.position) {
      const player = this.gameState.players[this.playerId];
      if (player) {
        player.position = action.data.position;
      }
    }
  }
  
  private sendMessage(type: string, payload: Record<string, unknown>): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = {
        type,
        payload,
        timestamp: Date.now()
      };
      
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn(`Cannot send ${type} message: socket not ready`);
    }
  }

  private updateGameState(): void {
    // Check for kills first - only if we have a player ID
    if (this.playerId && this.gameState.players[this.playerId]) {
      const currentKills = this.gameState.players[this.playerId].kills;
      if (currentKills > this.previousKills) {
        // Find who was killed by checking which player just died
        for (const [id, player] of Object.entries(this.gameState.players)) {
          if (id !== this.playerId && !player.isAlive) {
            this.hud.showKillIndicator(player.displayName || id.substring(0, 8));
            break;
          }
        }
        this.previousKills = currentKills;
      }
    }

    // Update player models
    for (const [id, playerData] of Object.entries(this.gameState.players)) {
      if (!playerData.isAlive) {
        // Hide dead players
        if (this.players.has(id)) {
          const playerObject = this.players.get(id)!;
          playerObject.visible = false;
        }
        continue;
      }
      
      let playerObject: THREE.Object3D;
      
      // Create new player object if it doesn't exist
      if (!this.players.has(id)) {
        playerObject = this.createPlayerObject(id === this.playerId);
        this.players.set(id, playerObject);
        this.scene.add(playerObject);
        
        // Initialize position tracking
        this.playerPositions.set(id, {
          x: playerData.position.x,
          y: playerData.position.y,
          z: playerData.position.z
        });
        
        this.playerRotations.set(id, {
          x: playerData.rotation.x,
          y: playerData.rotation.y,
          z: playerData.rotation.z
        });
      } else {
        playerObject = this.players.get(id)!;
        playerObject.visible = true;
      }
      
      // Don't update our own player from server data (handled by controls)
      if (id === this.playerId) {
        continue;
      }
      
      // Check if position has changed before updating
      const currentPos = this.playerPositions.get(id);
      const newPos = {
        x: playerData.position.x,
        y: playerData.position.y,
        z: playerData.position.z
      };
      
      if (!currentPos || 
          currentPos.x !== newPos.x || 
          currentPos.y !== newPos.y || 
          currentPos.z !== newPos.z) {
        // Position has changed, update it
        playerObject.position.set(
          newPos.x,
          newPos.y,
          newPos.z
        );
        
        // Update stored position
        this.playerPositions.set(id, newPos);
      }
      
      // Check if rotation has changed before updating
      const currentRot = this.playerRotations.get(id);
      const newRot = {
        x: playerData.rotation.x,
        y: playerData.rotation.y,
        z: playerData.rotation.z
      };
      
      if (!currentRot || 
          currentRot.x !== newRot.x || 
          currentRot.y !== newRot.y || 
          currentRot.z !== newRot.z) {
        // Rotation has changed, update it
        playerObject.rotation.set(
          newRot.x,
          newRot.y,
          newRot.z
        );
        
        // Update stored rotation
        this.playerRotations.set(id, newRot);
      }
    }
    
    // Remove players that are no longer in the game state
    for (const [id, obj] of this.players.entries()) {
      if (!this.gameState.players[id]) {
        this.scene.remove(obj);
        this.players.delete(id);
        this.playerPositions.delete(id);
        this.playerRotations.delete(id);
      }
    }
    
    // Update HUD with game information
    this.hud.updateGameInfo(this.gameState, this.playerId);

    // Update obstacles only periodically or when game state changes significantly
    const currentTime = performance.now();
    if (currentTime - this.lastObstacleUpdate > this.obstacleUpdateInterval) {
      if (this.playerControls) {
        const obstacles = this.gameMap.getObstacles();
        if (obstacles && obstacles.length > 0) {
          this.playerControls.updateObstacles(obstacles);
        }
      }
      this.lastObstacleUpdate = currentTime;
    }

    // Update medipack system and check for pickup
    this.medipackSystem.update();
    
    if (this.playerId && this.gameState.players[this.playerId]) {
      const playerObj = this.gameState.players[this.playerId];
      
      // Check for medipack pickup
      if (playerObj.health < this.maxPlayerHealth) {
        const healAmount = this.medipackSystem.checkPickup(
          playerObj.position, 
          playerObj.health, 
          this.maxPlayerHealth
        );
        
        if (healAmount > 0) {
          // Apply healing locally and send to server
          const newHealth = Math.min(playerObj.health + healAmount, this.maxPlayerHealth);
          
          // Update local game state
          this.gameState.players[this.playerId].health = newHealth;
          
          // Send healing action to server
          this.sendMessage('heal', {
            amount: healAmount,
            newHealth: newHealth
          });
        }
      }
    }
  }

  private createPlayerObject(isMainPlayer: boolean): THREE.Object3D {
    const playerGroup = new THREE.Group();
    
    // Create player mesh using shared geometry and material
    const playerMaterial = this.playerMaterial.clone();
    playerMaterial.color.setHex(isMainPlayer ? 0x00ff00 : 0xff0000);
    
    const playerMesh = new THREE.Mesh(this.playerGeometry, playerMaterial);
    playerMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    playerGroup.add(playerMesh);
    
    return playerGroup;
  }

  private gameLoop(): void {
    if (!this.isRunning) return;
    
    requestAnimationFrame(this.gameLoop.bind(this));
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;
    
    // Update controls based on mode
    if (this.isSpectatorMode && this.spectatorControls) {
      this.spectatorControls.update(deltaTime);
    } else {
      this.playerControls.update(deltaTime);
      
      // Update weapon info in HUD
      const weaponSystem = this.playerControls.getWeaponSystem();
      const currentWeapon = weaponSystem.getCurrentWeapon();
      const weaponState = weaponSystem.getWeaponState();
      
      if (currentWeapon && weaponState) {
        this.hud.updateWeaponInfo(currentWeapon, weaponState);
      }
    }
    
    // Update FPS counter
    this.hud.updateFPS();
    
    // Update game state - ensure obstacles are updated if they change
    this.updateGameState();
    
    // Update LOD manager to handle draw distance
    this.lodManager.update();
    
    // Update draw distance visualization in debug mode
    if (this.hud.isDebugEnabled()) {
      // Get the draw distance indicator or create it if it doesn't exist
      const indicator = this.scene.getObjectByName('draw-distance-indicator');
      if (indicator) {
        // Update the indicator position to follow the camera
        indicator.position.copy(this.camera.position);
      }
      
      // Add LOD stats to HUD
      const lodStats = this.lodManager.getStats();
      this.hud.updateDebugInfo({
        drawDistance: lodStats.drawDistance,
        visibleObjects: lodStats.visibleObjectCount,
        hiddenObjects: lodStats.hiddenObjectCount,
        totalObjects: this.scene.children.length
      });
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  public start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.gameLoop();
    }
  }

  public stop(): void {
    this.isRunning = false;
  }

  public setPlayerName(name: string): void {
    this.playerName = name;
    
    // Update the player name on the server
    if (this.connectionReady && this.playerId) {
      this.sendMessage('setName', {
        displayName: name
      });
    } else {
      console.warn('Cannot set player name: not connected or no player ID');
    }
  }

  public disconnect(): void {
    if (this.socket) {
      // Clear ping interval
      if (this.pingInterval !== null) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
    }
  }

  public cleanup(): void {
    if (this.playerControls) {
      this.playerControls.cleanup();
    }
    if (this.spectatorControls) {
      this.spectatorControls.cleanup();
    }
    this.stop();
    this.disconnect();
    window.removeEventListener('resize', this.boundHandleResize);
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    
    // Clean up medipack system
    this.medipackSystem.cleanup();
    
    // Clean up LOD manager
    this.lodManager.cleanup();
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public toggleSpectatorMode(): void {
    if (this.isSpectatorMode) {
      // Switch back to player mode
      this.isSpectatorMode = false;
      if (this.spectatorControls) {
        this.spectatorControls.cleanup();
        this.spectatorControls = null;
      }
      
      // Get the current server position for our player
      const playerPos = new THREE.Vector3(0, 0, 0);
      if (this.playerId && this.gameState.players[this.playerId]) {
        const serverPlayerData = this.gameState.players[this.playerId];
        playerPos.set(
          serverPlayerData.position.x,
          serverPlayerData.position.y,
          serverPlayerData.position.z
        );
        // Update our local player object to match server position
        this.player.position.copy(playerPos);
      }
      
      // Reset player camera to use server position
      this.camera.position.set(
        playerPos.x,
        playerPos.y + 1.6,
        playerPos.z
      );
      this.camera.rotation.set(0, 0, 0);
      this.playerControls = new PlayerControls(
        this.camera,
        this.player,
        this.handlePlayerAction.bind(this),
        this.gameMap.getObstacles()
      );

      // Enable controls and request pointer lock
      this.playerControls.enableControls();
      document.body.requestPointerLock();
    } else {
      // Switch to spectator mode
      this.isSpectatorMode = true;
      if (this.playerControls) {
        this.playerControls.cleanup();
      }
      
      // Create spectator controls
      this.spectatorControls = new SpectatorControls(this.camera);
    }
  }

  // Add keyboard shortcut for toggling spectator mode
  private setupEventListeners(): void {
    window.addEventListener('resize', this.boundHandleResize);
    // Add key listener for spectator mode toggle
    window.addEventListener('keydown', this.boundHandleKeyDown);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'KeyV') {
      this.toggleSpectatorMode();
    } else if (event.code === 'KeyL') {
      // Toggle draw distance visualization in debug mode
      if (this.hud.isDebugEnabled()) {
        // Cycle through different draw distances for testing
        const currentDrawDistance = this.lodManager.getStats().drawDistance;
        let newDrawDistance = currentDrawDistance;
        
        if (currentDrawDistance >= 1000) {
          newDrawDistance = 500;
        } else if (currentDrawDistance >= 500) {
          newDrawDistance = 300;
        } else if (currentDrawDistance >= 300) {
          newDrawDistance = 1500;
        } else {
          newDrawDistance = 1000;
        }
        
        this.lodManager.setMaxDrawDistance(newDrawDistance);
        
        // Update the draw distance indicator
        const indicator = this.scene.getObjectByName('draw-distance-indicator');
        if (indicator) {
          this.gameMap.removeDrawDistanceIndicator();
          this.gameMap.addDrawDistanceIndicator(newDrawDistance);
        }
        
        console.log(`Draw distance set to: ${newDrawDistance}`);
      }
    } else if (event.code === 'F3') {
      // Toggle debug mode
      this.hud.toggleDebugMode();
      
      // Create or remove draw distance indicator
      if (this.hud.isDebugEnabled()) {
        // If debug mode is enabled, add the draw distance indicator
        this.gameMap.addDrawDistanceIndicator(this.lodManager.getStats().drawDistance);
      } else {
        // If debug mode is disabled, remove the draw distance indicator
        this.gameMap.removeDrawDistanceIndicator();
      }
    }
  }

  /**
   * Setup medipacks at strategic locations on the map
   */
  private setupMedipacks(): void {
    // Define medipack spawn positions
    const medipackPositions = [
      new THREE.Vector3(50, 0, 50),    // North east
      new THREE.Vector3(-50, 0, 50),   // North west
      new THREE.Vector3(50, 0, -50),   // South east
      new THREE.Vector3(-50, 0, -50),  // South west
      new THREE.Vector3(0, 0, 75),     // North
      new THREE.Vector3(0, 0, -75),    // South
      new THREE.Vector3(75, 0, 0),     // East
      new THREE.Vector3(-75, 0, 0)     // West
    ];
    
    // Setup medipacks
    this.medipackSystem.setupMedipacks(medipackPositions);
  }

  /**
   * Register scene objects with the LOD manager for draw distance optimization
   */
  private registerObjectsWithLODManager(): void {
    // Register vegetation and environment objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        // Skip player meshes and essentials (like skybox)
        if (object.name.includes('player') || 
            object.name === 'ground' || 
            object.name.includes('sky')) {
          return;
        }
        
        // Determine object type based on name or properties
        let objectType = 'default';
        let priority = 0;
        
        if (object.name.includes('vegetation')) {
          objectType = 'vegetation';
          priority = 1;
        } else if (object.name.includes('building')) {
          objectType = 'building';
          priority = 3;
        } else if (object instanceof THREE.InstancedMesh) {
          objectType = 'instancedMesh';
          priority = 2;
        }
        
        // Register with LOD manager
        this.lodManager.registerObject(
          object.id.toString(),
          object,
          {
            objectType,
            priority,
            userData: {}
          }
        );
      }
    });
    
    console.log('Registered objects with LOD manager for draw distance optimization');
  }
} 