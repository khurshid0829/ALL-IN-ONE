import { useState, useRef, useEffect } from 'react'
import './CustomDatePicker.css'

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
const WEEKDAY_LABELS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'] // Dushanbadan boshlab

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toIso(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function parseIso(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

function formatDisplay(iso) {
  const parsed = parseIso(iso)
  if (!parsed) return ''
  return `${pad2(parsed.day)}.${pad2(parsed.month + 1)}.${parsed.year}`
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// JS'da getDay(): 0=Yakshanba...6=Shanba. Bizga Dushanba=0 kerak.
function mondayFirstWeekday(year, month, day) {
  const jsDay = new Date(year, month, day).getDay()
  return (jsDay + 6) % 7
}

/**
 * CustomDatePicker — brauzer/OS'ning o'z taqvimi (native <input type="date">)
 * o'rniga ishlatiladigan, barcha qurilma va brauzerlarda bir xil ko'rinadigan
 * sana tanlash komponenti. Windows/Chrome/Safari/macOS'da bir xil ko'rinadi.
 *
 * value / onChange — har doim ISO format ("YYYY-MM-DD") yoki bo'sh satr "".
 */
export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Sana tanlang',
  allowClear = false,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const parsed = parseIso(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed ? parsed.year : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.month : today.getMonth())

  const containerRef = useRef(null)

  useEffect(() => {
    const p = parseIso(value)
    if (p) {
      setViewYear(p.year)
      setViewMonth(p.month)
    }
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

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function handlePickDay(day) {
    onChange(toIso(viewYear, viewMonth, day))
    setIsOpen(false)
  }

  function handleToday() {
    const t = new Date()
    onChange(toIso(t.getFullYear(), t.getMonth(), t.getDate()))
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setIsOpen(false)
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const leadingBlanks = mondayFirstWeekday(viewYear, viewMonth, 1)
  const cells = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  const isSelected = (day) =>
    parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === day

  const isToday = (day) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day

  return (
    <div className="cdp" ref={containerRef}>
      <button
        type="button"
        className="cdp__trigger"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={value ? 'cdp__trigger-text' : 'cdp__trigger-placeholder'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <span className="cdp__icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        {allowClear && value && (
          <span className="cdp__clear" onClick={handleClear} aria-label="Tozalash">
            ×
          </span>
        )}
      </button>

      {isOpen && (
        <div className="cdp__panel">
          <div className="cdp__panel-header">
            <button type="button" className="cdp__nav-btn" onClick={goPrevMonth}>
              &#8249;
            </button>
            <span className="cdp__month-label">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="cdp__nav-btn" onClick={goNextMonth}>
              &#8250;
            </button>
          </div>

          <div className="cdp__weekday-row">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="cdp__weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="cdp__grid">
            {cells.map((day, idx) =>
              day === null ? (
                <span key={`blank-${idx}`} className="cdp__cell cdp__cell--blank" />
              ) : (
                <button
                  key={day}
                  type="button"
                  className={
                    'cdp__cell cdp__cell--day' +
                    (isSelected(day) ? ' cdp__cell--selected' : '') +
                    (isToday(day) && !isSelected(day) ? ' cdp__cell--today' : '')
                  }
                  onClick={() => handlePickDay(day)}
                >
                  {day}
                </button>
              )
            )}
          </div>

          <div className="cdp__footer">
            <button type="button" className="cdp__today-btn" onClick={handleToday}>
              Bugun
            </button>
            {allowClear && value && (
              <button type="button" className="cdp__clear-btn" onClick={handleClear}>
                Tozalash
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
