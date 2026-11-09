# tasq — SmartTask & Individual Reminder System (PWA)

**Tasq** — har bir vazifa uchun individual va mustaqil eslatma tizimiga ega shaxsiy boshqaruv platformasi hamda PWA (Progressive Web App).

## Asosiy Imkoniyatlar

### 1. Individual Eslatma Sozlamalari (Every Task Has Its Own Settings)
- **Eslatma turlari**:
  - Eslatmasiz (`NONE`)
  - Bir martalik eslatma (`ONCE`)
  - Takroriy eslatmalar (`REPEATED`)
  - Maxsus interval (`CUSTOM`)
- **Intervallar**:
  - Har 5, 10, 15, 20, 30, 45 daqiqada
  - Har 1 soat yoki 2 soatda
  - Ixtiyoriy maxsus daqiqa soni
- **Mustaqil vaqt maydonlari**:
  - Vazifa boshlanish sanasi va soati
  - Birinchi eslatma sanasi va soati (mustaqil)
  - Topshiriq muddati (Deadline)

### 2. Telegram Bot & Inline Tugmalar
- `✅ Bajarildi deb belgilash`: Vazifani `DONE` qiladi va kelgusi barcha eslatmalarni darhol to‘xtatadi.
- `⏰ 20 daqiqadan so‘ng` (Snooze 20m): Asosiy intervalni o‘zgartirmasdan keyingi eslatmani 20 daqiqaga kechiktiradi.
- `⏰ 1 soatdan so‘ng` (Snooze 1h): Keyingi eslatmani 1 soatga kechiktiradi.
- `⏸ Pauza` / `▶️ Qayta davom ettirish`: Eslatmalarni vaqtinchalik to‘xtatib turish va tiklash.
- `📋 Vazifani ochish`: Veb-ilovadagi vazifaga to‘g‘ridan-to‘g‘ri havola.

### 3. PWA (Mobile-First — Telefonlar uchun 100% Moslashgan)
- Smartfonlarda o‘rnatiluvchi PWA (Progressive Web App)
- `manifest.json`, Service Worker kesh va offline ishlash
- Pastki qulay navigatsiya paneli (Bottom Navigation Bar)
- O‘rnatish banneri ("Ilovani o‘rnatish")

### 4. Ishonchlilik & Arxitektura
- PostgreSQL + Prisma doimiy fon rejalashtiruvchisi (server qayta yoqilganda eslatmalar yo‘qolmaydi)
- Takroriy xabarlarning oldini olish mexanizmi
- Asia/Tashkent (UTC+5) vaqt mintaqasi

## Ishga tushirish

```bash
# 1. Bog'liqliklarni o'rnatish
npm install

# 2. Bazani sinxronlash
npx prisma db push --schema=apps/api/prisma/schema.prisma

# 3. Ilovani ishga tushirish (API va Web bir vaqtda)
npm run dev
```
