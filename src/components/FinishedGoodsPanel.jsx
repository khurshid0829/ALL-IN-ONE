import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatQty } from '../lib/formatNumbers'
import '../styles/dataTable.css'

/**
 * FinishedGoodsPanel — tayyor mahsulot (MAX) qoldig'ini ko'rsatadi.
 *
 * finished_goods_balance view'i oy bilan cheklanmagan — butun davr
 * bo'yicha (ishlab chiqarilgan − sotilgan) hisoblaydi (StockBalancePanel'dagi
 * warehouse_current_balance'dan farqli, u oy bo'yicha hisoblanadi).
 */
export default function FinishedGoodsPanel({ departmentId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'display_name', direction: 'asc' })

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
    return sortConfig.direction === 'asc' ? ' ▴' : ' ▾'
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from('finished_goods_balance')
      .select('sku_id, sku_code, display_name, total_produced, total_sold, current_qty')
      .eq('department_id', departmentId)
      .order('display_name', { ascending: true })
      .limit(1000)

    if (error) {
      setErrorMsg("Qoldiqni yuklashda xatolik: " + error.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    load()
  }, [load])

  const sorted = [...rows].sort((a, b) => {
    const { key, direction } = sortConfig
    const av = a[key]
    const bv = b[key]
    let cmp
    if (typeof av === 'string') {
      cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' })
    } else {
      cmp = Number(av) - Number(bv)
    }
    return direction === 'asc' ? cmp : -cmp
  })

  return (
    <div style={styles.panel}>
      <div style={styles.headerRow}>
        <h2 style={styles.panelTitle}>Tayyor mahsulot qoldig'i</h2>
        <button type="button" onClick={load} style={styles.refreshBtn}>
          Yangilash
        </button>
      </div>

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
      {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

      {!loading && sorted.length === 0 && (
        <p style={styles.emptyText}>Hozircha ma'lumot yo'q.</p>
      )}

      {!loading && sorted.length > 0 && (
        <div className="dtable-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table className="dtable dtable-fixed">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '36%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
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
                <th className="dtable-right">
                  <span className="dtable-sortable" onClick={() => handleSort('total_produced')}>
                    Ishlab chiqarilgan{sortIndicator('total_produced')}
                  </span>
                </th>
                <th className="dtable-right">
                  <span className="dtable-sortable" onClick={() => handleSort('total_sold')}>
                    Yuklangan{sortIndicator('total_sold')}
                  </span>
                </th>
                <th className="dtable-right dtable-group-divider dtable-emphasis">
                  <span className="dtable-sortable" onClick={() => handleSort('current_qty')}>
                    Qoldiq{sortIndicator('current_qty')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.sku_id}>
                  <td>{row.sku_code}</td>
                  <td className="dtable-truncate">{row.display_name}</td>
                  <td className="dtable-right mono-figure">{formatQty(row.total_produced)}</td>
                  <td className="dtable-right mono-figure">{formatQty(row.total_sold)}</td>
                  <td className="dtable-right dtable-group-divider dtable-emphasis mono-figure">
                    {formatQty(row.current_qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={styles.footnote}>
        Qoldiq = ishlab chiqarilgan jami − yuklangan (sotilgan) jami, tizim
        ishga tushgandan buyon. Oylik emas, umumiy hisob.
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
  footnote: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--canvas-text-muted)',
    lineHeight: 1.5,
  },
}
