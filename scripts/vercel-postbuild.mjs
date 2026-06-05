/**
 * Post-build script for SPA mode:
 * TanStack Start with spa:true produces dist/client/ with index.html
 * We create Vercel Build Output API structure for static serving.
 */

import fs from 'fs'
import path from 'path'

const OUTPUT = '.vercel/output'

// Clean previous output
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT, { recursive: true })
}

// Create static output directory
fs.mkdirSync(`${OUTPUT}/static`, { recursive: true })

// Check if SPA index.html exists
const spaIndex = 'dist/client/index.html'
const clientDir = 'dist/client'

if (!fs.existsSync(spaIndex)) {
  // If no index.html, check dist/ directly
  const distIndex = 'dist/index.html'
  if (fs.existsSync(distIndex)) {
    fs.cpSync('dist', `${OUTPUT}/static`, { recursive: true })
    console.log('Copied from dist/')
  } else {
    console.log('No index.html found - listing dist/client contents:')
    if (fs.existsSync(clientDir)) {
      console.log(fs.readdirSync(clientDir))
    }
    process.exit(1)
  }
} else {
  fs.cpSync(clientDir, `${OUTPUT}/static`, { recursive: true })
  console.log('Copied from dist/client/')
}

// SPA routing: all routes → index.html
fs.writeFileSync(`${OUTPUT}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    {
      src: '/assets/(.+)',
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      continue: true
    },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' }
  ]
}, null, 2))

console.log('✅ Vercel static SPA output created at .vercel/output/')
