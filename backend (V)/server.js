// VynorPay Backend — server.js
require('dotenv').config()

const express = require('express')
const cors    = require('cors')
const morgan  = require('morgan')

const app = express()
const isProd = process.env.NODE_ENV === 'production'

// ── CORS ───────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return cb(null, true)
    // In dev: allow all
    if (!isProd) return cb(null, true)
    // In prod: check allowedOrigins
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true)
    }
    cb(new Error('CORS blocked: ' + origin))
  },
  credentials: true,
}))

// ── Body parsing ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Logging ────────────────────────────────────────────
if (!isProd) app.use(morgan('dev'))
else app.use(morgan('combined'))

// ── Security headers ───────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// ── Health ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    ts:      new Date().toISOString(),
    version: '1.0.0',
    env:     process.env.NODE_ENV || 'development',
  })
})

// ── Routes ─────────────────────────────────────────────
app.use('/auth',         require('./routes/auth'))
app.use('/items',        require('./routes/items'))
app.use('/orders',       require('./routes/orders'))
app.use('/spaces',       require('./routes/spaces'))
app.use('/reservations', require('./routes/reservations'))
app.use('/categories',   require('./routes/categories'))
app.use('/reports',      require('./routes/reports'))
app.use('/tenant',       require('./routes/tenant'))

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.path} not found` })
})

// ── Global error handler ───────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500
  if (!isProd) console.error(err)
  res.status(status).json({ error: isProd ? 'Server error' : err.message })
})

// ── Start ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⬡  VynorPay API  →  http://localhost:${PORT}`)
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   DB:  ${process.env.DATABASE_URL?.split('@')[1] || 'local'}\n`)
})

module.exports = app
