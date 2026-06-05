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

// Create a Node.js-compatible wrapper around server.js
// Handles both fetch-API style and Node.js style exports
const wrapper = `
import { createServer } from 'http'

// Dynamically load the TanStack Start server handler
const mod = await import('./server.js')
const handler = mod.default ?? mod

let nodeHandler

if (typeof handler === 'function') {
  // Already a Node.js (req, res) handler
  nodeHandler = handler
} else if (handler && typeof handler.fetch === 'function') {
  // Fetch API style: convert to Node.js handler
  nodeHandler = async (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const url = \`\${protocol}://\${host}\${req.url}\`

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined

    const request = new Request(url, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ),
      body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    })

    const response = await handler.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf)
  }
} else {
  nodeHandler = (req, res) => {
    res.statusCode = 500
    res.end('Server handler not found')
  }
}

export default nodeHandler
`

fs.writeFileSync(`${FUNC_DIR}/handler.mjs`, wrapper)

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
