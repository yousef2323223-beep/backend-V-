// prisma/seed.js — بيانات تجريبية للتطوير
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding VynorPay database...')

  // ── Tenant 1: مطعم ──────────────────────────────────
  const t1 = await prisma.tenant.upsert({
    where:  { email: 'demo@restaurant.com' },
    update: {},
    create: {
      email:        'demo@restaurant.com',
      passwordHash: await bcrypt.hash('demo123', 12),
      companyName:  'Café Vienna',
      businessType: 'restaurant',
      currency:     'EUR',
      locale:       'de',
      taxDine:      19,
      taxTakeaway:  7,
    }
  })

  // Admin employee
  await prisma.employee.upsert({
    where:  { id: 'seed-admin-1' },
    update: {},
    create: {
      id:       'seed-admin-1',
      tenantId: t1.id,
      name:     'Admin',
      pinHash:  await bcrypt.hash('1234', 10),
      role:     'admin',
    }
  })
  await prisma.employee.upsert({
    where:  { id: 'seed-cashier-1' },
    update: {},
    create: {
      id:       'seed-cashier-1',
      tenantId: t1.id,
      name:     'Karin Müller',
      pinHash:  await bcrypt.hash('2222', 10),
      role:     'cashier',
    }
  })

  // Areas
  const innen    = await prisma.area.create({ data: { tenantId: t1.id, name: 'Innen',    sortOrder: 0 } })
  const terrasse = await prisma.area.create({ data: { tenantId: t1.id, name: 'Terrasse', sortOrder: 1 } })

  // Spaces (tables)
  for (let i = 1; i <= 5; i++) {
    await prisma.space.create({
      data: { tenantId: t1.id, areaId: innen.id, name: `Tisch ${i}`, type: 'table', capacity: 4, shape: 'round' }
    })
  }
  for (let i = 1; i <= 3; i++) {
    await prisma.space.create({
      data: { tenantId: t1.id, areaId: terrasse.id, name: `T${i}`, type: 'table', capacity: 2, shape: 'square' }
    })
  }

  // Categories
  const cats = [
    { nameDe: 'Heißgetränke', nameEn: 'Hot Drinks',  nameAr: 'مشروبات ساخنة', sortOrder: 0 },
    { nameDe: 'Kaltgetränke', nameEn: 'Cold Drinks', nameAr: 'مشروبات باردة', sortOrder: 1 },
    { nameDe: 'Speisen',      nameEn: 'Food',         nameAr: 'أكل',           sortOrder: 2 },
    { nameDe: 'Desserts',     nameEn: 'Desserts',     nameAr: 'حلويات',        sortOrder: 3 },
  ]
  const createdCats = []
  for (const c of cats) {
    createdCats.push(await prisma.category.create({ data: { tenantId: t1.id, ...c } }))
  }

  // Items
  const [hot, cold, food, sweets] = createdCats
  const items = [
    { nameDe:'Americano',    nameEn:'Americano',    nameAr:'أمريكانو',   price:3.00, catId: hot.id,    emoji:'☕', color:'#5C4B3A', stockQty:100, stockAlert:10 },
    { nameDe:'Cappuccino',   nameEn:'Cappuccino',   nameAr:'كابتشينو',  price:3.80, catId: hot.id,    emoji:'☕', color:'#3D5A80', stockQty:100, stockAlert:10, modifiers:['ohne Zucker','extra Milch'] },
    { nameDe:'Espresso',     nameEn:'Espresso',     nameAr:'إسبريسو',   price:2.50, catId: hot.id,    emoji:'☕', color:'#4A6741', stockQty:100, stockAlert:10 },
    { nameDe:'Orangensaft',  nameEn:'Orange Juice', nameAr:'عصير',      price:3.50, catId: cold.id,   emoji:'🍊', color:'#8B4513', stockQty:20,  stockAlert:5 },
    { nameDe:'Wasser',       nameEn:'Water',        nameAr:'ماء',       price:1.50, catId: cold.id,   emoji:'💧', color:'#5B4A6A', stockQty:50,  stockAlert:10, modifiers:['mit Kohlensäure','still'] },
    { nameDe:'Croissant',    nameEn:'Croissant',    nameAr:'كرواسون',   price:2.80, catId: food.id,   emoji:'🥐', color:'#7A6652', stockQty:15,  stockAlert:3 },
    { nameDe:'Bagel',        nameEn:'Bagel',        nameAr:'بيغل',      price:2.80, catId: food.id,   emoji:'🥯', color:'#2F5233', stockQty:10,  stockAlert:3, modifiers:['mit Butter','mit Frischkäse'] },
    { nameDe:'Schoko Kuchen',nameEn:'Choc Cake',    nameAr:'كعكة',      price:4.50, catId: sweets.id, emoji:'🎂', color:'#3D5A80', stockQty:6,   stockAlert:2 },
  ]
  for (const it of items) {
    await prisma.item.create({
      data: {
        tenantId:   t1.id,
        categoryId: it.catId,
        nameDe:     it.nameDe, nameEn: it.nameEn, nameAr: it.nameAr,
        price:      it.price,  taxRate: 19,
        emoji:      it.emoji,  color:   it.color,
        stockQty:   it.stockQty,  stockAlert: it.stockAlert,
        modifiers:  it.modifiers || [],
      }
    })
  }

  // ── Tenant 2: سوبر ماركت ────────────────────────────
  await prisma.tenant.upsert({
    where:  { email: 'demo@retail.com' },
    update: {},
    create: {
      email:        'demo@retail.com',
      passwordHash: await bcrypt.hash('demo123', 12),
      companyName:  'Al-Nour Market',
      businessType: 'retail',
      currency:     'SYP',
      locale:       'ar',
      taxDine:      0,
      taxTakeaway:  0,
    }
  })

  console.log('✅ Seed complete!')
  console.log('\n📋 Test accounts:')
  console.log('   Restaurant: demo@restaurant.com / demo123  (PIN admin: 1234, cashier: 2222)')
  console.log('   Retail:     demo@retail.com     / demo123')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
