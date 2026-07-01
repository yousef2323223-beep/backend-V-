// routes/orders.js — إنشاء وجلب الطلبات
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth)

// GET /orders — جلب الطلبات مع فلتر
router.get('/', async (req, res) => {
  try {
    const { date, from, to, status, spaceId, limit = 50 } = req.query

    const where = { tenantId: req.tenantId }
    if (status)  where.status  = status
    if (spaceId) where.spaceId = spaceId

    // تاريخ محدد
    if (date) {
      const d = new Date(date)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      where.createdAt = { gte: d, lt: next }
    } else if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(to)
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, space: { select: { name: true } }, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    parseInt(limit),
    })
    res.json(orders)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /orders — إنشاء طلب جديد
router.post('/', async (req, res) => {
  try {
    const {
      spaceId, orderType = 'dine_in', paymentMethod = 'cash',
      items, discountAmt = 0, customerName, customerRef, note,
      taxRate,
    } = req.body

    if (!items || !items.length) {
      return res.status(400).json({ error: 'items required' })
    }

    // احسب المجاميع
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const after    = subtotal - (parseFloat(discountAmt) || 0)
    const tax      = parseFloat(taxRate || 19)
    const taxAmt   = after * (tax / 100)
    const total    = after + taxAmt

    // رقم الطلب
    const count = await prisma.order.count({ where: { tenantId: req.tenantId } })
    const orderNumber = 'ORD-' + String(count + 1).padStart(6, '0')

    const order = await prisma.order.create({
      data: {
        tenantId:     req.tenantId,
        employeeId:   req.employeeId || null,
        spaceId:      spaceId || null,
        orderNumber,
        orderType,
        status:       'paid',
        subtotal:     parseFloat(subtotal.toFixed(2)),
        discountAmt:  parseFloat(discountAmt),
        taxAmt:       parseFloat(taxAmt.toFixed(2)),
        taxRate:      tax,
        total:        parseFloat(total.toFixed(2)),
        paymentMethod,
        customerName:  customerName || null,
        customerRef:   customerRef  || null,
        note:          note         || null,
        paidAt:        new Date(),
        items: {
          create: items.map(i => ({
            itemId:    i.itemId    || null,
            itemName:  i.itemName,
            unitPrice: parseFloat(i.unitPrice),
            quantity:  parseInt(i.quantity),
            modifier:  i.modifier  || '',
            lineTotal: parseFloat((i.unitPrice * i.quantity).toFixed(2)),
          }))
        }
      },
      include: { items: true }
    })

    // تحديث حالة الطاولة إلى free
    if (spaceId) {
      await prisma.space.update({
        where: { id: spaceId },
        data:  { status: 'free', openedAt: null, note: null }
      })
    }

    // تحديث المخزون
    for (const i of items) {
      if (i.itemId) {
        await prisma.item.updateMany({
          where: { id: i.itemId, tenantId: req.tenantId, stockQty: { not: null } },
          data:  { stockQty: { decrement: i.quantity } }
        })
      }
    }

    res.status(201).json(order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// GET /orders/export — تصدير CSV
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query
    const where = { tenantId: req.tenantId }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(to)
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, space: { select: { name: true } } },
      orderBy: { createdAt: 'asc' }
    })

    const rows = [['ID','Datum','Uhrzeit','Tisch','Typ','Zahlung','MwSt%','Gesamt']]
    for (const o of orders) {
      const d = new Date(o.createdAt)
      rows.push([
        o.orderNumber,
        d.toLocaleDateString('de-DE'),
        d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }),
        o.space?.name || '',
        o.orderType,
        o.paymentMethod,
        o.taxRate,
        o.total.toFixed(2).replace('.', ',')
      ])
    }

    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="vynorpay-export.csv"')
    res.send(csv)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
