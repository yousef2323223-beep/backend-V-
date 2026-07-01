// routes/reports.js — تقارير المبيعات
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth, requireAdmin)

// GET /reports/summary?period=today|week|month
router.get('/summary', async (req, res) => {
  try {
    const { period = 'today' } = req.query
    const now  = new Date()
    let from

    if (period === 'today') {
      from = new Date(now.toDateString())
    } else if (period === 'week') {
      from = new Date(now); from.setDate(from.getDate() - 7)
    } else if (period === 'month') {
      from = new Date(now); from.setDate(from.getDate() - 30)
    } else {
      from = new Date(period) // custom date
    }

    const where = { tenantId: req.tenantId, status: 'paid', createdAt: { gte: from } }

    const [orders, itemStats, spaceCount] = await Promise.all([
      prisma.order.findMany({ where, select: { total: true, paymentMethod: true, createdAt: true } }),
      prisma.orderItem.findMany({
        where:   { order: where },
        select:  { itemName: true, quantity: true, lineTotal: true },
        orderBy: { quantity: 'desc' }
      }),
      prisma.space.count({ where: { tenantId: req.tenantId } }),
    ])

    const revenue = orders.reduce((s, o) => s + o.total, 0)
    const count   = orders.length
    const avg     = count ? revenue / count : 0

    // Hourly breakdown
    const byHour = Array(24).fill(0)
    orders.forEach(o => { byHour[new Date(o.createdAt).getHours()] += o.total })

    // Payment breakdown
    const byPayment = {}
    orders.forEach(o => {
      byPayment[o.paymentMethod] = (byPayment[o.paymentMethod] || 0) + o.total
    })

    // Best sellers
    const itemMap = {}
    itemStats.forEach(i => {
      if (!itemMap[i.itemName]) itemMap[i.itemName] = { name: i.itemName, qty: 0, revenue: 0 }
      itemMap[i.itemName].qty     += i.quantity
      itemMap[i.itemName].revenue += i.lineTotal
    })
    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10)

    res.json({
      period,
      revenue:     parseFloat(revenue.toFixed(2)),
      orderCount:  count,
      avgOrder:    parseFloat(avg.toFixed(2)),
      spaceCount,
      byHour,
      byPayment,
      bestSellers,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/inventory — أصناف المخزون المنخفض
router.get('/inventory', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        stockQty: { not: null },
      },
      orderBy: { stockQty: 'asc' }
    })
    const low = items.filter(i => i.stockQty !== null && i.stockAlert !== null && i.stockQty <= i.stockAlert)
    res.json({ all: items, lowStock: low })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
