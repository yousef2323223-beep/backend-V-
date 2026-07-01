// routes/categories.js
const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const cats = await prisma.category.findMany({
      where:   { tenantId: req.tenantId },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' }
    })
    res.json(cats)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nameDe, nameEn, nameAr } = req.body
    if (!nameDe) return res.status(400).json({ error: 'nameDe required' })
    const count = await prisma.category.count({ where: { tenantId: req.tenantId } })
    const cat = await prisma.category.create({
      data: {
        tenantId: req.tenantId,
        nameDe, nameEn: nameEn || nameDe, nameAr: nameAr || nameDe,
        sortOrder: count
      }
    })
    res.status(201).json(cat)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.category.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Category not found' })
    const cat = await prisma.category.update({
      where: { id: req.params.id },
      data:  { ...req.body, tenantId: undefined }
    })
    res.json(cat)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const exists = await prisma.category.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!exists) return res.status(404).json({ error: 'Category not found' })
    await prisma.category.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
