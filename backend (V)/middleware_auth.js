// middleware/auth.js — JWT verification + tenant isolation
const { verifyToken } = require('../lib/jwt')
const prisma = require('../lib/prisma')

// Verify JWT and attach tenant + employee to req
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }
    const token = header.slice(7)
    const payload = verifyToken(token)

    // Attach to request
    req.tenantId   = payload.tenantId
    req.employeeId = payload.employeeId
    req.role       = payload.role
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Require admin role
function requireAdmin(req, res, next) {
  if (req.role !== 'admin' && req.role !== 'manager') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

module.exports = { requireAuth, requireAdmin }
