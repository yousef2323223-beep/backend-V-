// routes/items.js — CRUD للأصناف + بحث بالباركود
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// All routes require auth
router.use(requireAuth)

// GET /items — كل أصناف الـ tenant
router.get('/', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where:   { tenantId: req.tenantId, isActive: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { nameDe: 'asc' }],
    })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /items/barcode/:code — بحث بالباركود
router.get('/barcode/:code', async (req, res) => {
  try {
    const item = await prisma.item.findFirst({
      where:   { tenantId: req.tenantId, barcode: req.params.code, isActive: true },
      include: { category: true },
    })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /items — إضافة صنف (admin فقط)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nameDe, nameEn, nameAr, price, taxRate, categoryId,
            barcode, stockQty, stockAlert, photoUrl, color, emoji, modifiers } = req.body

    if (!nameDe || price == null) {
      return res.status(400).json({ error: 'nameDe and price required' })
    }

    const item = await prisma.item.create({
      data: {
        tenantId: req.tenantId,
        nameDe, nameEn: nameEn || nameDe, nameAr: nameAr || nameDe,
        price: parseFloat(price),
        taxRate: parseFloat(taxRate || 19),
        categoryId: categoryId || null,
        barcode: barcode || null,
        stockQty:    stockQty    != null ? parseInt(stockQty)    : null,
        stockAlert:  stockAlert  != null ? parseInt(stockAlert)  : null,
        photoUrl:    photoUrl    || null,
        color:       color       || '#5C4B3A',
        emoji:       emoji       || '🍽️',
        modifiers:   modifiers   || [],
      }
    })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /items/:id — تعديل صنف
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.item.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Item not found' })

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data:  {
        ...req.body,
        price:      req.body.price     ? parseFloat(req.body.price)     : undefined,
        taxRate:    req.body.taxRate   ? parseFloat(req.body.taxRate)   : undefined,
        stockQty:   req.body.stockQty  != null ? parseInt(req.body.stockQty)  : undefined,
        stockAlert: req.body.stockAlert != null ? parseInt(req.body.stockAlert) : undefined,
        tenantId:   undefined, // cannot change tenant
      }
    })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /items/:id/stock — تعديل الكمية فقط (cashier يقدر)
router.put('/:id/stock', async (req, res) => {
  try {
    const { qty, delta } = req.body // qty = قيمة مباشرة, delta = +/- تغيير
    const exists = await prisma.item.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Item not found' })

    let newQty
    if (qty != null) newQty = parseInt(qty)
    else if (delta != null) newQty = Math.max(0, (exists.stockQty || 0) + parseInt(delta))
    else return res.status(400).json({ error: 'qty or delta required' })

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data:  { stockQty: newQty }
    })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /items/:id — حذف ناعم (isActive = false)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.item.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Item not found' })

    await prisma.item.update({
      where: { id: req.params.id },
      data:  { isActive: false }
    })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
