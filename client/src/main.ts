import { GameEngine } from './engine/GameEngine';

// Start the game when the page loads
window.addEventListener('load', () => {
  const game = new GameEngine();
  game.start();
  
  // Cleanup on page unload
  window.addEventListener('unload', () => {
    game.cleanup();
  });
}); 