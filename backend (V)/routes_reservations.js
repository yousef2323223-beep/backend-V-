// routes/reservations.js
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

// GET /reservations — كل الحجوزات
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query
    const where = { tenantId: req.tenantId }
    if (status) where.status = status
    if (date) {
      const d = new Date(date)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      where.reservedAt = { gte: d, lt: next }
    }
    const res2 = await prisma.reservation.findMany({
      where,
      include: { space: { select: { name: true } } },
      orderBy: { reservedAt: 'asc' }
    })
    res.json(res2)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /reservations
router.post('/', async (req, res) => {
  try {
    const { guestName, guestPhone, guestCount = 2, reservedAt, spaceId, notes } = req.body
    if (!guestName || !reservedAt) {
      return res.status(400).json({ error: 'guestName and reservedAt required' })
    }
    const reservation = await prisma.reservation.create({
      data: {
        tenantId: req.tenantId,
        guestName, guestPhone: guestPhone || null,
        guestCount: parseInt(guestCount),
        reservedAt: new Date(reservedAt),
        spaceId:    spaceId || null,
        notes:      notes   || null,
      }
    })
    // Mark space as reserved if today
    if (spaceId) {
      const today = new Date().toDateString()
      const resDate = new Date(reservedAt).toDateString()
      if (today === resDate) {
        await prisma.space.updateMany({
          where: { id: spaceId, tenantId: req.tenantId, status: 'free' },
          data:  { status: 'reserved', note: `${guestName}` }
        })
      }
    }
    res.status(201).json(reservation)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /reservations/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['pending','confirmed','seated','cancelled','no_show']
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const exists = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Reservation not found' })

    const r = await prisma.reservation.update({ where: { id: req.params.id }, data: { status } })
    res.json(r)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /reservations/:id
router.delete('/:id', async (req, res) => {
  try {
    const exists = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!exists) return res.status(404).json({ error: 'Reservation not found' })
    await prisma.reservation.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
