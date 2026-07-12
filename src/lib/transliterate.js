/**
 * transliterate.js — Kirildan Lotinga harf-harfiga aylantirish, qidiruv
 * uchun. Muammo: mahsulot nomlari bazada Kiril alifboda ("Какос"), lekin
 * foydalanuvchi ba'zan Lotin klaviaturada yozadi ("kakos"). Bu funksiya
 * Kiril matnni Lotinga aylantirib, ikkalasini solishtirish imkonini beradi.
 */

const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function cyrillicToLatin(str) {
  if (!str) return ''
  let result = ''
  for (const ch of str.toLowerCase()) {
    result += ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch] : ch
  }
  return result
}

/**
 * Matn berilgan so'rovga mos keladimi — avval to'g'ridan-to'g'ri (Kiril
 * so'rov, Kiril matn), keyin Lotin translitratsiyasi orqali ("kakos"
 * so'rovi "Какос" matniga mos tushishi uchun).
 */
export function matchesSearchQuery(text, query) {
  if (!text || !query) return false
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return false
  if (t.includes(q)) return true
  return cyrillicToLatin(text).includes(q)
}
