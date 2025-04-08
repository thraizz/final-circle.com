import * as THREE from 'three';
import { BACKEND } from '../config';
import { ErrorMessage, GameState, PlayerAction } from '../types/game';
import { GameMap } from './GameMap';
import { HUD, HUDConfig } from './HUD';
import { PlayerControls } from './PlayerControls';
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
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private connectionReady: boolean = false;
  public socketReconnecting: boolean = false;
  private pingInterval: number | null = null;

  constructor(hudConfig?: Partial<HUDConfig>, playerName: string = 'Player') {
    // Store player name
    this.playerName = playerName;
    console.log(`Initializing game engine for player: ${this.playerName}`);
    
    // Scene setup
    this.scene = new THREE.Scene();
    
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
      1000
    );
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);
    
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

    // HUD setup
    this.hud = new HUD(hudConfig);

    // Network setup - use WebSocket
    this.setupWebSocket();

    // Game loop setup
    this.lastFrameTime = performance.now();
    this.isRunning = false;
    this.playerId = null;

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
      } else {
        playerObject = this.players.get(id)!;
        playerObject.visible = true;
      }
      
      // Don't update our own player from server data (handled by controls)
      if (id === this.playerId) {
        continue;
      }
      
      // Update player position and rotation
      playerObject.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );
      
      playerObject.rotation.set(
        playerData.rotation.x,
        playerData.rotation.y,
        playerData.rotation.z
      );
    }
    
    // Remove players that are no longer in the game state
    for (const [id, obj] of this.players.entries()) {
      if (!this.gameState.players[id]) {
        this.scene.remove(obj);
        this.players.delete(id);
      }
    }
    
    // Update HUD with game information
    this.hud.updateGameInfo(this.gameState, this.playerId);

    // Ensure player controls always has the latest obstacles
    // This is important if obstacles are added or removed dynamically
    if (this.playerControls) {
      const obstacles = this.gameMap.getObstacles();
      if (obstacles && obstacles.length > 0) {
        this.playerControls.updateObstacles(obstacles);
      }
    }
  }

  private createPlayerObject(isMainPlayer: boolean): THREE.Object3D {
    const playerGroup = new THREE.Group();
    
    // Create player mesh
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshLambertMaterial({
      color: isMainPlayer ? 0x00ff00 : 0xff0000
    });
    
    const playerMesh = new THREE.Mesh(geometry, material);
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
    window.removeEventListener('resize', this.handleResize.bind(this));
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
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
      
      // Reset player camera
      this.camera.position.set(
        this.player.position.x,
        this.player.position.y + 1.6,
        this.player.position.z
      );
      this.camera.rotation.set(0, 0, 0);
      this.playerControls = new PlayerControls(
        this.camera,
        this.player,
        this.handlePlayerAction.bind(this),
        this.gameMap.getObstacles()
      );
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
    window.addEventListener('resize', this.handleResize.bind(this));
    // Add key listener for spectator mode toggle
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.code === 'KeyV') {
        this.toggleSpectatorMode();
      }
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'KeyV') {
      this.toggleSpectatorMode();
    }
  }
} 