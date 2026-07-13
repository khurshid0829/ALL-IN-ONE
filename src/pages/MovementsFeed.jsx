import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatQty } from '../lib/formatNumbers'

function som(value) {
  return formatMoney(value) + ' so‘m'
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const start = `${monthKey}-01`
  const end = new Date(year, month, 0).toISOString().slice(0, 10)
  return { start, end }
}

function paymentStatus(totalAmount, paidSom) {
  const total = Number(totalAmount || 0)
  const paid = Number(paidSom || 0)
  if (paid <= 0) return 'qarzda'
  if (paid >= total - 0.01) return 'tolangan'
  return 'qisman'
}

const STATUS_LABEL = {
  tolangan: "To'langan",
  qarzda: 'Qarzda',
  qisman: 'Qisman',
}

const TYPE_TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'kirim', label: 'Kirim' },
  { key: 'chiqim', label: 'Chiqim' },
]

/**
 * Yuk harakatlari — kirim (production_entries) va chiqim (sales) bitta
 * lentada, kun bo'yicha guruhlangan (DECISIONS.md 2026-07-12 maketiga mos).
 * To'lov holati (To'langan/Qarzda/Qisman) sales_payments'dan hisoblanadi —
 * oy bo'yicha cheklanmaydi, chunki to'lov savdo qilingan oydan keyin ham
 * kelishi mumkin.
 */
export default function MovementsFeed({ departmentId, departmentName, onSignOut, onBack }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [typeFilter, setTypeFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')

  const [productionEntries, setProductionEntries] = useState([])
  const [sales, setSales] = useState([])
  const [paidMap, setPaidMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    const { start, end } = monthRange(monthKey)

    const [prodRes, salesRes, paymentsRes] = await Promise.all([
      supabase
        .from('production_entries')
        .select(
          'id, production_date, notes, created_at, production_entry_items(quantity_produced, sku_master(sku_code, display_name, unit))'
        )
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .gte('production_date', start)
        .lte('production_date', end),
      supabase
        .from('sales')
        .select(
          'id, sale_date, vehicle_number, total_amount, created_at, customers(full_name), sale_items(qty, unit_price, line_total, sku_master(sku_code, display_name, unit))'
        )
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .gte('sale_date', start)
        .lte('sale_date', end),
      supabase
        .from('sales_payments')
        .select('sale_id, amount_som')
        .eq('department_id', departmentId)
        .eq('is_archived', false),
    ])

    if (prodRes.error || salesRes.error || paymentsRes.error) {
      setErrorMsg((prodRes.error || salesRes.error || paymentsRes.error).message)
      setLoading(false)
      return
    }

    const paid = {}
    for (const p of paymentsRes.data ?? []) {
      paid[p.sale_id] = (paid[p.sale_id] || 0) + Number(p.amount_som || 0)
    }

    setProductionEntries(prodRes.data ?? [])
    setSales(salesRes.data ?? [])
    setPaidMap(paid)
    setLoading(false)
  }, [departmentId, monthKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  const groups = useMemo(() => {
    const productQuery = productFilter.trim().toLowerCase()
    const customerQuery = customerFilter.trim().toLowerCase()

    const kirimRows = (typeFilter === 'chiqim' || customerQuery)
      ? []
      : productionEntries
          .filter((entry) => {
            if (!productQuery) return true
            return (entry.production_entry_items ?? []).some(
              (item) =>
                item.sku_master?.display_name?.toLowerCase().includes(productQuery) ||
                item.sku_master?.sku_code?.toLowerCase().includes(productQuery)
            )
          })
          .map((entry) => ({ type: 'kirim', date: entry.production_date, sortAt: entry.created_at, data: entry }))

    const chiqimRows = (typeFilter === 'kirim')
      ? []
      : sales
          .filter((sale) => {
            if (customerQuery && !sale.customers?.full_name?.toLowerCase().includes(customerQuery)) return false
            if (!productQuery) return true
            return (sale.sale_items ?? []).some(
              (item) =>
                item.sku_master?.display_name?.toLowerCase().includes(productQuery) ||
                item.sku_master?.sku_code?.toLowerCase().includes(productQuery)
            )
          })
          .map((sale) => ({ type: 'chiqim', date: sale.sale_date, sortAt: sale.created_at, data: sale }))

    const all = [...kirimRows, ...chiqimRows].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return a.sortAt < b.sortAt ? 1 : -1
    })

    const byDate = new Map()
    for (const row of all) {
      if (!byDate.has(row.date)) byDate.set(row.date, [])
      byDate.get(row.date).push(row)
    }
    return Array.from(byDate.entries())
  }, [productionEntries, sales, typeFilter, customerFilter, productFilter])

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Yuk harakatlari</span>
        <div style={styles.headerRight}>
          <span style={styles.roleTag}>{departmentName ?? '—'}</span>
          {onBack && (
            <button style={styles.secondaryBtn} onClick={onBack}>
              &larr; Orqaga
            </button>
          )}
          <button style={styles.secondaryBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.filtersPanel}>
          <div style={styles.tabRow}>
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{
                  ...styles.tabBtn,
                  ...(typeFilter === tab.key ? styles.tabBtnActive : {}),
                }}
                onClick={() => setTypeFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={styles.filterRow}>
            <div style={styles.field}>
              <label style={styles.label}>Oy</label>
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mijoz</label>
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="Mijoz nomi bo'yicha qidirish..."
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mahsulot</label>
              <input
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Mahsulot nomi/SKU..."
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {errorMsg && <div style={styles.errorBox}>Ma'lumotni olishda xato: {errorMsg}</div>}
        {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

        {!loading && !errorMsg && groups.length === 0 && (
          <p style={styles.emptyText}>Bu filtrlar bo'yicha harakat topilmadi.</p>
        )}

        {!loading &&
          groups.map(([date, rows]) => (
            <div key={date} style={styles.dateGroup}>
              <div style={styles.dateHeader}>{date}</div>
              <div style={styles.cardsCol}>
                {rows.map((row) =>
                  row.type === 'kirim' ? (
                    <KirimCard key={'p-' + row.data.id} entry={row.data} />
                  ) : (
                    <ChiqimCard key={'s-' + row.data.id} sale={row.data} paidSom={paidMap[row.data.id] || 0} />
                  )
                )}
              </div>
            </div>
          ))}
      </main>
    </div>
  )
}

function KirimCard({ entry }) {
  const items = entry.production_entry_items ?? []
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.typeBadge, ...styles.typeBadgeKirim }}>Kirim &middot; Ishlab chiqarish</span>
      </div>
      {entry.notes && <div style={styles.cardNote}>{entry.notes}</div>}
      <div style={styles.itemsList}>
        {items.map((item, idx) => (
          <div key={idx} style={styles.itemRow}>
            <span>
              {item.sku_master?.display_name ?? '—'}{' '}
              <span style={styles.itemSku}>{item.sku_master?.sku_code}</span>
            </span>
            <span className="mono-figure">
              {formatQty(item.quantity_produced)} {item.sku_master?.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChiqimCard({ sale, paidSom }) {
  const items = sale.sale_items ?? []
  const status = paymentStatus(sale.total_amount, paidSom)
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.typeBadge, ...styles.typeBadgeChiqim }}>Chiqim &middot; Nakladnoy</span>
        <span style={{ ...styles.statusBadge, ...styles[`statusBadge_${status}`] }}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div style={styles.cardMeta}>
        <span>{sale.customers?.full_name ?? '—'}</span>
        {sale.vehicle_number && <span style={styles.metaMuted}>{sale.vehicle_number}</span>}
      </div>
      <div style={styles.itemsList}>
        {items.map((item, idx) => (
          <div key={idx} style={styles.itemRow}>
            <span>
              {item.sku_master?.display_name ?? '—'}{' '}
              <span style={styles.itemSku}>{item.sku_master?.sku_code}</span>
            </span>
            <span className="mono-figure">
              {formatQty(item.qty)} {item.sku_master?.unit}
            </span>
          </div>
        ))}
      </div>
      <div style={styles.cardFooter}>
        <span style={styles.totalLabel}>Jami</span>
        <span className="mono-figure" style={styles.totalValue}>{som(sale.total_amount)}</span>
      </div>
    </div>
  )
}

const styles = {
  shell: { minHeight: '100vh', background: 'var(--shell-navy)' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--shell-line)',
  },
  headerRight: { display: 'flex', gap: 10, alignItems: 'center' },
  brand: { color: 'var(--on-navy)', fontSize: 14, letterSpacing: '0.02em' },
  roleTag: { color: 'var(--on-navy-muted)', fontSize: 13 },
  secondaryBtn: {
    background: 'transparent',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy-muted)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 13,
  },
  main: {
    maxWidth: 900,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  filtersPanel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '18px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  tabRow: { display: 'flex', gap: 6 },
  tabBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabBtnActive: {
    background: 'var(--copper)',
    borderColor: 'var(--copper)',
    color: '#fff',
    fontWeight: 600,
  },
  filterRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 },
  label: { fontSize: 12, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  input: {
    padding: '9px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 14,
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '12px 16px',
    borderRadius: 'var(--radius-control)',
  },
  statusText: { color: 'var(--on-navy-muted)' },
  emptyText: { color: 'var(--on-navy-muted)', fontSize: 14 },
  dateGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  dateHeader: {
    color: 'var(--on-navy-muted)',
    fontSize: 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  cardsCol: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '14px 18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: {
    fontSize: 11,
    letterSpacing: '0.02em',
    padding: '3px 9px',
    borderRadius: 999,
    fontWeight: 600,
  },
  typeBadgeKirim: { background: 'var(--teal-soft)', color: '#0b4a41' },
  typeBadgeChiqim: { background: 'var(--copper-soft)', color: '#6b3d1a' },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 999,
  },
  statusBadge_tolangan: { background: 'var(--teal-soft)', color: '#0b4a41' },
  statusBadge_qarzda: { background: '#f0dcd5', color: 'var(--danger)' },
  statusBadge_qisman: { background: 'var(--copper-soft)', color: '#6b3d1a' },
  cardMeta: { display: 'flex', gap: 10, fontSize: 13, color: 'var(--canvas-text)' },
  metaMuted: { color: 'var(--canvas-text-muted)' },
  cardNote: { fontSize: 12, color: 'var(--canvas-text-muted)', fontStyle: 'italic' },
  itemsList: { display: 'flex', flexDirection: 'column', gap: 4 },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--canvas-text)',
    padding: '3px 0',
    borderBottom: '1px solid #efe7d6',
  },
  itemSku: { fontSize: 11, color: 'var(--canvas-text-muted)', fontFamily: 'var(--font-mono)' },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    paddingTop: 8,
    borderTop: '1px solid #e6dcc7',
  },
  totalLabel: { fontSize: 12, color: 'var(--canvas-text-muted)' },
  totalValue: { fontSize: 15, fontWeight: 600, color: 'var(--copper)' },
}
