import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: true,
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: true,
  },
})
