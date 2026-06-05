/**
 * Post-build script: converts TanStack Start's dist/ output
 * into Vercel's Build Output API v3 format (.vercel/output/).
 */

import fs from 'fs'

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

// Copy the pre-written Node.js handler wrapper (ESM)
fs.copyFileSync('scripts/vercel-handler.mjs', `${FUNC_DIR}/handler.mjs`)

// Add package.json to mark directory as ESM
fs.writeFileSync(`${FUNC_DIR}/package.json`, JSON.stringify({ type: 'module' }, null, 2))

// Vercel Node.js function config
fs.writeFileSync(`${FUNC_DIR}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'handler.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false
}, null, 2))

// Copy static client assets
fs.cpSync('dist/client', `${OUTPUT}/static`, { recursive: true })

// Routing config
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
