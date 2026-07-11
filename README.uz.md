# Yagona Boshqaruv Tizimi — Frontend (8-modul, boshlang'ich)

Bu paket hozircha faqat 2 narsani qiladi:
1. Login ekrani (Supabase Auth orqali)
2. Kirgandan keyin rolga qarab yo'naltirish — Founder bo'lsa vaqtinchalik
   "xush kelibsiz" sahifasi, boshqa rol bo'lsa "hali qurilmagan" xabari.

Haqiqiy Founder Dashboard (mijoz qarzlari, oylik yopish jamlanmasi) —
keyingi bosqichda shu loyihaning ichiga qo'shiladi.

## Kerakli narsa: `departments` jadvalidagi nom ustuni

`src/lib/useAppSession.js` faylida `departments(name)` deb yozilgan.
Agar sizning bazangizda bo'lim nomi ustuni boshqacha nomlangan bo'lsa
(masalan `nomi`), shu faylda ikki joyni almashtirish kerak bo'ladi.

## Kerakli narsa: Founder test hisobi

Hozircha sizda 5 ta Bigmanager test hisob bor, lekin **Founder rolidagi
hisob bormi — aniq emas**. Agar yo'q bo'lsa, tizimga Founder sifatida
kirib ko'rish uchun avval shuni yaratish kerak (pastdagi qadamlarda
tushuntirilgan).
