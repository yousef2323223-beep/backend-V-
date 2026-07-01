#!/bin/bash
# VynorPay — إعداد سريع للتطوير المحلي
set -e

echo "⬡  VynorPay Backend Setup"
echo "─────────────────────────"

# 1. تثبيت المكتبات
echo "📦 Installing dependencies..."
npm install

# 2. إنشاء .env إذا غير موجود
if [ ! -f .env ]; then
  echo "📄 Creating .env from .env.example..."
  cp .env.example .env
  # توليد JWT secret تلقائي
  JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/change-this-to-a-random-64-char-secret/$JWT/" .env
  else
    sed -i "s/change-this-to-a-random-64-char-secret/$JWT/" .env
  fi
  echo "✅ .env created with random JWT_SECRET"
  echo "⚠️  Edit DATABASE_URL in .env to point to your PostgreSQL"
fi

# 3. توليد Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env — set DATABASE_URL"
echo "  2. npm run db:push   — create tables"
echo "  3. npm run db:seed   — add demo data"
echo "  4. npm run dev       — start server"
echo ""
echo "API: http://localhost:4000"
echo "Health: http://localhost:4000/health"
