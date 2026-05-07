const http = require('http')
const { exec } = require('child_process')
const url  = require('url')
const fs   = require('fs')

const PORT = 9876

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  const { pathname, query } = url.parse(req.url, true)

  if (pathname === '/ping') {
    res.writeHead(200)
    return res.end(JSON.stringify({ ok: true }))
  }

  if (pathname === '/send') {
    const phone = (query.phone || '').trim()
    const text  = (query.text  || '').trim()

    if (!phone || !text) {
      res.writeHead(400)
      return res.end(JSON.stringify({ error: 'Missing phone or text' }))
    }

    // Write to temp files (avoids command-line escaping issues)
    fs.writeFileSync('C:\\FleetFlow\\pending_phone.txt',   phone, 'utf8')
    fs.writeFileSync('C:\\FleetFlow\\pending_message.txt', text,  'utf8')

    // Trigger AutoHotkey script
    exec('"C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe" "C:\\FleetFlow\\FleetViberSendFile.ahk"',
      (err) => { if (err) console.error('AHK error:', err.message) }
    )

    res.writeHead(200)
    return res.end(JSON.stringify({ ok: true }))
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`FleetFlow Viber server running → http://localhost:${PORT}`)
})
