// routes/spaces.js — طاولات / غرف / مقاعد
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth)

// GET /spaces — كل الطاولات/الغرف
router.get('/', async (req, res) => {
  try {
    const { areaId, type, status } = req.query
    const where = { tenantId: req.tenantId }
    if (areaId) where.areaId = areaId
    if (type)   where.type   = type
    if (status) where.status = status

    const spaces = await prisma.space.findMany({
      where,
      include: { area: { select: { name: true } } },
      orderBy: [{ area: { sortOrder: 'asc' } }, { name: 'asc' }],
    })
    res.json(spaces)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /spaces — إضافة طاولة/غرفة
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, type = 'table', capacity = 4, shape = 'round', areaId } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    const space = await prisma.space.create({
      data: { tenantId: req.tenantId, name, type, capacity: parseInt(capacity), shape, areaId: areaId || null }
    })
    res.status(201).json(space)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /spaces/:id — تعديل طاولة
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.space.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Space not found' })

    const space = await prisma.space.update({
      where: { id: req.params.id },
      data:  { ...req.body, tenantId: undefined }
    })
    res.json(space)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /spaces/:id/status — تغيير الحالة فقط
router.put('/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body
    const validStatuses = ['free','occupied','reserved','bill','cleaning']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const exists = await prisma.space.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Space not found' })

    const data = { status }
    if (status === 'occupied' && !exists.openedAt) data.openedAt = new Date()
    if (status === 'free') { data.openedAt = null; data.note = null }
    if (note !== undefined) data.note = note

    const space = await prisma.space.update({ where: { id: req.params.id }, data })
    res.json(space)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /spaces/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.space.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Space not found' })
    await prisma.space.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /spaces/areas — المناطق
router.get('/areas', async (req, res) => {
  try {
    const areas = await prisma.area.findMany({
      where:   { tenantId: req.tenantId },
      orderBy: { sortOrder: 'asc' }
    })
    res.json(areas)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /spaces/areas — إضافة منطقة
router.post('/areas', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const count = await prisma.area.count({ where: { tenantId: req.tenantId } })
    const area = await prisma.area.create({
      data: { tenantId: req.tenantId, name, sortOrder: count }
    })
    res.status(201).json(area)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /spaces/areas/:id
router.delete('/areas/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.area.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Area not found' })
    await prisma.area.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
