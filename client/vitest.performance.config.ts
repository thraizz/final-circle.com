import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/performance/**/*.test.{ts,tsx}'],
    timeout: 30000, // Longer timeout for performance tests
  },
}); 