// Vercel Node.js serverless function handler
// Wraps TanStack Start's server.js for Vercel compatibility

let _handler = null

async function getHandler() {
  if (_handler) return _handler

  const mod = await import('./server.js')
  const raw = mod.default ?? mod

  if (typeof raw === 'function') {
    // Already a Node.js (req, res) handler
    _handler = raw
  } else if (raw && typeof raw.fetch === 'function') {
    // Fetch API style — convert to Node.js
    _handler = function fetchToNode(req, res) {
      const protocol = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
      const url = protocol + '://' + host + (req.url || '/')

      const bodyPromise = new Promise(function(resolve) {
        const chunks = []
        req.on('data', function(c) { chunks.push(c) })
        req.on('end', function() { resolve(chunks.length ? Buffer.concat(chunks) : undefined) })
        req.on('error', function() { resolve(undefined) })
      })

      bodyPromise.then(function(body) {
        const headers = {}
        const rawHeaders = req.headers || {}
        Object.keys(rawHeaders).forEach(function(k) {
          if (rawHeaders[k] != null) headers[k] = String(rawHeaders[k])
        })

        const request = new Request(url, {
          method: req.method || 'GET',
          headers: headers,
          body: (body && req.method !== 'GET' && req.method !== 'HEAD') ? body : null,
        })

        return raw.fetch(request)
      }).then(function(response) {
        res.statusCode = response.status
        response.headers.forEach(function(v, k) { res.setHeader(k, v) })
        return response.arrayBuffer()
      }).then(function(ab) {
        res.end(Buffer.from(ab))
      }).catch(function(err) {
        console.error('Handler error:', err)
        res.statusCode = 500
        res.end('Internal Server Error')
      })
    }
  } else {
    _handler = function(req, res) {
      res.statusCode = 500
      res.end('Server handler not initialized')
    }
  }

  return _handler
}

module.exports = async function handler(req, res) {
  const h = await getHandler()
  return h(req, res)
}
