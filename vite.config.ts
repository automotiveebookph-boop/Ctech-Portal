import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-router'],
  },
  ssr: {
    // noExternal bundles all deps for Vercel production — causes CJS errors in dev
    noExternal: command === 'build' ? true : undefined,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
}))
