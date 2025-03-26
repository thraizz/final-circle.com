import { GameState } from '../types/game';
import { Weapon, WeaponState } from '../types/weapons';

export interface HUDConfig {
  showFPS: boolean;
  showHealth: boolean;
  showAmmo: boolean;
  showWeaponInfo: boolean;
  showGameTime: boolean;
  showPlayerCount: boolean;
  showCrosshair: boolean;
}

export class HUD {
  private container: HTMLDivElement;
  private fpsDisplay: HTMLDivElement;
  private healthDisplay: HTMLDivElement;
  private ammoDisplay: HTMLDivElement;
  private weaponDisplay: HTMLDivElement;
  private gameTimeDisplay: HTMLDivElement;
  private playerCountDisplay: HTMLDivElement;
  private crosshairDisplay: HTMLDivElement;
  private lobbyOverlay: HTMLDivElement;
  private connectionStatusDisplay: HTMLDivElement;
  private errorMessageDisplay: HTMLDivElement;
  private config: HUDConfig;
  private frames: number[];
  private lastFrameTime: number;
  private errorMessageTimeout: number | null = null;
  
  constructor(config?: Partial<HUDConfig>) {
    // Default configuration
    this.config = {
      showFPS: true,
      showHealth: true,
      showAmmo: true,
      showWeaponInfo: true,
      showGameTime: true,
      showPlayerCount: true,
      showCrosshair: true,
      ...config
    };
    
    // FPS tracking
    this.frames = [];
    this.lastFrameTime = performance.now();
    
    // Create HUD container
    this.container = document.createElement('div');
    this.container.className = 'game-hud';
    
    // Create HUD elements
    this.fpsDisplay = this.createHUDElement('fps', 'FPS: --');
    this.healthDisplay = this.createHUDElement('health', 'Health: 100');
    this.ammoDisplay = this.createHUDElement('ammo', 'Ammo: 0/0');
    this.weaponDisplay = this.createHUDElement('weapon', 'Weapon: None');
    this.gameTimeDisplay = this.createHUDElement('game-time', 'Time: 00:00');
    this.playerCountDisplay = this.createHUDElement('player-count', 'Players: 0');
    
    // Create crosshair
    this.crosshairDisplay = document.createElement('div');
    this.crosshairDisplay.className = 'crosshair';
    
    // Create center dot
    const centerDot = document.createElement('div');
    centerDot.className = 'crosshair-dot';
    this.crosshairDisplay.appendChild(centerDot);
    
    document.body.appendChild(this.crosshairDisplay);
    
    // Create connection status and error message displays
    this.connectionStatusDisplay = this.createHUDElement('connection-status', '');
    this.connectionStatusDisplay.style.display = 'none';
    
    this.errorMessageDisplay = this.createHUDElement('error-message', '');
    this.errorMessageDisplay.style.display = 'none';
    
    // Lobby overlay setup
    this.lobbyOverlay = document.createElement('div');
    this.lobbyOverlay.className = 'lobby-overlay';
    this.lobbyOverlay.style.display = 'none';
    document.body.appendChild(this.lobbyOverlay);
    
    // Add Tab key handler
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Tab') {
        event.preventDefault(); // Prevent default Tab behavior
        this.toggleLobbyOverlay(true);
      }
    });
    
    document.addEventListener('keyup', (event) => {
      if (event.code === 'Tab') {
        this.toggleLobbyOverlay(false);
      }
    });
    
    // Apply configuration
    this.updateVisibility();
    
    // Add container to DOM
    document.body.appendChild(this.container);
    
    // Add CSS to document
    this.addStyles();
  }
  
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .game-hud {
        position: absolute;
        bottom: 20px;
        left: 20px;
        right: 20px;
        color: white;
        font-family: 'Arial', sans-serif;
        font-size: 14px;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 1000;
      }
      
      .hud-element {
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        transition: opacity 0.2s ease;
      }
      
      .crosshair {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        z-index: 1000;
        pointer-events: none;
        --crosshair-color: rgba(255, 255, 255, 0.9);
      }
      
      .crosshair::before,
      .crosshair::after {
        content: '';
        position: absolute;
        background-color: var(--crosshair-color);
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
      }
      
      .crosshair::before {
        width: 14px;
        height: 2px;
        top: 9px;
        left: 3px;
      }
      
      .crosshair::after {
        width: 2px;
        height: 14px;
        top: 3px;
        left: 9px;
      }
      
      .crosshair-dot {
        position: absolute;
        width: 4px;
        height: 4px;
        background-color: var(--crosshair-color);
        border-radius: 50%;
        top: 8px;
        left: 8px;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
      }
      
      .hud-element.health {
        position: absolute;
        bottom: 0;
        left: 0;
      }
      
      .hud-element.ammo {
        position: absolute;
        bottom: 0;
        right: 0;
      }
      
      .hud-element.weapon {
        position: absolute;
        bottom: 40px;
        right: 0;
      }
      
      .hud-element.fps {
        position: absolute;
        top: 0;
        right: 0;
        font-size: 12px;
      }
      
      .hud-element.game-time {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .hud-element.player-count {
        position: absolute;
        top: 0;
        left: 0;
      }
      
      .hud-element.connection-status {
        position: fixed;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 2000;
        font-weight: bold;
        pointer-events: none;
        text-align: center;
      }
      
      .hud-element.error-message {
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(204, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 2000;
        font-weight: bold;
        pointer-events: none;
        text-align: center;
      }
      
      .lobby-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 5px;
        z-index: 1000;
        min-width: 400px;
        backdrop-filter: blur(5px);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      }
      
      .lobby-title {
        text-align: center;
        font-size: 24px;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        padding-bottom: 10px;
      }
      
      .player-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .player-table th, .player-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .player-table th {
        font-weight: bold;
        color: #aaa;
      }
      
      .player-table tr:last-child td {
        border-bottom: none;
      }
      
      .player-row.local-player {
        color: #33cc33;
        font-weight: bold;
      }
      
      .player-status-alive {
        color: #33cc33;
      }
      
      .player-status-dead {
        color: #cc3333;
      }
    `;
    document.head.appendChild(style);
  }
  
  private createHUDElement(className: string, initialText: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = `hud-element ${className}`;
    element.textContent = initialText;
    this.container.appendChild(element);
    return element;
  }
  
  private updateVisibility(): void {
    this.fpsDisplay.style.display = this.config.showFPS ? 'block' : 'none';
    this.healthDisplay.style.display = this.config.showHealth ? 'block' : 'none';
    this.ammoDisplay.style.display = this.config.showAmmo ? 'block' : 'none';
    this.weaponDisplay.style.display = this.config.showWeaponInfo ? 'block' : 'none';
    this.gameTimeDisplay.style.display = this.config.showGameTime ? 'block' : 'none';
    this.playerCountDisplay.style.display = this.config.showPlayerCount ? 'block' : 'none';
    this.crosshairDisplay.style.display = this.config.showCrosshair ? 'block' : 'none';
  }
  
  public updateConfig(config: Partial<HUDConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateVisibility();
  }
  
  /**
   * Shows a connection status message
   */
  public showConnectionStatus(message: string): void {
    this.connectionStatusDisplay.textContent = message;
    this.connectionStatusDisplay.style.display = 'block';
  }
  
  /**
   * Hides the connection status message
   */
  public hideConnectionStatus(): void {
    this.connectionStatusDisplay.style.display = 'none';
  }
  
  /**
   * Shows an error message that automatically disappears after 5 seconds
   */
  public showError(message: string): void {
    this.errorMessageDisplay.textContent = message;
    this.errorMessageDisplay.style.display = 'block';
    
    // Clear any existing timeout
    if (this.errorMessageTimeout !== null) {
      window.clearTimeout(this.errorMessageTimeout);
    }
    
    // Set a timeout to hide the error message after 5 seconds
    this.errorMessageTimeout = window.setTimeout(() => {
      this.errorMessageDisplay.style.display = 'none';
      this.errorMessageTimeout = null;
    }, 5000);
  }
  
  public updateFPS(): void {
    if (!this.config.showFPS) return;
    
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    // Track FPS for average calculation
    this.frames.push(1000 / delta);
    if (this.frames.length > 60) {
      this.frames.shift();
    }
    
    // Calculate average FPS
    const avgFPS = Math.round(
      this.frames.reduce((sum, fps) => sum + fps, 0) / this.frames.length
    );
    
    this.fpsDisplay.textContent = `FPS: ${avgFPS}`;
    
    // Color code based on performance
    if (avgFPS < 30) {
      this.fpsDisplay.style.color = '#ff3333'; // Red
    } else if (avgFPS < 50) {
      this.fpsDisplay.style.color = '#ffff33'; // Yellow
    } else {
      this.fpsDisplay.style.color = '#33ff33'; // Green
    }
  }
  
  public updateHealth(health: number): void {
    if (!this.config.showHealth) return;
    
    this.healthDisplay.textContent = `Health: ${Math.round(health)}`;
    
    // Color code based on health level
    if (health > 70) {
      this.healthDisplay.style.color = 'rgb(0, 255, 0)';
    } else if (health > 30) {
      this.healthDisplay.style.color = 'rgb(255, 255, 0)';
    } else {
      this.healthDisplay.style.color = 'rgb(255, 0, 0)';
    }
  }
  
  public updateWeaponInfo(weapon: Weapon | null, weaponState: WeaponState): void {
    if (!this.config.showAmmo && !this.config.showWeaponInfo) return;
    
    if (weapon) {
      if (this.config.showAmmo) {
        this.ammoDisplay.textContent = weapon.isReloading 
          ? 'Reloading...' 
          : `Ammo: ${weapon.currentAmmo}/${weapon.totalAmmo}`;
      }
      
      if (this.config.showWeaponInfo) {
        const aimingText = weaponState.isAiming ? ' (Aiming)' : '';
        const accuracyPct = Math.round(weaponState.currentAccuracy * 100);
        this.weaponDisplay.textContent = `${weapon.name}${aimingText} | Accuracy: ${accuracyPct}%`;
      }
      
      // Update crosshair color based on aiming state
      this.updateCrosshairForAiming(weaponState.isAiming);
    } else {
      if (this.config.showAmmo) {
        this.ammoDisplay.textContent = 'Ammo: --/--';
      }
      
      if (this.config.showWeaponInfo) {
        this.weaponDisplay.textContent = 'Weapon: None';
      }
      
      // Reset crosshair color
      this.updateCrosshairForAiming(false);
    }
  }
  
  /**
   * Updates the crosshair appearance based on aiming state
   */
  private updateCrosshairForAiming(isAiming: boolean): void {
    if (!this.config.showCrosshair) return;
    
    const color = isAiming ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    
    // Update the pseudoelements by updating a custom property
    this.crosshairDisplay.style.setProperty('--crosshair-color', color);
    
    // Update the center dot directly
    const centerDot = this.crosshairDisplay.querySelector('.crosshair-dot');
    if (centerDot) {
      (centerDot as HTMLElement).style.backgroundColor = color;
    }
  }
  
  public updateGameState(gameState: GameState, localPlayerId: string | null): void {
    if (!gameState) return;
    
    // Update player count
    const playerCount = Object.keys(gameState.players).length;
    this.playerCountDisplay.textContent = `Players: ${playerCount}`;
    
    // Update game time
    const minutes = Math.floor(gameState.gameTime / 60);
    const seconds = Math.floor(gameState.gameTime % 60);
    this.gameTimeDisplay.textContent = `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update health for local player
    if (localPlayerId && gameState.players[localPlayerId]) {
      const localPlayer = gameState.players[localPlayerId];
      this.updateHealth(localPlayer.health);
    }
    
    // Update lobby overlay
    this.updateLobbyOverlay(gameState, localPlayerId);
  }
  
  public updateGameInfo(gameState: GameState, localPlayerId: string | null): void {
    if (!gameState) return;
    
    // Update player count
    const playerCount = Object.keys(gameState.players).length;
    this.playerCountDisplay.textContent = `Players: ${playerCount}`;
    
    // Update game time
    const minutes = Math.floor(gameState.gameTime / 60);
    const seconds = Math.floor(gameState.gameTime % 60);
    this.gameTimeDisplay.textContent = `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update health for local player
    if (localPlayerId && gameState.players[localPlayerId]) {
      const localPlayer = gameState.players[localPlayerId];
      this.updateHealth(localPlayer.health);
    }
    
    // Update lobby overlay
    this.updateLobbyOverlay(gameState, localPlayerId);
  }
  
  private updateLobbyOverlay(gameState: GameState, localPlayerId: string | null): void {
    // Clear previous content
    this.lobbyOverlay.innerHTML = '';
    
    // Create title
    const title = document.createElement('div');
    title.className = 'lobby-title';
    title.textContent = 'Player Lobby';
    this.lobbyOverlay.appendChild(title);
    
    // Create table
    const table = document.createElement('table');
    table.className = 'player-table';
    
    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['Player', 'Status', 'Kills', 'Deaths'];
    
    headers.forEach(headerText => {
      const header = document.createElement('th');
      header.textContent = headerText;
      headerRow.appendChild(header);
    });
    
    table.appendChild(headerRow);
    
    // Add player rows
    const playerCount = Object.keys(gameState.players).length;
    if (playerCount === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      emptyCell.textContent = 'No players in game';
      emptyCell.style.textAlign = 'center';
      emptyRow.appendChild(emptyCell);
      table.appendChild(emptyRow);
    } else {
      // Convert players object to array for sorting
      const playersArray = Object.values(gameState.players);
      
      // Sort by kills (highest first)
      playersArray.sort((a, b) => b.kills - a.kills);
      
      playersArray.forEach(player => {
        const row = document.createElement('tr');
        row.className = 'player-row';
        
        if (player.id === localPlayerId) {
          row.classList.add('local-player');
        }
        
        // Player name/ID cell
        const nameCell = document.createElement('td');
        nameCell.textContent = player.displayName || player.id.substring(0, 8); // Use display name if available
        row.appendChild(nameCell);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.textContent = player.isAlive ? 'Alive' : 'Dead';
        statusCell.className = player.isAlive ? 'player-status-alive' : 'player-status-dead';
        row.appendChild(statusCell);
        
        // Kills cell
        const killsCell = document.createElement('td');
        killsCell.textContent = player.kills.toString();
        row.appendChild(killsCell);
        
        // Deaths cell
        const deathsCell = document.createElement('td');
        deathsCell.textContent = player.deaths.toString();
        row.appendChild(deathsCell);
        
        table.appendChild(row);
      });
    }
    
    this.lobbyOverlay.appendChild(table);
  }
  
  public toggleLobbyOverlay(show: boolean): void {
    this.lobbyOverlay.style.display = show ? 'block' : 'none';
  }
  
  public cleanup(): void {
    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.lobbyOverlay && this.lobbyOverlay.parentNode) {
      this.lobbyOverlay.parentNode.removeChild(this.lobbyOverlay);
    }
    
    if (this.crosshairDisplay && this.crosshairDisplay.parentNode) {
      this.crosshairDisplay.parentNode.removeChild(this.crosshairDisplay);
    }
    
    // Clear any pending timeouts
    if (this.errorMessageTimeout !== null) {
      window.clearTimeout(this.errorMessageTimeout);
      this.errorMessageTimeout = null;
    }
  }
} 