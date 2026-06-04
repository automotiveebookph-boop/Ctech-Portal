import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { TanStackStartVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackStartVite({
      autoCodeSplitting: true,
      server: {
        preset: 'vercel',
      },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-router'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
})
