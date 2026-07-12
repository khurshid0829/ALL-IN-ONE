import { useState, useEffect, useCallback, Fragment } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatQty } from '../lib/formatNumbers'
import ColumnFilterIcon from './ColumnFilterIcon'
import NumberInput from './NumberInput'
import '../styles/dataTable.css'

const STATUS_OPTIONS = [
  { key: 'low', label: 'Kam qoldi' },
  { key: 'ok', label: 'Yetarli' },
  { key: 'unknown', label: "Noma'lum" },
]

function RangeFilterPanel({ value, onApply, onClear, close }) {
  const [min, setMin] = useState(value.min || '')
  const [max, setMax] = useState(value.max || '')
  const inputStyle = { padding: '5px 7px', fontSize: 12, borderRadius: 6, border: '1px solid var(--shell-line)' }
  return (
    <>
      <div className="col-filter__row">
        <label>Min</label>
        <NumberInput value={min} onChange={setMin} style={inputStyle} placeholder="\u2014" />
      </div>
      <div className="col-filter__row">
        <label>Max</label>
        <NumberInput value={max} onChange={setMax} style={inputStyle} placeholder="\u2014" />
      </div>
      <div className="col-filter__actions">
        <button
          type="button"
          className="col-filter__clear-btn"
          onClick={() => { onClear(); close() }}
        >
          Tozalash
        </button>
        <button
          type="button"
          className="col-filter__apply-btn"
          onClick={() => { onApply({ min, max }); close() }}
        >
          Qo'llash
        </button>
      </div>
    </>
  )
}

function StatusFilterPanel({ value, onApply, onClear, close }) {
  const [selected, setSelected] = useState(new Set(value))
  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  return (
    <>
      {STATUS_OPTIONS.map((opt) => (
        <label key={opt.key} className="col-filter__check">
          <input
            type="checkbox"
            checked={selected.has(opt.key)}
            onChange={() => toggle(opt.key)}
          />
          {opt.label}
        </label>
      ))}
      <div className="col-filter__actions">
        <button
          type="button"
          className="col-filter__clear-btn"
          onClick={() => { onClear(); close() }}
        >
          Tozalash
        </button>
        <button
          type="button"
          className="col-filter__apply-btn"
          onClick={() => { onApply(selected); close() }}
        >
          Qo'llash
        </button>
      </div>
    </>
  )
}

const CATEGORY_LABELS = {
  asosiy: 'Asosiy',
  qadoqlash: 'Qadoqlash',
  qoshimcha: "Qo'shimcha",
  __none__: 'Boshqa',
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

function monthDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const toIso = (d) => d.toISOString().slice(0, 10)
  return {
    startIso: toIso(start),
    nextMonthStartIso: toIso(nextMonthStart),
    daysElapsed: now.getDate(), // oyning necha kuni o'tgani (masalan 12)
  }
}

/**
 * StockBalancePanel — joriy ombor qoldig'ini ko'rsatadi.
 *
 * Diqqat: warehouse_current_balance view'i faqat shu oy uchun
 * warehouse_opening qatori kiritilgan SKU'larni qamrab oladi (module 3
 * arxitekturasiga mos). Agar biror SKU uchun bu oy ochilish qoldig'i
 * kiritilmagan bo'lsa, "Joriy qoldiq" ustunida "—" ko'rsatiladi
 * (0 emas — chunki haqiqiy qoldiq noma'lum, hali hisoblanmagan).
 */
export default function StockBalancePanel({ departmentId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [category, setCategory] = useState('__all__')
  const [onlyLow, setOnlyLow] = useState(false)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [sortConfig, setSortConfig] = useState({ key: 'display_name', direction: 'asc' })
  const [qtyFilter, setQtyFilter] = useState({ min: '', max: '' })
  const [avgFilter, setAvgFilter] = useState({ min: '', max: '' })
  const [statusFilter, setStatusFilter] = useState(
    () => new Set(STATUS_OPTIONS.map((o) => o.key))
  )

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  function sortIndicator(key) {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' \u25B4' : ' \u25BE'
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const monthKey = currentMonthKey()
    const { startIso, nextMonthStartIso, daysElapsed } = monthDateRange()

    const [skuRes, balanceRes, entriesRes, openingRes] = await Promise.all([
      supabase
        .from('sku_master')
        .select('id, sku_code, display_name, unit, category, min_stock_level, tur')
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .eq('tur', 'XOM')
        .order('category', { ascending: true })
        .order('display_name', { ascending: true })
        .limit(1000),
      supabase
        .from('warehouse_current_balance')
        .select('sku_id, current_qty')
        .eq('department_id', departmentId)
        .eq('month_key', monthKey),
      supabase
        .from('warehouse_entries')
        .select('sku_id, qty_in, qty_out')
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .gte('entry_date', startIso)
        .lt('entry_date', nextMonthStartIso)
        .limit(5000),
      supabase
        .from('warehouse_opening')
        .select('sku_id, opening_qty')
        .eq('department_id', departmentId)
        .eq('month_key', monthKey),
    ])

    if (skuRes.error) {
      setErrorMsg('Nomenklaturani yuklashda xatolik: ' + skuRes.error.message)
      setLoading(false)
      return
    }
    if (balanceRes.error) {
      setErrorMsg('Qoldiqni yuklashda xatolik: ' + balanceRes.error.message)
      setLoading(false)
      return
    }
    if (entriesRes.error) {
      setErrorMsg('Kirim/chiqimni yuklashda xatolik: ' + entriesRes.error.message)
      setLoading(false)
      return
    }
    if (openingRes.error) {
      setErrorMsg('Oy boshi qoldig\u2018ini yuklashda xatolik: ' + openingRes.error.message)
      setLoading(false)
      return
    }

    const balanceMap = new Map(
      (balanceRes.data || []).map((r) => [r.sku_id, r.current_qty])
    )
    const openingMap = new Map(
      (openingRes.data || []).map((r) => [r.sku_id, r.opening_qty])
    )

    // Har bir SKU uchun shu oydagi umumiy kirim/chiqimni yig'amiz
    const totalsMap = new Map()
    for (const entry of entriesRes.data || []) {
      const prev = totalsMap.get(entry.sku_id) || { totalIn: 0, totalOut: 0 }
      totalsMap.set(entry.sku_id, {
        totalIn: prev.totalIn + Number(entry.qty_in || 0),
        totalOut: prev.totalOut + Number(entry.qty_out || 0),
      })
    }

    const merged = (skuRes.data || []).map((sku) => {
      const currentQty = balanceMap.has(sku.id) ? balanceMap.get(sku.id) : null
      const isLow =
        sku.min_stock_level != null &&
        currentQty != null &&
        Number(currentQty) < Number(sku.min_stock_level)
      const totals = totalsMap.get(sku.id) || { totalIn: 0, totalOut: 0 }
      const avgDailyOut =
        sku.tur === 'XOM' && daysElapsed > 0 ? totals.totalOut / daysElapsed : null
      // Holat ustuni bo'yicha saralash uchun: 0=Kam qoldi, 1=Yetarli, 2=Noma'lum
      const statusRank =
        sku.min_stock_level == null || currentQty == null ? 2 : isLow ? 0 : 1
      return {
        ...sku,
        current_qty: currentQty,
        opening_qty: openingMap.has(sku.id) ? openingMap.get(sku.id) : null,
        is_low: isLow,
        total_in: totals.totalIn,
        total_out: totals.totalOut,
        avg_daily_out: avgDailyOut,
        status_rank: statusRank,
      }
    })

    setRows(merged)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    load()
  }, [load])

  const categoryKeys = Array.from(
    new Set(rows.map((r) => (r.category && r.category.trim() ? r.category : '__none__')))
  )

  const filtered = rows.filter((r) => {
    const rowCategory = r.category && r.category.trim() ? r.category : '__none__'
    if (category !== '__all__' && rowCategory !== category) return false
    if (onlyLow && !r.is_low) return false

    if (qtyFilter.min !== '' && (r.current_qty == null || Number(r.current_qty) < Number(qtyFilter.min))) return false
    if (qtyFilter.max !== '' && (r.current_qty == null || Number(r.current_qty) > Number(qtyFilter.max))) return false

    if (avgFilter.min !== '' && (r.avg_daily_out == null || Number(r.avg_daily_out) < Number(avgFilter.min))) return false
    if (avgFilter.max !== '' && (r.avg_daily_out == null || Number(r.avg_daily_out) > Number(avgFilter.max))) return false

    if (statusFilter.size < STATUS_OPTIONS.length) {
      const key = r.status_rank === 0 ? 'low' : r.status_rank === 1 ? 'ok' : 'unknown'
      if (!statusFilter.has(key)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const { key, direction } = sortConfig
    const av = a[key]
    const bv = b[key]
    const aNull = av == null
    const bNull = bv == null
    if (aNull && bNull) return 0
    if (aNull) return 1 // bo'sh qiymatlar doim oxirida
    if (bNull) return -1

    let cmp
    if (typeof av === 'string') {
      cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' })
    } else {
      cmp = av - bv
    }
    return direction === 'asc' ? cmp : -cmp
  })

  return (
    <div style={styles.panel}>
      <div style={styles.headerRow}>
        <h2 style={styles.panelTitle}>Joriy qoldiq</h2>
        <button type="button" onClick={load} style={styles.refreshBtn}>
          Yangilash
        </button>
      </div>

      <div style={styles.controlsRow}>
        <div style={styles.tabRow}>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(category === '__all__' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setCategory('__all__')}
          >
            Hammasi
          </button>
          {categoryKeys.map((key) => (
            <button
              key={key}
              type="button"
              style={{
                ...styles.tabBtn,
                ...(category === key ? styles.tabBtnActive : {}),
              }}
              onClick={() => setCategory(key)}
            >
              {CATEGORY_LABELS[key] || key}
            </button>
          ))}
        </div>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
          />
          Faqat kam qolganlar
        </label>
      </div>

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
      {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

      {!loading && filtered.length === 0 && (
        <p style={styles.emptyText}>Bu filtrga mos yozuv yo'q.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="dtable-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="dtable dtable-fixed">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>
                  <span className="dtable-sortable" onClick={() => handleSort('sku_code')}>
                    SKU{sortIndicator('sku_code')}
                  </span>
                </th>
                <th>
                  <span className="dtable-sortable" onClick={() => handleSort('display_name')}>
                    Nomi{sortIndicator('display_name')}
                  </span>
                </th>
                <th className="dtable-right dtable-group-divider dtable-emphasis">
                  <span className="dtable-sortable" onClick={() => handleSort('current_qty')}>
                    Qoldiq{sortIndicator('current_qty')}
                  </span>
                  <ColumnFilterIcon
                    active={qtyFilter.min !== '' || qtyFilter.max !== ''}
                    panel={({ close }) => (
                      <RangeFilterPanel
                        value={qtyFilter}
                        onApply={setQtyFilter}
                        onClear={() => setQtyFilter({ min: '', max: '' })}
                        close={close}
                      />
                    )}
                  />
                </th>
                <th className="dtable-right">
                  <span className="dtable-sortable" onClick={() => handleSort('avg_daily_out')}>
                    Kunlik sarf{sortIndicator('avg_daily_out')}
                  </span>
                  <ColumnFilterIcon
                    active={avgFilter.min !== '' || avgFilter.max !== ''}
                    panel={({ close }) => (
                      <RangeFilterPanel
                        value={avgFilter}
                        onApply={setAvgFilter}
                        onClear={() => setAvgFilter({ min: '', max: '' })}
                        close={close}
                      />
                    )}
                  />
                </th>
                <th className="dtable-group-divider">
                  <span className="dtable-sortable" onClick={() => handleSort('status_rank')}>
                    Holat{sortIndicator('status_rank')}
                  </span>
                  <ColumnFilterIcon
                    active={statusFilter.size < STATUS_OPTIONS.length}
                    panel={({ close }) => (
                      <StatusFilterPanel
                        value={statusFilter}
                        onApply={setStatusFilter}
                        onClear={() => setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.key)))}
                        close={close}
                      />
                    )}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const isExpanded = expandedIds.has(row.id)
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => toggleExpand(row.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--canvas-text-muted)' }}>
                        {isExpanded ? '\u25BE' : '\u25B8'}
                      </td>
                      <td>{row.sku_code}</td>
                      <td className="dtable-truncate">{row.display_name}</td>
                      <td className="dtable-right dtable-group-divider dtable-emphasis mono-figure">
                        {formatQty(row.current_qty)}
                        {row.current_qty != null && row.unit ? ` ${row.unit}` : ''}
                      </td>
                      <td className="dtable-right mono-figure">
                        {row.avg_daily_out != null ? formatQty(row.avg_daily_out) : '\u2014'}
                      </td>
                      <td className="dtable-group-divider">
                        {row.min_stock_level == null || row.current_qty == null ? (
                          <span style={styles.badgeUnknown}>Noma'lum</span>
                        ) : row.is_low ? (
                          <span style={styles.badgeLow}>Kam qoldi</span>
                        ) : (
                          <span style={styles.badgeOk}>Yetarli</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="dtable-detail-row">
                        <td colSpan={6}>
                          <div className="dtable-detail">
                            <span>
                              <strong>Oy boshi:</strong> {formatQty(row.opening_qty)}
                            </span>
                            <span>
                              <strong>Bu oy kirim:</strong> {formatQty(row.total_in)}
                            </span>
                            <span>
                              <strong>Bu oy chiqim:</strong> {formatQty(row.total_out)}
                            </span>
                            <span>
                              <strong>Minimal:</strong> {formatQty(row.min_stock_level)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={styles.footnoteSmall}>
        Tafsilotlar (oy boshi, kirim, chiqim) uchun qatorni bosing.
      </p>

      <p style={styles.footnote}>
        Eslatma: "Minimal" ustuni hozircha bo'sh &mdash; uni Bigmanager har bir
        mahsulot uchun to'ldirgach, "Kam qoldi" ogohlantirishi ishlay boshlaydi.
        Agar biror mahsulot uchun bu oy uchun ochilish qoldig'i kiritilmagan
        bo'lsa, "Joriy qoldiq" "&mdash;" bo'lib ko'rinadi.
      </p>
    </div>
  )
}

const styles = {
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '24px 24px 20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  panelTitle: { margin: 0, color: 'var(--canvas-text)', fontSize: 17 },
  refreshBtn: {
    background: 'transparent',
    border: '1px solid var(--canvas-text-muted)',
    color: 'var(--canvas-text-muted)',
    padding: '5px 10px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 12,
  },
  controlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  tabRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tabBtn: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid var(--canvas-text-muted)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    cursor: 'pointer',
    fontSize: 12,
  },
  tabBtnActive: {
    background: 'var(--copper)',
    borderColor: 'var(--copper)',
    color: '#fff',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: 'var(--canvas-text-muted)',
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
    marginBottom: 12,
  },
  statusText: { color: 'var(--canvas-text-muted)' },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 14 },
  tableWrap: { overflowX: 'auto', maxHeight: 360, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: 'var(--canvas)',
  },
  thRight: {
    textAlign: 'right',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: 'var(--canvas)',
  },
  td: {
    padding: '9px 10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
  },
  tdRight: {
    padding: '9px 10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  badgeOk: {
    fontSize: 12,
    color: 'var(--teal)',
    background: 'var(--teal-soft)',
    padding: '3px 8px',
    borderRadius: 999,
  },
  badgeLow: {
    fontSize: 12,
    color: 'var(--danger)',
    background: '#f0dcd5',
    padding: '3px 8px',
    borderRadius: 999,
  },
  badgeUnknown: {
    fontSize: 12,
    color: 'var(--canvas-text-muted)',
    background: '#e9e2d3',
    padding: '3px 8px',
    borderRadius: 999,
  },
  footnote: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--canvas-text-muted)',
    lineHeight: 1.5,
  },
  footnoteSmall: {
    marginTop: 8,
    fontSize: 11,
    color: 'var(--canvas-text-muted)',
    fontStyle: 'italic',
  },
  avgNote: {
    fontSize: 11,
    color: 'var(--canvas-text-muted)',
    fontWeight: 400,
    marginTop: 2,
  },
}
