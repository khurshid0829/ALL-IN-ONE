import { useState, useRef, useEffect } from 'react'
import './ColumnFilterIcon.css'

/**
 * ColumnFilterIcon — jadval ustuni sarlavhasiga qo'yiladigan filtr belgisi.
 * Voronka (funnel) ikonkasi: filtr o'chiq bo'lsa kontur, yoqilgan bo'lsa
 * to'ldirilgan (copper rang) — zamonaviy ilovalarda (Notion, Linear, Airtable)
 * keng tarqalgan uslub.
 *
 * Ishlatilishi:
 *   <ColumnFilterIcon
 *     active={qtyFilter.min !== '' || qtyFilter.max !== ''}
 *     panel={({ close }) => (
 *       <RangeFilterPanel value={qtyFilter} onApply={setQtyFilter} close={close} />
 *     )}
 *   />
 *
 * `panel` — funksiya, ichida istalgan filtr formasini (son oralig'i,
 * checkbox ro'yxati va h.k.) qaytaradi. `close` funksiyasi paneldan
 * chaqirilib, filtr qo'llangach oynachani yopadi.
 */
export default function ColumnFilterIcon({ active, panel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <span className="col-filter" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={'col-filter__btn' + (active ? ' col-filter__btn--active' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-label="Filtr"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 4H21L14 12.5V19L10 21V12.5L3 4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill={active ? 'currentColor' : 'none'}
          />
        </svg>
      </button>
      {open && <div className="col-filter__panel">{panel({ close: () => setOpen(false) })}</div>}
    </span>
  )
}
