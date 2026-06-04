/**
 * Post-build script: converts TanStack Start's dist/ output
 * into Vercel's Build Output API v3 format (.vercel/output/).
 *
 * TanStack Start produces:
 *   dist/client/  → static assets
 *   dist/server/  → Node.js SSR handler (server.js + assets/)
 *
 * Vercel needs:
 *   .vercel/output/static/        → static assets
 *   .vercel/output/functions/ssr.func/  → serverless function
 *   .vercel/output/config.json    → routing config
 */

import fs from 'fs'
import path from 'path'

const OUTPUT = '.vercel/output'
const FUNC_DIR = `${OUTPUT}/functions/ssr.func`

// Clean previous output
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT, { recursive: true })
}

// Create directories
fs.mkdirSync(FUNC_DIR, { recursive: true })
fs.mkdirSync(`${OUTPUT}/static`, { recursive: true })

// Copy all server files into the function directory
fs.cpSync('dist/server', FUNC_DIR, { recursive: true })

// Vercel Edge Function config (TanStack Start uses Fetch API)
fs.writeFileSync(`${FUNC_DIR}/.vc-config.json`, JSON.stringify({
  runtime: 'edge',
  entrypoint: 'server.js'
}, null, 2))

// Copy static client assets
fs.cpSync('dist/client', `${OUTPUT}/static`, { recursive: true })

// Routing: serve static assets from filesystem, all else → SSR function
fs.writeFileSync(`${OUTPUT}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    {
      src: '/assets/(.+)',
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      continue: true
    },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/ssr' }
  ]
}, null, 2))

console.log('✅ Vercel Build Output created at .vercel/output/')
