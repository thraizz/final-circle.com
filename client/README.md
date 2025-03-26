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

### Planned Migration: React → Pure TypeScript

We plan to migrate away from React to pure TypeScript for several reasons:

1. **Performance** - Eliminating React's reconciliation overhead for better FPS
2. **Bundle Size** - Reducing dependencies to decrease initial load time
3. **Architectural Consistency** - Using a single imperative paradigm throughout the codebase
4. **Simplicity** - Avoiding mixing React's declarative model with Three.js's imperative code

#### Migration Tasks

1. Replace React component lifecycle with TypeScript class initialization
2. Create DOM elements programmatically instead of using JSX
3. Implement simple state management for the HUD configuration
4. Directly manage the canvas and HUD elements in the DOM

This transition will be straightforward as most game logic is already in pure TypeScript classes.

## Game Features

- First-person shooter mechanics
- Multiple weapon types with different characteristics
- Competitive, skill-focused gameplay
- Performance-optimized rendering
- Minimalist but clean UI/HUD
- Networked multiplayer

## HUD System

The game includes a customizable HUD with the following elements:

- FPS counter (with color-coding based on performance)
- Health indicator
- Ammo counter
- Weapon information
- Game time
- Player count

Players can toggle individual HUD elements through the settings panel.

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

## Performance Optimizations

- Reusable THREE.js objects to reduce garbage collection
- Pointer lock implementation for better mouse controls
- Throttled HUD updates (FPS counter updates every 10 frames)
- Optimized renderer settings for better performance
- Object pooling for projectiles and effects
