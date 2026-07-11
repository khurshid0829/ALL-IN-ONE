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
