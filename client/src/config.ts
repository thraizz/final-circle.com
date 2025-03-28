// Backend configuration
const isProduction = window.location.hostname !== 'localhost';

// Backend server settings
export const BACKEND = {
  // Base HTTP URL
  BASE_URL: isProduction ? 'https://backend.final-circle.com' : 'http://localhost:5173',
  // WebSocket URL
  WS_URL: isProduction ? 'wss://backend.final-circle.com:8000/ws' : 'ws://localhost:8000/ws',
};

export default BACKEND; 