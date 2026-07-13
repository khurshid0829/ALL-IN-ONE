import { useState, useRef, useEffect } from 'react'
import './CustomDatePicker.css'

const MONTH_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun',
  'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
]
const MONTH_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseMonthKey(key) {
  if (!key) return null
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return null
  return { year: y, month: m - 1 }
}

function toMonthKey(year, month) {
  return `${year}-${pad2(month + 1)}`
}

/**
 * MonthPicker — CustomDatePicker bilan bir xil vizual tilda (cdp__* CSS
 * klasslari), lekin kun emas, oy darajasida tanlash uchun ("YYYY-MM").
 * Brauzerning o'z native <input type="month"> o'rniga ishlatiladi.
 */
export default function MonthPicker({ value, onChange, placeholder = 'Oy tanlang' }) {
  const [isOpen, setIsOpen] = useState(false)
  const parsed = parseMonthKey(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed ? parsed.year : today.getFullYear())

  const containerRef = useRef(null)

  useEffect(() => {
    const p = parseMonthKey(value)
    if (p) setViewYear(p.year)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handlePickMonth(monthIdx) {
    onChange(toMonthKey(viewYear, monthIdx))
    setIsOpen(false)
  }

  function handleCurrentMonth() {
    onChange(toMonthKey(today.getFullYear(), today.getMonth()))
    setViewYear(today.getFullYear())
    setIsOpen(false)
  }

  const isSelected = (monthIdx) => parsed && parsed.year === viewYear && parsed.month === monthIdx
  const isCurrent = (monthIdx) => today.getFullYear() === viewYear && today.getMonth() === monthIdx

  return (
    <div className="cdp" ref={containerRef}>
      <button type="button" className="cdp__trigger" onClick={() => setIsOpen((o) => !o)}>
        <span className={value ? 'cdp__trigger-text' : 'cdp__trigger-placeholder'}>
          {parsed ? `${MONTH_FULL[parsed.month]} ${parsed.year}` : placeholder}
        </span>
        <span className="cdp__icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="cdp__panel">
          <div className="cdp__panel-header">
            <button type="button" className="cdp__nav-btn" onClick={() => setViewYear((y) => y - 1)}>
              &#8249;
            </button>
            <span className="cdp__month-label">{viewYear}</span>
            <button type="button" className="cdp__nav-btn" onClick={() => setViewYear((y) => y + 1)}>
              &#8250;
            </button>
          </div>

          <div className="cdp__month-grid">
            {MONTH_SHORT.map((label, idx) => (
              <button
                key={label}
                type="button"
                className={
                  'cdp__month-cell' +
                  (isSelected(idx) ? ' cdp__month-cell--selected' : '') +
                  (isCurrent(idx) && !isSelected(idx) ? ' cdp__month-cell--current' : '')
                }
                onClick={() => handlePickMonth(idx)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="cdp__footer">
            <button type="button" className="cdp__today-btn" onClick={handleCurrentMonth}>
              Joriy oy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
