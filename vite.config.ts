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
    // noExternal bundles all deps into the server output so Vercel doesn't
    // need a separate node_modules install — but forcing it in dev breaks
    // Vite's SSR module runner for CJS-only deps ("module is not defined").
    // Only bundle everything for the actual production build.
    noExternal: command === 'build' ? true : undefined,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
}))
