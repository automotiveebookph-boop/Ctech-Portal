// Vercel Node.js serverless function handler (ESM)
// Wraps TanStack Start's server.js for Vercel compatibility

let _handler = null
let _initError = null

async function getHandler() {
  if (_handler) return _handler
  if (_initError) throw _initError

  try {
    const mod = await import('./server.js')
    const raw = mod.default ?? mod

    if (typeof raw === 'function') {
      _handler = raw
    } else if (raw && typeof raw.fetch === 'function') {
      _handler = async function(req, res) {
        try {
          const protocol = String((req.headers['x-forwarded-proto'] || 'https')).split(',')[0].trim()
          const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
          const url = `${protocol}://${host}${req.url || '/'}`

          const chunks = []
          await new Promise((resolve, reject) => {
            req.on('data', c => chunks.push(c))
            req.on('end', resolve)
            req.on('error', reject)
          })
          const body = chunks.length > 0 ? Buffer.concat(chunks) : null

          const headers = {}
          for (const [k, v] of Object.entries(req.headers || {})) {
            if (v != null) headers[k] = String(v)
          }

          const request = new Request(url, {
            method: req.method || 'GET',
            headers,
            body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : null,
          })

          const response = await raw.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          const ab = await response.arrayBuffer()
          res.end(Buffer.from(ab))
        } catch (err) {
          console.error('SSR fetch error:', err)
          res.statusCode = 500
          res.setHeader('content-type', 'text/plain')
          res.end(`SSR fetch error: ${err?.message || String(err)}\n\n${err?.stack || ''}`)
        }
      }
    } else {
      const type = typeof raw
      const keys = Object.keys(raw || {}).join(', ')
      _handler = (_req, res) => {
        res.statusCode = 500
        res.setHeader('content-type', 'text/plain')
        res.end(`server.js export type: ${type}, keys: ${keys}`)
      }
    }
  } catch (err) {
    console.error('Failed to load server.js:', err)
    _initError = err
    throw err
  }

  return _handler
}

export default async function handler(req, res) {
  try {
    const h = await getHandler()
    return h(req, res)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain')
    res.end(`Init error: ${err?.message || String(err)}\n\n${err?.stack || ''}`)
  }
}
