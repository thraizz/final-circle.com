// Backend configuration
const isProduction = window.location.hostname !== 'localhost';

// Backend server settings
export const BACKEND = {
  // Base HTTP URL
  BASE_URL: isProduction ? 'http://78.35.145.34:8000' : 'http://localhost:8080',
  // WebSocket URL
  WS_URL: isProduction ? 'ws://78.35.145.34:8000/ws' : 'ws://localhost:8080/ws',
};

export default BACKEND; 