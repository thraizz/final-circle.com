import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Login } from './components/Login'
import { GameEngine } from './engine/GameEngine'
import { HUDConfig } from './engine/HUD'

function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const [showInstructions, setShowInstructions] = useState(true)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [hudConfig, setHudConfig] = useState<HUDConfig>({
    showFPS: true,
    showHealth: true,
    showAmmo: true,
    showWeaponInfo: true,
    showGameTime: true,
    showPlayerCount: true,
  })

  const handleLogin = (name: string) => {
    setPlayerName(name);
    // LocalStorage for persistence across refreshes
    localStorage.setItem('playerName', name);
  };

  // Check for saved player name on load
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    // Don't create game engine until player name is set
    if (!playerName || !mountRef.current) return;

    // Initialize game engine with HUD config
    const gameEngine = new GameEngine(hudConfig, playerName)
    gameEngineRef.current = gameEngine

    // Start the game loop
    gameEngine.start()

    // Hide instructions after 10 seconds
    const timer = setTimeout(() => {
      setShowInstructions(false)
    }, 10000)

    // Clean up on unmount
    return () => {
      clearTimeout(timer)
      if (gameEngineRef.current) {
        gameEngineRef.current.cleanup()
        gameEngineRef.current = null
      }
    }
  }, [playerName]) // Re-run when playerName changes

  // Update HUD config whenever it changes
  useEffect(() => {
    if (!playerName) return; // Don't update if not logged in

    if (gameEngineRef.current) {
      const gameEngine = gameEngineRef.current
      // We need to update HUD manually here
      // This is a simple workaround since we don't have direct access to the HUD
      // A better approach would be to expose a updateHUDConfig method in GameEngine
      gameEngine.cleanup()
      const newEngine = new GameEngine(hudConfig, playerName)
      gameEngineRef.current = newEngine
      newEngine.start()
    }
  }, [hudConfig, playerName])

  // Handler for toggling HUD elements
  const toggleHUDElement = (element: keyof HUDConfig) => {
    setHudConfig(prevConfig => ({
      ...prevConfig,
      [element]: !prevConfig[element]
    }))
  }

  // If player name is not set, show login screen
  if (!playerName) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="game-container">
      <div ref={mountRef} className="game-canvas" />

      {/* HUD Settings Panel */}
      <div className="hud-settings">
        <button onClick={() => toggleHUDElement('showFPS')}>
          {hudConfig.showFPS ? 'Hide FPS' : 'Show FPS'}
        </button>
        <button onClick={() => toggleHUDElement('showHealth')}>
          {hudConfig.showHealth ? 'Hide Health' : 'Show Health'}
        </button>
        <button onClick={() => toggleHUDElement('showAmmo')}>
          {hudConfig.showAmmo ? 'Hide Ammo' : 'Show Ammo'}
        </button>
        <button onClick={() => toggleHUDElement('showWeaponInfo')}>
          {hudConfig.showWeaponInfo ? 'Hide Weapon Info' : 'Show Weapon Info'}
        </button>
        <button onClick={() => toggleHUDElement('showGameTime')}>
          {hudConfig.showGameTime ? 'Hide Game Time' : 'Show Game Time'}
        </button>
        <button onClick={() => toggleHUDElement('showPlayerCount')}>
          {hudConfig.showPlayerCount ? 'Hide Player Count' : 'Show Player Count'}
        </button>
      </div>

      {/* Game Instructions */}
      {showInstructions && (
        <div className="instructions">
          <h3>Game Controls</h3>
          <p>WASD - Move | Mouse - Look | Left Click - Shoot | Right Click - Aim</p>
          <p>R - Reload | Space - Jump | 1-4 - Switch Weapons</p>
          <p>Tab - View Player Lobby | Click anywhere to lock pointer and begin</p>
        </div>
      )}
    </div>
  )
}

export default App
