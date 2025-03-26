# Final Circle

A competitive, skill-focused first-person shooter game with minimalist design and clean UI.

## Project Structure

The project is organized into two main components:

### Client

- Game engine and frontend built with Three.js and TypeScript
- Currently uses React as a thin wrapper, with plans to migrate to pure TypeScript (see [Architecture](#architecture))
- Handles rendering, player input, and game state presentation

### Server

- Go backend for game state management and multiplayer synchronization
- Standard WebSockets for real-time communication
- Manages player connections, match-making, and game state authority

## Architecture

### Current Implementation

The game currently uses a hybrid architecture:

- **Three.js** - Core 3D rendering library
- **TypeScript** - For strongly-typed game logic implementation
- **React** - For UI components and state management
- **WebSockets** - For real-time multiplayer communication

Most of the game is implemented in pure TypeScript classes that don't depend on React:

- `GameEngine.ts` - Main game loop, scene management, and rendering
- `PlayerControls.ts` - Input handling, movement, and collision detection
- `WeaponSystem.ts` - Weapon mechanics, shooting, and reloading
- `HUD.ts` - Heads-up display rendering and updates
- `GameMap.ts` - Map loading and obstacle management

### Planned Migration: React → Pure TypeScript

We plan to migrate away from React to pure TypeScript for several reasons:

1. **Performance** - Eliminating React's reconciliation overhead for better FPS
2. **Bundle Size** - Reducing dependencies to decrease initial load time
3. **Architectural Consistency** - Using a single imperative paradigm throughout the codebase
4. **Simplicity** - Avoiding mixing React's declarative model with Three.js's imperative code

The React layer is currently minimal, primarily handling component lifecycle and UI state. Since most game logic is already in pure TypeScript classes, this transition will be straightforward.

## Game Features

- First-person shooter mechanics with precise aiming and movement
- Multiple weapon types with distinct characteristics
- Performance-optimized rendering for smooth gameplay
- Customizable HUD with performance indicators
- Competitive multiplayer support

## Development

### Prerequisites

- Node.js 18+ and npm
- Go 1.21+
- WebGL-compatible browser

### Setup and Run

```bash
# Install root dependencies (for running both client and server)
npm install

# Install client dependencies
cd client
npm install

# Run both client and server with one command (from root directory)
npm run dev

# Or run them separately:

# Run the client (from client directory)
cd client
npm run dev

# Run the server (from server directory)
cd server
go run main.go
```

## Performance Focus

The game is designed with performance as a primary consideration:

- Optimized Three.js rendering
- Efficient collision detection
- Object pooling for projectiles and effects
- Throttled updates for HUD elements
- Minimal network payload for multiplayer

See the [client README](client/README.md) and [server README](server/README.md) for more detailed information about each component.

## Testing and Optimization Framework

This project includes comprehensive testing and optimization tools for both client and server components:

### Client Testing

- Unit tests for components and game logic
- Performance benchmarks for critical systems
- Network simulation for testing under various conditions

### Server Testing

- Unit tests for server components
- Performance benchmarks for game state management
- Load testing for simulating multiple concurrent players

## Getting Started

### Prerequisites

- Node.js 16+
- Go 1.16+
- Git

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/last-circle.git
cd last-circle
```

2. Set up the testing environment:

```bash
./setup-testing.sh
```

3. Start the development server:

```bash
# Start server (in one terminal)
cd server
go run main.go

# Start client (in another terminal)
cd client
npm install
npm run dev
```

### Running Tests

To run all tests:

```bash
./run-tests.sh all
```

For more specific test runs:

```bash
# Run only client tests
./run-tests.sh client

# Run only server tests
./run-tests.sh server

# Skip load tests
./run-tests.sh all --skip-load

# Skip performance tests
./run-tests.sh all --skip-performance
```

## Documentation

For detailed information about the testing frameworks:

- [Client Testing Documentation](client/src/tests/README.md)
- [Server Testing Documentation](server/tests/README.md)

## License

[License details here]
