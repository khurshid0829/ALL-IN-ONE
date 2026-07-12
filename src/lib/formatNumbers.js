/**
 * Butun tizim uchun umumiy raqam formatlash qoidalari (2026-07-12'da kelishilgan):
 *
 * - Minglik ajratuvchi: bo'sh joy       masalan  15150   -> "15 150"
 * - Kasr ajratuvchi: vergul (nuqta emas) masalan  157.16  -> "157,16"
 * - Pul summalari (formatMoney): kasr qismi bo'lsa 2 xonagacha,
 *   BUTUN son bo'lsa kasr umuman ko'rsatilmaydi (150 -> "150", 150,00 EMAS)
 * - Ombor miqdori (formatQty): kasr qismi bo'lsa 1 xonagacha,
 *   BUTUN son bo'lsa kasr ko'rsatilmaydi (150 -> "150", 15.34 -> "15,3")
 *
 * Bu fayl barcha ekranlarda (Founder Dashboard, Ombor, kelajakda Savdo/Moliya)
 * qayta ishlatiladi — raqam ko'rinishi butun tizimda bir xil bo'lishi uchun.
 */

function formatWithDecimals(value, maxDecimals) {
  if (value === null || value === undefined || value === '') return '\u2014'
  const num = Number(value)
  if (Number.isNaN(num)) return '\u2014'

  const factor = 10 ** maxDecimals
  const rounded = Math.round(num * factor) / factor
  const isWhole = Number.isInteger(rounded)

  const fixed = Math.abs(rounded).toFixed(isWhole ? 0 : maxDecimals)
  const [intPart, decPart] = fixed.split('.')
  const intWithSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = rounded < 0 ? '-' : ''

  return decPart ? `${sign}${intWithSpaces},${decPart}` : `${sign}${intWithSpaces}`
}

/** Pul summalari uchun: 2 xonagacha kasr, butun bo'lsa kasrsiz. */
export function formatMoney(value) {
  return formatWithDecimals(value, 2)
}

/** Ombor/ishlab chiqarish miqdori uchun: 1 xonagacha kasr, butun bo'lsa kasrsiz. */
export function formatQty(value) {
  return formatWithDecimals(value, 1)
}

/** Butun sonlar uchun (masalan dona hisob): kasrsiz, faqat minglik ajratuvchi. */
export function formatInt(value) {
  return formatWithDecimals(value, 0)
}
