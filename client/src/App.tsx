import { useEffect, useRef, useState } from 'react'
import './App.css'
import { LandingPage } from './components/LandingPage'
import { Login } from './components/Login'
import { GameEngine } from './engine/GameEngine'
import { HUDConfig } from './engine/HUD'

function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const [showInstructions, setShowInstructions] = useState(true)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [gameState, setGameState] = useState<'landing' | 'game'>('landing')
  const [hudConfig, setHudConfig] = useState<HUDConfig>({
    showFPS: true,
    showHealth: true,
    showAmmo: true,
    showWeaponInfo: true,
    showGameTime: true,
    showPlayerCount: true,
    showCrosshair: true,
  })

  const handleLogin = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('playerName', name);
  };

  const handleJoinLobby = (_lobbyId: string) => {
    // In a real implementation, this would connect to the game server
    // and handle the lobby joining logic
    setGameState('game');
  };

  // Check for saved player name on load
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  // Single effect to handle game engine lifecycle
  useEffect(() => {
    // Don't create game engine until player name is set and game state is 'game'
    if (!playerName || !mountRef.current || gameState !== 'game') {
      return;
    }

    // Clear any existing content in the mount point
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Initialize game engine with HUD config
    const gameEngine = new GameEngine(hudConfig, playerName)
    gameEngineRef.current = gameEngine

    // Move the renderer to our mount point
    const canvas = gameEngine.getRenderer().domElement;
    mountRef.current.appendChild(canvas);

    // Start the game loop
    gameEngine.start()

    // Hide instructions after 10 seconds
    const timer = setTimeout(() => {
      setShowInstructions(false)
    }, 10000)

    // Clean up on unmount or when dependencies change
    return () => {
      clearTimeout(timer)
      if (gameEngineRef.current) {
        if (mountRef.current?.contains(gameEngineRef.current.getRenderer().domElement)) {
          mountRef.current.removeChild(gameEngineRef.current.getRenderer().domElement);
        }
        gameEngineRef.current.cleanup()
        gameEngineRef.current = null
      }
    }
  }, [playerName, gameState, hudConfig]) // Include all dependencies that should trigger a game engine reset

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

  // If in landing state, show landing page
  if (gameState === 'landing') {
    return <LandingPage onJoinLobby={handleJoinLobby} />;
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
        <button onClick={() => toggleHUDElement('showCrosshair')}>
          {hudConfig.showCrosshair ? 'Hide Crosshair' : 'Show Crosshair'}
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
