import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../../engine/GameEngine';

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
}

declare global {
  interface Window {
    WebSocket: typeof WebSocket;
  }
}

// Mock dependencies
vi.mock('three', () => {
  const actualThree = vi.importActual('three');
  return {
    ...actualThree,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      shadowMap: { enabled: false, type: null },
      outputColorSpace: null,
      domElement: document.createElement('canvas'),
    })),
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      children: [],
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { y: 0 },
      lookAt: vi.fn(),
      aspect: 0,
      updateProjectionMatrix: vi.fn(),
    })),
    Object3D: vi.fn().mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 },
      add: vi.fn(),
      remove: vi.fn(),
    })),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() },
      castShadow: false,
      shadow: {
        mapSize: { width: 0, height: 0 },
        camera: { near: 0, far: 0, left: 0, right: 0, top: 0, bottom: 0 },
      },
    })),
  };
});

vi.mock('../../config', () => ({
  BACKEND: {
    WS_URL: 'ws://localhost:8080/ws',
  },
}));

vi.mock('./GameMap', () => ({
  GameMap: vi.fn().mockImplementation(() => ({
    getObstacles: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('./HUD', () => ({
  HUD: vi.fn().mockImplementation(() => ({
    showConnectionStatus: vi.fn(),
    hideConnectionStatus: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('./PlayerControls', () => ({
  PlayerControls: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
  })),
}));

describe('GameEngine', () => {
  let gameEngine: GameEngine;
  let mockWebSocket: MockWebSocket;
  
  // Create a mock for WebSocket
  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };
    
    // Mock window WebSocket constructor
    const MockWebSocketClass = vi.fn(() => mockWebSocket) as unknown as typeof WebSocket;
    Object.defineProperties(MockWebSocketClass, {
      CONNECTING: { value: WebSocket.CONNECTING },
      OPEN: { value: WebSocket.OPEN },
      CLOSING: { value: WebSocket.CLOSING },
      CLOSED: { value: WebSocket.CLOSED },
    });
    
    window.WebSocket = MockWebSocketClass;
    
    // Mock window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn().mockImplementation(callback => {
      setTimeout(() => callback(performance.now()), 0);
      return 0;
    });
    
    // Mock document.body.appendChild
    document.body.appendChild = vi.fn();
    
    // Create the game engine instance
    gameEngine = new GameEngine({}, 'TestPlayer');
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should initialize correctly', () => {
    expect(gameEngine).toBeDefined();
    expect(window.WebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    expect(document.body.appendChild).toHaveBeenCalled();
  });
  
  it('should handle WebSocket connection open event', () => {
    // Simulate WebSocket open event
    if (mockWebSocket.onopen) mockWebSocket.onopen(new Event('open'));
    
    // Verify connection is established
    expect(gameEngine.socketReconnecting).toBe(false);
  });
  
  it('should handle WebSocket connection close event', () => {
    // Mock setTimeout
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = vi.fn().mockImplementation((fn) => {
      return originalSetTimeout(fn, 0);
    });
    
    // Simulate WebSocket close event
    if (mockWebSocket.onclose) mockWebSocket.onclose(new CloseEvent('close', { code: 1000, reason: 'Test close' }));
    
    // Verify reconnection attempt
    expect(gameEngine.socketReconnecting).toBe(true);
    
    // Restore setTimeout
    window.setTimeout = originalSetTimeout;
  });
  
  // Add more tests for player actions, game state updates, etc.
}); 