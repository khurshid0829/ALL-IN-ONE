import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const numberFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

function som(value) {
  return numberFmt.format(Number(value) || 0) + ' so\u2018m'
}

function usd(value) {
  return '$' + numberFmt.format(Number(value) || 0)
}

export default function FounderDashboard({ onSignOut, onOpenArchive }) {
  const [debtRows, setDebtRows] = useState([])
  const [closingRows, setClosingRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      const [debtResult, closingResult] = await Promise.all([
        supabase
          .from('founder_customer_debt_summary')
          .select('*')
          .order('total_debt_som', { ascending: false }),
        supabase
          .from('founder_monthly_closing_summary')
          .select('*')
          .order('month_key', { ascending: false }),
      ])

      if (!isMounted) return

      if (debtResult.error || closingResult.error) {
        setErrorMsg(
          (debtResult.error && debtResult.error.message) ||
            (closingResult.error && closingResult.error.message)
        )
      } else {
        setDebtRows(debtResult.data ?? [])
        setClosingRows(closingResult.data ?? [])
      }
      setLoading(false)
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
      <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Founder</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={styles.signOutBtn} onClick={onOpenArchive}>
            Arxiv
          </button>
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

        {errorMsg && (
          <div style={styles.errorBox}>Ma'lumotni olishda xato: {errorMsg}</div>
        )}

        {!loading && !errorMsg && (
          <>
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>Mijozlar qarzi (barcha bo'limlar bo'yicha)</h2>

              {debtRows.length === 0 ? (
                <p style={styles.emptyText}>
                  Hozircha qarz ma'lumoti yo'q &mdash; savdo/to'lov yozuvlari kiritilgach shu yerda ko'rinadi.
                </p>
              ) : (
                <div style={styles.debtList}>
                  {debtRows.map((row) => (
                    <div key={row.customer_id} style={styles.debtCard}>
                      <div style={styles.debtCardHeader}>
                        <span style={styles.customerName}>{row.customer_name}</span>
                        <span className="mono-figure" style={styles.totalDebt}>
                          {som(row.total_debt_som)}
                        </span>
                      </div>
                      <div style={styles.chipRow}>
                        {(row.department_breakdown ?? []).map((d, i) => (
                          <span key={i} style={styles.chip}>
                            {d.department_name}:{' '}
                            <span className="mono-figure">{som(d.debt_som)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>Oylik yopish jamlanmasi</h2>

              {closingRows.length === 0 ? (
                <p style={styles.emptyText}>Hozircha yopilgan oy yo'q.</p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Oy</th>
                        <th style={styles.th}>Bo'lim</th>
                        <th style={styles.thRight}>Kassa (som)</th>
                        <th style={styles.thRight}>Kassa (USD)</th>
                        <th style={styles.thRight}>Mijoz qarzi</th>
                        <th style={styles.thRight}>Yetk. qarzi (som)</th>
                        <th style={styles.thRight}>Yetk. qarzi (USD)</th>
                        <th style={styles.thRight}>Aktivlar</th>
                        <th style={styles.thRight}>Majburiyatlar</th>
                        <th style={styles.thRight}>Sof holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closingRows.map((row) => (
                        <tr key={row.month_key}>
                          <td style={styles.td}>{row.month_key}</td>
                          <td style={styles.td}>{row.department_count}</td>
                          <td style={styles.tdRight} className="mono-figure">
                            {som(row.total_cash_som)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {usd(row.total_cash_usd)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {som(row.total_customer_debt_som)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {som(row.total_supplier_debt_som)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {usd(row.total_supplier_debt_usd)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {som(row.total_assets_som)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            {som(row.total_liabilities_som)}
                          </td>
                          <td style={styles.tdRight} className="mono-figure">
                            <strong>{som(row.total_net_position_som)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    background: 'var(--shell-navy)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--shell-line)',
  },
  brand: {
    color: 'var(--on-navy)',
    fontSize: 14,
    letterSpacing: '0.02em',
  },
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
  statusText: {
    color: 'var(--on-navy-muted)',
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '12px 16px',
    borderRadius: 'var(--radius-control)',
  },
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '24px 24px 28px',
  },
  panelTitle: {
    margin: '0 0 16px',
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--canvas-text)',
  },
  emptyText: {
    color: 'var(--canvas-text-muted)',
    fontSize: 14,
  },
  debtList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  debtCard: {
    background: 'var(--canvas-raised)',
    borderRadius: 10,
    padding: '14px 16px',
    border: '1px solid #e6dcc7',
  },
  debtCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  customerName: {
    fontWeight: 600,
    color: 'var(--canvas-text)',
    fontSize: 15,
  },
  totalDebt: {
    color: 'var(--copper)',
    fontWeight: 600,
    fontSize: 15,
  },
  chipRow: {
    marginTop: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    fontSize: 12,
    color: 'var(--canvas-text-muted)',
    background: '#efe7d6',
    padding: '3px 8px',
    borderRadius: 999,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  thRight: {
    textAlign: 'right',
    padding: '8px 10px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    padding: '10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
}
