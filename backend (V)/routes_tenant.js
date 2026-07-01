// routes/tenant.js — بيانات الشركة + الموظفين
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const bcrypt  = require('bcryptjs')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth)

// GET /tenant/me — بيانات الشركة الحالية
router.get('/me', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: req.tenantId },
      select: {
        id: true, email: true, companyName: true, businessType: true,
        plan: true, currency: true, locale: true, taxDine: true,
        taxTakeaway: true, logoUrl: true, createdAt: true
      }
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    res.json(tenant)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /tenant/me — تحديث إعدادات الشركة
router.put('/me', requireAdmin, async (req, res) => {
  try {
    const { companyName, currency, locale, taxDine, taxTakeaway, logoUrl } = req.body
    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data:  {
        companyName: companyName || undefined,
        currency:    currency    || undefined,
        locale:      locale      || undefined,
        taxDine:     taxDine     != null ? parseFloat(taxDine)     : undefined,
        taxTakeaway: taxTakeaway != null ? parseFloat(taxTakeaway) : undefined,
        logoUrl:     logoUrl     || undefined,
      },
      select: { id: true, companyName: true, currency: true, locale: true, taxDine: true, taxTakeaway: true }
    })
    res.json(tenant)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── EMPLOYEES ─────────────────────────────────────────

// GET /tenant/employees
router.get('/employees', requireAdmin, async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where:   { tenantId: req.tenantId },
      select:  { id: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' }
    })
    res.json(employees)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /tenant/employees
router.post('/employees', requireAdmin, async (req, res) => {
  try {
    const { name, pin, role = 'cashier' } = req.body
    if (!name || !pin) return res.status(400).json({ error: 'name and pin required' })
    if (String(pin).length !== 4 || isNaN(pin)) {
      return res.status(400).json({ error: 'PIN must be 4 digits' })
    }
    const pinHash = await bcrypt.hash(String(pin), 10)
    const emp = await prisma.employee.create({
      data: { tenantId: req.tenantId, name, pinHash, role },
      select: { id: true, name: true, role: true, isActive: true }
    })
    res.status(201).json(emp)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /tenant/employees/:id
router.put('/employees/:id', requireAdmin, async (req, res) => {
  try {
    const { name, pin, role, isActive } = req.body
    const exists = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Employee not found' })

    const data = {}
    if (name)     data.name     = name
    if (role)     data.role     = role
    if (isActive !== undefined) data.isActive = isActive
    if (pin) {
      if (String(pin).length !== 4 || isNaN(pin)) {
        return res.status(400).json({ error: 'PIN must be 4 digits' })
      }
      data.pinHash = await bcrypt.hash(String(pin), 10)
    }

    const emp = await prisma.employee.update({
      where:  { id: req.params.id },
      data,
      select: { id: true, name: true, role: true, isActive: true }
    })
    res.json(emp)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /tenant/employees/:id
router.delete('/employees/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Employee not found' })

    // لا يمكن حذف آخر Admin
    if (exists.role === 'admin') {
      const adminCount = await prisma.employee.count({
        where: { tenantId: req.tenantId, role: 'admin', isActive: true }
      })
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' })
      }
    }
    await prisma.employee.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
