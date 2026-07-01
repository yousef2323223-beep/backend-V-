# VynorPay — دليل النشر على Railway

## المتطلبات
- حساب على [railway.app](https://railway.app) (مجاني)
- Git مثبّت على جهازك
- Node.js 18+ مثبّت محلياً

---

## الخطوة 1 — تثبيت Railway CLI

```bash
npm install -g @railway/cli
railway login
```

---

## الخطوة 2 — إنشاء مشروع جديد على Railway

```bash
# داخل مجلد vynorpay-backend
git init
git add .
git commit -m "initial: VynorPay backend"

railway init
# اختر "Empty Project"
# اسم المشروع: vynorpay
```

---

## الخطوة 3 — إضافة PostgreSQL Database

```bash
railway add
# اختر "Database" → "PostgreSQL"
```

هيك Railway بيضيف `DATABASE_URL` تلقائياً في متغيرات البيئة.

---

## الخطوة 4 — ضبط متغيرات البيئة

```bash
# اضبط هذه المتغيرات في Railway Dashboard → Variables
railway variables set JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
railway variables set NODE_ENV="production"
railway variables set CLIENT_URL="https://your-frontend-domain.com"
```

أو من الـ Dashboard مباشرة:
1. افتح [railway.app](https://railway.app) → مشروعك
2. اضغط على الـ service
3. اختر "Variables"
4. أضف:
   - `JWT_SECRET` = رمز عشوائي طويل
   - `NODE_ENV` = production
   - `CLIENT_URL` = رابط الـ frontend (IONOS)

---

## الخطوة 5 — النشر

```bash
railway up
```

Railway بيعمل تلقائياً:
1. `npm install` (بيشغّل `postinstall` → `prisma generate`)
2. `npm start`

---

## الخطوة 6 — إنشاء جداول قاعدة البيانات

```bash
railway run npm run db:push
```

---

## الخطوة 7 — بيانات تجريبية (اختياري)

```bash
railway run npm run db:seed
```

---

## الخطوة 8 — الحصول على رابط الـ API

```bash
railway domain
# مثال: https://vynorpay-api.up.railway.app
```

---

## الخطوة 9 — تحديث الـ Frontend

افتح `script.js` في الـ frontend وغيّر:

```javascript
// السطر الأول في الـ CONFIG section
const API_URL = 'https://vynorpay-api.up.railway.app'; // رابطك من railway
```

---

## خيار بديل — Render (أبطأ في الـ cold start بس مجاني)

1. اذهب لـ [render.com](https://render.com)
2. "New" → "Web Service"
3. ربط الـ repo من GitHub
4. إعدادات:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. إضافة PostgreSQL database منفصلة
6. اضبط متغيرات البيئة

---

## خيار IONOS (عندك hosting هناك)

IONOS بيدعم Node.js على خطط معينة:

```bash
# على IONOS SSH
cd /var/www/vynorpay
git clone <repo> .
npm install
# اضبط .env
npm run db:push
pm2 start src/server.js --name vynorpay-api
pm2 save
```

---

## التحقق من النشر

```bash
curl https://your-api.up.railway.app/health
# يجب أن يرجع:
# {"status":"ok","version":"1.0.0","env":"production"}
```

---

## متغيرات البيئة المطلوبة

| المتغير | القيمة | ضروري |
|---------|--------|-------|
| `DATABASE_URL` | يُضاف تلقائياً من Railway | ✅ |
| `JWT_SECRET` | رمز عشوائي 64+ حرف | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `CLIENT_URL` | رابط الـ frontend | موصى به |
| `PORT` | يُضبط تلقائياً من Railway | ❌ |

---

## استكشاف الأخطاء

**خطأ: Prisma client not generated**
```bash
railway run npx prisma generate
```

**خطأ: Database connection failed**
- تأكد إن `DATABASE_URL` موجود في الـ Variables
- تأكد إن PostgreSQL service شغّال في Railway

**خطأ: CORS**
- تأكد إن `CLIENT_URL` يحتوي رابط الـ frontend بدون trailing slash
