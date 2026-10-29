import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Company web runs on its own port so it can run alongside the admin
  // frontend (which uses the default 5173).
  server: { port: 5174, strictPort: true },
})
