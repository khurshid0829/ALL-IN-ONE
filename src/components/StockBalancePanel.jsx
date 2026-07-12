import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatQty } from '../lib/formatNumbers'
import '../styles/dataTable.css'

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
      return {
        ...sku,
        current_qty: currentQty,
        opening_qty: openingMap.has(sku.id) ? openingMap.get(sku.id) : null,
        is_low: isLow,
        total_in: totals.totalIn,
        total_out: totals.totalOut,
        avg_daily_out: avgDailyOut,
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
    return true
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
        <div className="dtable-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nomi</th>
                <th className="dtable-right">Oy boshi</th>
                <th className="dtable-right">Bu oy kirim</th>
                <th className="dtable-right">Bu oy chiqim</th>
                <th className="dtable-right dtable-group-divider">Joriy qoldiq</th>
                <th className="dtable-right">Minimal</th>
                <th className="dtable-group-divider">Holat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.sku_code}</td>
                  <td>{row.display_name}</td>
                  <td className="dtable-right mono-figure">
                    {formatQty(row.opening_qty)}
                  </td>
                  <td className="dtable-right mono-figure">
                    {formatQty(row.total_in)}
                  </td>
                  <td className="dtable-right mono-figure">
                    {formatQty(row.total_out)}
                    {row.avg_daily_out != null && (
                      <div style={styles.avgNote}>
                        o'rtacha: {formatQty(row.avg_daily_out)}/kun
                      </div>
                    )}
                  </td>
                  <td className="dtable-right dtable-group-divider dtable-emphasis mono-figure">
                    {formatQty(row.current_qty)}
                    {row.current_qty != null && row.unit ? ` ${row.unit}` : ''}
                  </td>
                  <td className="dtable-right mono-figure">
                    {formatQty(row.min_stock_level)}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={styles.footnote}>
        Eslatma: "Oy boshi" &mdash; shu oy uchun kiritilgan ochilish qoldig'i
        (warehouse_opening). "Minimal" ustuni hozircha bo'sh &mdash; uni
        Bigmanager har bir mahsulot uchun to'ldirgach, "Kam qoldi"
        ogohlantirishi ishlay boshlaydi. Agar biror mahsulot uchun bu oy
        uchun ochilish qoldig'i kiritilmagan bo'lsa, "Oy boshi" va "Joriy
        qoldiq" ustunlari "&mdash;" bo'lib ko'rinadi. "O'rtacha: .../kun"
        faqat xomashyo (XOM) turidagi mahsulotlarda ko'rinadi.
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
  avgNote: {
    fontSize: 11,
    color: 'var(--canvas-text-muted)',
    fontWeight: 400,
    marginTop: 2,
  },
}
