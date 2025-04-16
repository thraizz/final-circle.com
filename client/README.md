# Final Circle - FPS Game

A skill-focused, high-performance first-person shooter game with minimalist design and clean UI.

## Architecture Overview

### Current Implementation

The game currently uses a hybrid architecture:

- **Three.js** - Core 3D rendering library
- **TypeScript** - For strongly-typed game logic implementation
- **React** - For UI components and state management

Most of the game is implemented in pure TypeScript classes that don't depend on React:

- `GameEngine.ts` - Main game loop, scene management, and rendering
- `PlayerControls.ts` - Input handling, movement, and collision detection
- `WeaponSystem.ts` - Weapon mechanics, shooting, and reloading
- `HUD.ts` - Heads-up display rendering and updates
- `GameMap.ts` - Map loading and obstacles

The React layer is minimal and primarily handles:

1. Component lifecycle management
2. HUD configuration state
3. Settings and instruction panels

- First-person shooter mechanics
- Multiple weapon types with different characteristics
- Competitive, skill-focused gameplay
- Performance-optimized rendering
- Minimalist but clean UI/HUD
- Networked multiplayer

## Controls

- **WASD** - Movement
- **Mouse** - Look around
- **Left Click** - Shoot
- **Right Click** - Aim
- **R** - Reload
- **Space** - Jump
- **1-4** - Switch weapons

## Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
