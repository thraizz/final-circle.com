import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Determine if we're in production (can be set by build commands or environment)
const isProd = false // Set to true when building for production

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: true,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: true,
  },
})
