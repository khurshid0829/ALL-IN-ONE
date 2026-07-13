import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Bu xato .env.local (mahalliy) yoki Vercel Environment Variables
  // (joylashtirilgan holatda) to'g'ri sozlanmaganda chiqadi.
  console.error(
    'Supabase sozlamalari topilmadi. .env.local faylida VITE_SUPABASE_URL va ' +
      'VITE_SUPABASE_ANON_KEY qiymatlari borligini tekshiring.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Asosiy `supabase` mijozining faol sessiyasiga tegmasdan, boshqa
 * hisob (email/parol) bilan kirishni tekshirish uchun vaqtinchalik mijoz.
 * Account Switcher'da "boshqa hisob qo'shish" oqimida ishlatiladi —
 * shu tufayli joriy ekran sessiyasi bir lahzaga ham almashib qolmaydi.
 */
export function createEphemeralClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
