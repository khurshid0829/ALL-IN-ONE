import { useState, useRef, useEffect, useLayoutEffect } from 'react'

/**
 * NumberInput — foydalanuvchi yozayotganda ham minglik ajratuvchi (bo'sh joy)
 * bilan ko'rsatadigan raqam kiritish maydoni.
 *
 * Masalan: foydalanuvchi "15000" deb yozsa, maydonda "15 000" ko'rinadi.
 * Kasr uchun vergul ishlatiladi ("15000,5").
 *
 * value / onChange — har doim "toza" raqam matni (nuqta bilan, masalan "15000.5"
 * yoki ""), bazaga yozish yoki Number() bilan hisoblash uchun tayyor holda.
 * Ekranda ko'rsatish formatini komponentning o'zi hal qiladi.
 */

function onlyDigitsAndOneSeparator(raw) {
  let result = ''
  let seenSep = false
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      result += ch
    } else if ((ch === ',' || ch === '.') && !seenSep) {
      result += ','
      seenSep = true
    }
  }
  return result
}

function groupThousands(intDigits) {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatDisplay(cleanValue) {
  const [intPart, decPart] = cleanValue.split(',')
  const groupedInt = groupThousands(intPart || '')
  return decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt
}

function toDisplayFromRaw(raw) {
  if (raw === '' || raw === null || raw === undefined) return ''
  return formatDisplay(String(raw).replace('.', ','))
}

function countMeaningful(str) {
  return (str.match(/[0-9,]/g) || []).length
}

function positionAfterMeaningful(str, n) {
  if (n <= 0) return 0
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (/[0-9,]/.test(str[i])) {
      count++
      if (count === n) return i + 1
    }
  }
  return str.length
}

export default function NumberInput({
  value,          // "toza" qiymat (nuqta bilan), masalan "15000" yoki ""
  onChange,       // (cleanValueWithDot: string) => void
  placeholder,
  style,
  disabled,
}) {
  const [displayValue, setDisplayValue] = useState(() => toDisplayFromRaw(value))
  const inputRef = useRef(null)
  const pendingCursorRef = useRef(null)

  // Tashqaridan (masalan forma tozalanganda) qiymat o'zgarsa, ko'rinishni yangilaymiz
  useEffect(() => {
    setDisplayValue(toDisplayFromRaw(value))
  }, [value])

  function handleChange(e) {
    const input = e.target
    const rawInputValue = input.value
    const cursorPos = input.selectionStart ?? rawInputValue.length

    const meaningfulBefore = countMeaningful(rawInputValue.slice(0, cursorPos))

    const clean = onlyDigitsAndOneSeparator(rawInputValue)
    const display = formatDisplay(clean)

    setDisplayValue(display)
    pendingCursorRef.current = positionAfterMeaningful(display, meaningfulBefore)

    onChange(clean.replace(',', '.'))
  }

  useLayoutEffect(() => {
    if (pendingCursorRef.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current)
      pendingCursorRef.current = null
    }
  }, [displayValue])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
    />
  )
}
