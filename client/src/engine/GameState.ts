import { SoundManager } from './SoundManager';

export class GameState {
  private soundManager: SoundManager;
  private localPlayerId: string;

  constructor(localPlayerId: string) {
    this.soundManager = SoundManager.getInstance();
    this.localPlayerId = localPlayerId;
  }

  public handlePlayerDeath(playerId: string, killerId: string | null): void {
    // Play death sound for the dead player
    if (playerId === this.localPlayerId) {
      this.soundManager.playSound('player_death');
    }
    
    // Play kill sound for the killer
    if (killerId === this.localPlayerId) {
      this.soundManager.playSound('player_kill');
    }
  }

  // ... rest of existing code ...
} 