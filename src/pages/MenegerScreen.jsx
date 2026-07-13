import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatQty } from '../lib/formatNumbers'
import NakladnoySection from '../components/NakladnoySection'
import ProductionSection from '../components/ProductionSection'
import FinishedGoodsPanel from '../components/FinishedGoodsPanel'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const TABS = [
  { key: 'nakladnoy', label: 'Nakladnoy' },
  { key: 'production', label: 'Ishlab chiqarish' },
  { key: 'stock', label: 'Qoldiq' },
]

/**
 * MenegerScreen — Meneger uchun 3 bo'limli ekran: Nakladnoy / Ishlab
 * chiqarish / Qoldiq. Meneger summa/qarz/to'lov ma'lumotini KO'RMAYDI,
 * faqat miqdorlar bilan ishlaydi (CLAUDE.md rol ta'rifiga mos).
 *
 * Yuqoridagi kunlik ko'rsatkichlar (ishlab chiqarildi/yuklandi/qoldiq)
 * barcha MAX mahsulotlar bo'yicha oddiy yig'indi — birliklar (kg/dona)
 * turlicha bo'lsa ham aralashtirilib qo'shiladi (tasdiqlangan maket shunday).
 */
export default function MenegerScreen({
  departmentId,
  departmentName,
  appUserId,
  authUserId,
  onSignOut,
}) {
  const [activeTab, setActiveTab] = useState('nakladnoy')

  const [kpi, setKpi] = useState({ produced: 0, shipped: 0, stock: 0 })
  const [kpiLoading, setKpiLoading] = useState(true)

  const loadKpi = useCallback(async () => {
    setKpiLoading(true)
    const today = todayIso()

    const [producedRes, shippedRes, stockRes] = await Promise.all([
      supabase
        .from('production_entry_items')
        .select('quantity_produced, production_entries!inner(department_id, production_date, is_archived)')
        .eq('production_entries.department_id', departmentId)
        .eq('production_entries.production_date', today)
        .eq('production_entries.is_archived', false),
      supabase
        .from('sale_items')
        .select('qty, sales!inner(department_id, sale_date, is_archived)')
        .eq('is_archived', false)
        .eq('sales.department_id', departmentId)
        .eq('sales.sale_date', today)
        .eq('sales.is_archived', false),
      supabase
        .from('finished_goods_balance')
        .select('current_qty')
        .eq('department_id', departmentId),
    ])

    const producedTotal = (producedRes.data ?? []).reduce(
      (sum, r) => sum + Number(r.quantity_produced || 0),
      0
    )
    const shippedTotal = (shippedRes.data ?? []).reduce((sum, r) => sum + Number(r.qty || 0), 0)
    const stockTotal = (stockRes.data ?? []).reduce(
      (sum, r) => sum + Number(r.current_qty || 0),
      0
    )

    setKpi({ produced: producedTotal, shipped: shippedTotal, stock: stockTotal })
    setKpiLoading(false)
  }, [departmentId])

  useEffect(() => {
    loadKpi()
  }, [loadKpi])

  function handleDataChanged() {
    loadKpi()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Meneger</span>
        <div style={styles.headerRight}>
          <span style={styles.roleTag}>Meneger &middot; {departmentName ?? '—'}</span>
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.kpiRow}>
          <KpiCard label="Bugun ishlab chiqarildi" value={kpi.produced} loading={kpiLoading} />
          <KpiCard label="Bugun yuklandi" value={kpi.shipped} loading={kpiLoading} />
          <KpiCard label="Joriy qoldiq" value={kpi.stock} loading={kpiLoading} emphasis />
        </div>

        <div style={styles.tabRow}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              style={{
                ...styles.tabBtn,
                ...(activeTab === tab.key ? styles.tabBtnActive : {}),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'nakladnoy' && (
          <NakladnoySection
            departmentId={departmentId}
            appUserId={appUserId}
            onSaved={handleDataChanged}
          />
        )}
        {activeTab === 'production' && (
          <ProductionSection
            departmentId={departmentId}
            authUserId={authUserId}
            onSaved={handleDataChanged}
          />
        )}
        {activeTab === 'stock' && <FinishedGoodsPanel departmentId={departmentId} />}
      </main>
    </div>
  )
}

function KpiCard({ label, value, loading, emphasis }) {
  return (
    <div style={{ ...styles.kpiCard, ...(emphasis ? styles.kpiCardEmphasis : {}) }}>
      <span style={styles.kpiLabel}>{label}</span>
      <span className="mono-figure" style={styles.kpiValue}>
        {loading ? '—' : formatQty(value)}
      </span>
      <span style={styles.kpiUnit}>dona</span>
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
  headerRight: { display: 'flex', gap: 14, alignItems: 'center' },
  brand: { color: 'var(--on-navy)', fontSize: 14, letterSpacing: '0.02em' },
  roleTag: { color: 'var(--on-navy-muted)', fontSize: 13 },
  signOutBtn: {
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
  kpiRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiCardEmphasis: {
    background: 'linear-gradient(135deg, var(--canvas), var(--canvas-raised))',
    border: '1px solid var(--copper-soft)',
  },
  kpiLabel: { fontSize: 12, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  kpiValue: { fontSize: 26, fontWeight: 600, color: 'var(--canvas-text)' },
  kpiUnit: { fontSize: 11, color: 'var(--canvas-text-muted)' },
  tabRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tabBtn: {
    padding: '8px 16px',
    borderRadius: 999,
    border: '1px solid var(--on-navy-muted)',
    background: 'transparent',
    color: 'var(--on-navy)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  tabBtnActive: {
    background: 'var(--copper)',
    borderColor: 'var(--copper)',
    color: '#fff',
  },
}
