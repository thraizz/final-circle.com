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
  debugMode: boolean;
}

export interface DebugInfo {
  drawDistance?: number;
  visibleObjects?: number;
  hiddenObjects?: number;
  [key: string]: number | string | undefined;
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
  private deathOverlay: HTMLDivElement;
  private lowHealthOverlay: HTMLDivElement;
  private killIndicator: HTMLDivElement;
  private debugDisplay: HTMLDivElement;
  private config: HUDConfig;
  private frames: number[];
  private lastFrameTime: number;
  private errorMessageTimeout: number | null = null;
  private lowHealthAnimationId: number | null = null;
  private messageTimeout: number | null = null;
  
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
      debugMode: false,
      ...config
    };
    
    // FPS tracking
    this.frames = [];
    this.lastFrameTime = performance.now();
    
    // Create HUD container
    this.container = document.createElement('div');
    this.container.className = 'hud-container';
    
    // Create HUD elements
    this.fpsDisplay = this.createHUDElement('fps', 'FPS: 0');
    this.healthDisplay = this.createHUDElement('health', 'Health: 100');
    this.ammoDisplay = this.createHUDElement('ammo', 'Ammo: 0/0');
    this.weaponDisplay = this.createHUDElement('weapon', 'Weapon: None');
    this.gameTimeDisplay = this.createHUDElement('game-time', 'Time: 00:00');
    this.playerCountDisplay = this.createHUDElement('player-count', 'Players: 0');
    
    // Create debug display
    this.debugDisplay = this.createHUDElement('debug', 'Debug Info');
    this.debugDisplay.style.right = '10px';
    this.debugDisplay.style.top = '50px';
    this.debugDisplay.style.display = this.config.debugMode ? 'block' : 'none';
    
    // Create crosshair
    this.crosshairDisplay = document.createElement('div');
    this.crosshairDisplay.className = 'crosshair';
    
    // Add crosshair lines
    const leftLine = document.createElement('div');
    leftLine.className = 'crosshair-line left';
    this.crosshairDisplay.appendChild(leftLine);
    
    const rightLine = document.createElement('div');
    rightLine.className = 'crosshair-line right';
    this.crosshairDisplay.appendChild(rightLine);
    
    const topLine = document.createElement('div');
    topLine.className = 'crosshair-line top';
    this.crosshairDisplay.appendChild(topLine);
    
    const bottomLine = document.createElement('div');
    bottomLine.className = 'crosshair-line bottom';
    this.crosshairDisplay.appendChild(bottomLine);
    
    // Add center dot
    const centerDot = document.createElement('div');
    centerDot.className = 'crosshair-dot';
    this.crosshairDisplay.appendChild(centerDot);
    
    document.body.appendChild(this.crosshairDisplay);
    
    // Create connection status and error message displays
    this.connectionStatusDisplay = this.createHUDElement('connection-status', '');
    this.connectionStatusDisplay.style.display = 'none';
    
    this.errorMessageDisplay = this.createHUDElement('error-message', '');
    this.errorMessageDisplay.style.display = 'none';
    
    // Create death overlay
    this.deathOverlay = document.createElement('div');
    this.deathOverlay.className = 'death-overlay';
    this.deathOverlay.innerHTML = '<div class="death-message">YOU DIED</div><div class="death-submessage">No respawn until next round</div>';
    this.deathOverlay.style.display = 'none';
    document.body.appendChild(this.deathOverlay);
    
    // Create low health overlay
    this.lowHealthOverlay = document.createElement('div');
    this.lowHealthOverlay.className = 'low-health-overlay';
    this.lowHealthOverlay.style.display = 'none';
    document.body.appendChild(this.lowHealthOverlay);
    
    // Create kill indicator
    this.killIndicator = document.createElement('div');
    this.killIndicator.className = 'kill-indicator';
    this.killIndicator.style.display = 'none';
    document.body.appendChild(this.killIndicator);
    
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
      } else if (event.code === 'F3') {
        // Toggle debug mode with F3 key
        this.toggleDebugMode();
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
      .hud-container {
        position: fixed;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
        font-family: 'Arial', sans-serif;
        color: white;
      }
      
      .hud-element {
        position: absolute;
        margin: 10px;
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        transition: opacity 0.2s ease;
      }
      
      .hud-message {
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
        z-index: 2000;
        pointer-events: none;
        opacity: 0.9;
        transition: opacity 0.3s ease;
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
        --crosshair-gap: 5px;
      }
      
      .crosshair-line {
        position: absolute;
        background-color: var(--crosshair-color);
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
      }
      
      /* Left line */
      .crosshair-line.left {
        width: 8px;
        height: 2px;
        top: 9px;
        right: calc(10px + var(--crosshair-gap));
      }
      
      /* Right line */
      .crosshair-line.right {
        width: 8px;
        height: 2px;
        top: 9px;
        left: calc(10px + var(--crosshair-gap));
      }
      
      /* Top line */
      .crosshair-line.top {
        width: 2px;
        height: 8px;
        left: 9px;
        bottom: calc(10px + var(--crosshair-gap));
      }
      
      /* Bottom line */
      .crosshair-line.bottom {
        width: 2px;
        height: 8px;
        left: 9px;
        top: calc(10px + var(--crosshair-gap));
      }
      
      /* Center dot */
      .crosshair-dot {
        position: absolute;
        width: 2px;
        height: 2px;
        top: 9px;
        left: 9px;
        background-color: var(--crosshair-color);
        border-radius: 50%;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
      }
      
      .hud-element.fps {
        top: 10px;
        right: 10px;
      }
      
      .hud-element.health {
        bottom: 10px;
        left: 10px;
      }
      
      .hud-element.ammo {
        bottom: 10px;
        right: 10px;
      }
      
      .hud-element.weapon {
        bottom: 50px;
        right: 10px;
      }
      
      .hud-element.game-time {
        top: 10px;
        left: 10px;
      }
      
      .hud-element.player-count {
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .hud-element.connection-status {
        bottom: 50%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(255, 165, 0, 0.8);
        padding: 15px 25px;
        font-size: 18px;
        text-align: center;
        z-index: 1100;
      }
      
      .hud-element.error-message {
        bottom: 40%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(255, 0, 0, 0.8);
        padding: 15px 25px;
        font-size: 18px;
        text-align: center;
        z-index: 1100;
      }
      
      .death-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 0, 0, 0.3);
        z-index: 2000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: none;
      }
      
      .death-message {
        font-size: 48px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
      }
      
      .death-submessage {
        font-size: 24px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        margin-top: 15px;
      }
      
      .low-health-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1050;
        box-shadow: inset 0 0 100px rgba(255, 0, 0, 0.5);
      }
      
      .lobby-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        background-color: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
        padding: 20px;
        color: white;
        z-index: 2000;
        overflow-y: auto;
      }
      
      .kill-indicator {
        position: fixed;
        top: 25%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border-radius: 5px;
        padding: 10px 20px;
        text-align: center;
        z-index: 1100;
        animation: fadeInOut 2s ease-in-out;
        pointer-events: none;
      }
      
      .hud-element.debug {
        top: 50px;
        right: 10px;
        background-color: rgba(0, 0, 0, 0.7);
        font-family: monospace;
        font-size: 12px;
        line-height: 1.4;
        padding: 10px;
        border: 1px solid rgba(0, 255, 255, 0.5);
        max-width: 300px;
        overflow: hidden;
      }
      
      @keyframes fadeInOut {
        0% { opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
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
    this.debugDisplay.style.display = this.config.debugMode ? 'block' : 'none';
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
    
    // Show death overlay if health is 0
    if (health <= 0) {
      this.showDeathOverlay(true);
      this.stopLowHealthEffect();
    } else {
      this.showDeathOverlay(false);
      
      // Show low health effect if health is below 50
      if (health < 50) {
        this.showLowHealthEffect(health);
      } else {
        this.stopLowHealthEffect();
      }
    }
  }
  
  private showDeathOverlay(show: boolean): void {
    this.deathOverlay.style.display = show ? 'flex' : 'none';
  }
  
  private showLowHealthEffect(health: number): void {
    // Make the effect stronger as health decreases
    const intensity = 1 - (health / 50);
    
    // Start low health effect if not already running
    if (this.lowHealthAnimationId === null) {
      this.lowHealthOverlay.style.display = 'block';
      let opacity = 0;
      let increasing = true;
      
      const animate = () => {
        // Calculate pulse rate based on health (faster pulse at lower health)
        const pulseRate = 0.02 + (0.04 * intensity);
        
        if (increasing) {
          opacity += pulseRate;
          if (opacity >= intensity * 0.5) { // Max opacity based on health
            increasing = false;
          }
        } else {
          opacity -= pulseRate;
          if (opacity <= 0) {
            increasing = true;
          }
        }
        
        this.lowHealthOverlay.style.backgroundColor = `rgba(255, 0, 0, ${opacity})`;
        this.lowHealthAnimationId = requestAnimationFrame(animate);
      };
      
      this.lowHealthAnimationId = requestAnimationFrame(animate);
    }
  }
  
  private stopLowHealthEffect(): void {
    if (this.lowHealthAnimationId !== null) {
      cancelAnimationFrame(this.lowHealthAnimationId);
    }
  }
  
  public updateWeaponInfo(weapon: Weapon | null, weaponState: WeaponState): void {
    if (!this.config.showAmmo && !this.config.showWeaponInfo) return;
    
    if (weapon) {
      if (this.config.showAmmo) {
        if (weapon.type === 'KNIFE') {
          this.ammoDisplay.textContent = 'Melee Weapon';
        } else {
          this.ammoDisplay.textContent = weapon.isReloading 
            ? 'Reloading...' 
            : `Ammo: ${weapon.currentAmmo}/${weapon.totalAmmo}`;
        }
      }
      
      if (this.config.showWeaponInfo) {
        const aimingText = weaponState.isAiming ? ' (Aiming)' : '';
        this.weaponDisplay.textContent = `${weapon.name}${aimingText}`;
      }
      
      // Update crosshair and accuracy indicator based on accuracy
      this.updateCrosshairForAiming(weaponState.isAiming, weaponState.currentAccuracy);
    } else {
      if (this.config.showAmmo) {
        this.ammoDisplay.textContent = 'Ammo: --/--';
      }
      
      if (this.config.showWeaponInfo) {
        this.weaponDisplay.textContent = 'Weapon: None';
      }
      
      // Reset crosshair
      this.updateCrosshairForAiming(false, 1);
    }
  }
  
  /**
   * Updates the crosshair appearance based on aiming state and accuracy
   */
  private updateCrosshairForAiming(isAiming: boolean, currentAccuracy: number = 1): void {
    if (!this.config.showCrosshair) return;
    
    const color = isAiming ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    
    // Update the crosshair color
    this.crosshairDisplay.style.setProperty('--crosshair-color', color);
    
    // Calculate gap based on accuracy (1 = perfect accuracy, smallest gap)
    // For worst accuracy (0), the gap is 20px, for best (1), the gap is 3px
    const gap = Math.max(3, 20 - (currentAccuracy * 17));
    this.crosshairDisplay.style.setProperty('--crosshair-gap', `${gap}px`);
    
    // Update all crosshair elements with the new color
    const crosshairElements = this.crosshairDisplay.querySelectorAll('.crosshair-line, .crosshair-dot');
    crosshairElements.forEach(element => {
      (element as HTMLElement).style.backgroundColor = color;
    });
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
  
  public showKillIndicator(killedPlayerName: string): void {
    this.killIndicator.textContent = `Killed ${killedPlayerName}`;
    this.killIndicator.style.display = 'block';
    
    // Fade out after 2 seconds
    setTimeout(() => {
      this.killIndicator.style.display = 'none';
    }, 2000);
  }
  
  public cleanup(): void {
    // Cancel animations
    if (this.lowHealthAnimationId !== null) {
      cancelAnimationFrame(this.lowHealthAnimationId);
    }
    
    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.crosshairDisplay && this.crosshairDisplay.parentNode) {
      this.crosshairDisplay.parentNode.removeChild(this.crosshairDisplay);
    }
    
    if (this.lobbyOverlay && this.lobbyOverlay.parentNode) {
      this.lobbyOverlay.parentNode.removeChild(this.lobbyOverlay);
    }
    
    if (this.deathOverlay && this.deathOverlay.parentNode) {
      this.deathOverlay.parentNode.removeChild(this.deathOverlay);
    }
    
    if (this.lowHealthOverlay && this.lowHealthOverlay.parentNode) {
      this.lowHealthOverlay.parentNode.removeChild(this.lowHealthOverlay);
    }
    
    if (this.killIndicator && this.killIndicator.parentNode) {
      this.killIndicator.parentNode.removeChild(this.killIndicator);
    }
    
    // Clear any pending timeouts
    if (this.errorMessageTimeout !== null) {
      window.clearTimeout(this.errorMessageTimeout);
      this.errorMessageTimeout = null;
    }
  }
  
  /**
   * Toggle debug mode on/off
   */
  public toggleDebugMode(): void {
    this.config.debugMode = !this.config.debugMode;
    this.debugDisplay.style.display = this.config.debugMode ? 'block' : 'none';
    console.log(`Debug mode: ${this.config.debugMode ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if debug mode is enabled
   */
  public isDebugEnabled(): boolean {
    return this.config.debugMode;
  }
  
  /**
   * Update debug information display
   */
  public updateDebugInfo(debugInfo: DebugInfo): void {
    if (!this.config.debugMode) return;
    
    let debugText = 'Debug Info:';
    
    // Add all debug info to display
    Object.entries(debugInfo).forEach(([key, value]) => {
      // Format the key with spaces before capital letters
      const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      debugText += `<br>${formattedKey}: ${value}`;
    });
    
    this.debugDisplay.innerHTML = debugText;
  }
  
  public showMessage(message: string, duration: number = 3000): void {
    // Create or get the message display element
    let messageDisplay = document.getElementById('hud-message');
    
    if (!messageDisplay) {
      messageDisplay = document.createElement('div');
      messageDisplay.id = 'hud-message';
      messageDisplay.className = 'hud-message';
      document.body.appendChild(messageDisplay);
    }
    
    // Set the message text
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    
    // Clear any existing timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    
    // Hide the message after the specified duration
    this.messageTimeout = window.setTimeout(() => {
      if (messageDisplay) {
        messageDisplay.style.display = 'none';
      }
    }, duration);
  }
} 