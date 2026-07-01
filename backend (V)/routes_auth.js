// routes/auth.js — Register, Login, PIN login
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const prisma  = require('../lib/prisma')
const { signToken } = require('../lib/jwt')

// ── POST /auth/register ──────────────────────────────
// Body: { email, password, companyName, businessType, currency?, locale? }
router.post('/register', async (req, res) => {
  try {
    const { email, password, companyName, businessType, currency = 'EUR', locale = 'de' } = req.body

    if (!email || !password || !companyName || !businessType) {
      return res.status(400).json({ error: 'email, password, companyName, businessType required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const existing = await prisma.tenant.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, 12)

    const tenant = await prisma.tenant.create({
      data: { email, passwordHash, companyName, businessType, currency, locale }
    })

    // Create default Admin employee for this tenant
    const pinHash = await bcrypt.hash('1234', 10)
    await prisma.employee.create({
      data: { tenantId: tenant.id, name: 'Admin', pinHash, role: 'admin' }
    })

    // Seed default categories based on businessType
    await seedDefaultCategories(tenant.id, businessType, locale)

    const token = signToken({ tenantId: tenant.id, role: 'admin' })

    res.status(201).json({
      token,
      tenant: {
        id:           tenant.id,
        companyName:  tenant.companyName,
        businessType: tenant.businessType,
        currency:     tenant.currency,
        locale:       tenant.locale,
        plan:         tenant.plan,
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /auth/login ─────────────────────────────────
// Body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { email } })
    if (!tenant || !tenant.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, tenant.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken({ tenantId: tenant.id, role: 'tenant' })

    res.json({
      token,
      tenant: {
        id:           tenant.id,
        companyName:  tenant.companyName,
        businessType: tenant.businessType,
        currency:     tenant.currency,
        locale:       tenant.locale,
        plan:         tenant.plan,
        taxDine:      tenant.taxDine,
        taxTakeaway:  tenant.taxTakeaway,
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /auth/pin ───────────────────────────────────
// Body: { tenantId, pin }
// Used by employees at the POS PIN screen
router.post('/pin', async (req, res) => {
  try {
    const { tenantId, pin } = req.body
    if (!tenantId || !pin) {
      return res.status(400).json({ error: 'tenantId and pin required' })
    }

    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true }
    })

    // Check PIN against all employees (bcrypt compare)
    let matched = null
    for (const emp of employees) {
      const ok = await bcrypt.compare(String(pin), emp.pinHash)
      if (ok) { matched = emp; break }
    }

    if (!matched) return res.status(401).json({ error: 'Wrong PIN' })

    const token = signToken({
      tenantId,
      employeeId: matched.id,
      role:       matched.role,
    })

    res.json({
      token,
      employee: { id: matched.id, name: matched.name, role: matched.role }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Helper: seed default categories ─────────────────
async function seedDefaultCategories(tenantId, businessType, locale) {
  const catSets = {
    restaurant: [
      { nameDe: 'Heißgetränke', nameEn: 'Hot Drinks',  nameAr: 'مشروبات ساخنة' },
      { nameDe: 'Kaltgetränke', nameEn: 'Cold Drinks', nameAr: 'مشروبات باردة' },
      { nameDe: 'Speisen',      nameEn: 'Food',         nameAr: 'أكل' },
      { nameDe: 'Desserts',     nameEn: 'Desserts',     nameAr: 'حلويات' },
    ],
    cafe: [
      { nameDe: 'Kaffee',       nameEn: 'Coffee',       nameAr: 'قهوة' },
      { nameDe: 'Tee',          nameEn: 'Tea',           nameAr: 'شاي' },
      { nameDe: 'Gebäck',       nameEn: 'Pastries',      nameAr: 'معجنات' },
    ],
    retail: [
      { nameDe: 'Allgemein',    nameEn: 'General',       nameAr: 'عام' },
      { nameDe: 'Lebensmittel', nameEn: 'Food',          nameAr: 'طعام' },
      { nameDe: 'Getränke',     nameEn: 'Beverages',     nameAr: 'مشروبات' },
    ],
    hotel: [
      { nameDe: 'Zimmer',       nameEn: 'Rooms',         nameAr: 'غرف' },
      { nameDe: 'Minibar',      nameEn: 'Minibar',       nameAr: 'ميني بار' },
      { nameDe: 'Services',     nameEn: 'Services',      nameAr: 'خدمات' },
    ],
    service: [
      { nameDe: 'Dienstleistungen', nameEn: 'Services',  nameAr: 'خدمات' },
      { nameDe: 'Ersatzteile',      nameEn: 'Parts',     nameAr: 'قطع غيار' },
    ],
  }

  const cats = catSets[businessType] || catSets.retail
  for (let i = 0; i < cats.length; i++) {
    await prisma.category.create({
      data: { tenantId, ...cats[i], sortOrder: i }
    })
  }
}

module.exports = router
