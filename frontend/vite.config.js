import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The local preview may be reached through a temporary Cloudflare tunnel.
  // This only affects `vite dev`; the Render static build is unchanged.
  server: {
    allowedHosts: true,
  },
})
