import { defineConfig } from '@tanstack/react-start/config'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: {
    plugins: [tsConfigPaths(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-router'],
    },
  },
  server: {
    preset: 'vercel',
  },
})
