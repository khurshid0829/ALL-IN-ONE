import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney } from '../lib/formatNumbers'
import AccountSwitcher from '../components/AccountSwitcher'
import MonthlyClosingPanel from '../components/MonthlyClosingPanel'
import WarehouseEntryScreen from './WarehouseEntryScreen'

function som(value) {
  return formatMoney(value) + ' so‘m'
}
function usd(value) {
  return '$' + formatMoney(value)
}

const MODULE_CARDS = [
  { key: 'warehouse', label: 'Ombor', desc: "Xomashyo kirim/chiqim", enabled: true },
  { key: 'sales', label: 'Nakladnoy / Savdo', desc: 'Yuk harakatlari', enabled: false },
  { key: 'finance', label: 'Moliya', desc: "Xarajat, yetkazib beruvchi hisobi", enabled: false },
  { key: 'payments', label: "To'lovlar", desc: "Mijoz to'lovlari", enabled: false },
  { key: 'production', label: 'Ishlab chiqarish', desc: 'Kunlik ishlab chiqarish', enabled: false },
  { key: 'archive', label: 'Arxiv', desc: "Arxivlash / qaytarish", enabled: true },
]

/**
 * Bigmanager panel — Account Switcher, 3 ko'rsatkich (Kassa/Mijoz qarzi/
 * Yetkazuvchi qarzi), 6 modul kartasi, "Oyni yopish" paneli
 * (DECISIONS.md 2026-07-12 tasdiqlangan maket).
 *
 * DIQQAT: cash_current_balance/customer_debt_balance/supplier_debt_balance
 * view'lari hali security_invoker=true bilan emas (PROGRESS.md'dagi ochiq
 * xavfsizlik eslatmasi) — shuning uchun bu yerda department_id bo'yicha
 * filtr QO'LDA, majburiy qo'yiladi (aks holda barcha bo'lim ma'lumoti
 * qo'shilib ketardi).
 */
export default function BigmanagerPanel({
  departmentId,
  departmentName,
  appUserId,
  onSignOut,
  onOpenArchive,
  linkedAccounts,
}) {
  const [subView, setSubView] = useState('main')
  const [kpi, setKpi] = useState({
    cashSom: 0,
    cashUsd: 0,
    customerDebtSom: 0,
    supplierDebtSom: 0,
    supplierDebtUsd: 0,
  })
  const [kpiLoading, setKpiLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const loadKpi = useCallback(async () => {
    setKpiLoading(true)

    const [cashRes, customerRes, supplierRes] = await Promise.all([
      supabase.from('cash_current_balance').select('currency, balance_som').eq('department_id', departmentId),
      supabase.from('customer_debt_balance').select('debt_som').eq('department_id', departmentId),
      supabase.from('supplier_debt_balance').select('currency, debt_amount').eq('department_id', departmentId),
    ])

    const cashRows = cashRes.data ?? []
    const cashSom = cashRows.filter((r) => r.currency === 'SOM').reduce((s, r) => s + Number(r.balance_som || 0), 0)
    const cashUsd = cashRows.filter((r) => r.currency === 'USD').reduce((s, r) => s + Number(r.balance_som || 0), 0)

    const customerDebtSom = (customerRes.data ?? []).reduce((s, r) => s + Number(r.debt_som || 0), 0)

    const supplierRows = supplierRes.data ?? []
    const supplierDebtSom = supplierRows.filter((r) => r.currency === 'SOM').reduce((s, r) => s + Number(r.debt_amount || 0), 0)
    const supplierDebtUsd = supplierRows.filter((r) => r.currency === 'USD').reduce((s, r) => s + Number(r.debt_amount || 0), 0)

    setKpi({ cashSom, cashUsd, customerDebtSom, supplierDebtSom, supplierDebtUsd })
    setKpiLoading(false)
  }, [departmentId])

  useEffect(() => {
    loadKpi()
  }, [loadKpi])

  function handleCardClick(card) {
    if (!card.enabled) {
      setToast("Bu modul keyingi bosqichda qo'shiladi.")
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2500)
      return
    }
    if (card.key === 'warehouse') {
      setSubView('warehouse')
    } else if (card.key === 'archive') {
      onOpenArchive()
    }
  }

  if (subView === 'warehouse') {
    return (
      <WarehouseEntryScreen
        departmentId={departmentId}
        departmentName={departmentName}
        userId={appUserId}
        onSignOut={onSignOut}
        onBack={() => setSubView('main')}
      />
    )
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Bigmanager</span>
        <div style={styles.headerRight}>
          <AccountSwitcher
            currentAppUserId={appUserId}
            currentDepartmentName={departmentName}
            accounts={linkedAccounts.accounts}
            onSwitch={linkedAccounts.switchAccount}
            onAdd={linkedAccounts.addAccount}
            onRemove={linkedAccounts.removeAccount}
            switching={linkedAccounts.switching}
            adding={linkedAccounts.adding}
            addError={linkedAccounts.addError}
            clearAddError={linkedAccounts.clearAddError}
          />
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.kpiRow}>
          <KpiCard
            label="Kassa"
            primary={kpiLoading ? '—' : som(kpi.cashSom)}
            secondary={!kpiLoading && kpi.cashUsd ? usd(kpi.cashUsd) : null}
          />
          <KpiCard
            label="Mijoz qarzi"
            primary={kpiLoading ? '—' : som(kpi.customerDebtSom)}
          />
          <KpiCard
            label="Yetkazuvchi qarzi"
            primary={kpiLoading ? '—' : som(kpi.supplierDebtSom)}
            secondary={!kpiLoading && kpi.supplierDebtUsd ? usd(kpi.supplierDebtUsd) : null}
          />
        </div>

        <div style={styles.cardsGrid}>
          {MODULE_CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              style={{
                ...styles.moduleCard,
                ...(card.enabled ? {} : styles.moduleCardDisabled),
              }}
              onClick={() => handleCardClick(card)}
            >
              <span style={styles.moduleCardLabel}>{card.label}</span>
              <span style={styles.moduleCardDesc}>{card.desc}</span>
              {!card.enabled && <span style={styles.comingSoonBadge}>Tez orada</span>}
            </button>
          ))}
        </div>

        <MonthlyClosingPanel departmentId={departmentId} appUserId={appUserId} />
      </main>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

function KpiCard({ label, primary, secondary }) {
  return (
    <div style={styles.kpiCard}>
      <span style={styles.kpiLabel}>{label}</span>
      <span className="mono-figure" style={styles.kpiValue}>{primary}</span>
      {secondary && <span className="mono-figure" style={styles.kpiSecondary}>{secondary}</span>}
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
    maxWidth: 980,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  kpiRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: { fontSize: 12, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  kpiValue: { fontSize: 22, fontWeight: 600, color: 'var(--canvas-text)' },
  kpiSecondary: { fontSize: 13, color: 'var(--copper)' },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  moduleCard: {
    position: 'relative',
    textAlign: 'left',
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    border: 'none',
    padding: '18px 18px 20px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  moduleCardDisabled: {
    opacity: 0.55,
    cursor: 'default',
  },
  moduleCardLabel: { fontSize: 15, fontWeight: 600, color: 'var(--canvas-text)' },
  moduleCardDesc: { fontSize: 12, color: 'var(--canvas-text-muted)' },
  comingSoonBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--copper)',
    background: 'var(--copper-soft)',
    padding: '2px 8px',
    borderRadius: 999,
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 28,
    transform: 'translateX(-50%)',
    background: 'var(--shell-navy-deep)',
    border: '1px solid var(--shell-line)',
    color: 'var(--on-navy)',
    padding: '10px 18px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
    boxShadow: 'var(--shadow-panel)',
  },
}
