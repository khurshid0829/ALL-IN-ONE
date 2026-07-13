import { useState, useEffect, useCallback } from 'react'
import CustomDatePicker from './CustomDatePicker'
import { formatMoney } from '../lib/formatNumbers'
import { loadCustomerLedger, loadSupplierLedger } from '../lib/aktSverka'
import { exportAktSverkaPdf } from '../lib/pdfExport'

function fmtAmount(value, currency) {
  return currency === 'USD' ? '$' + formatMoney(value) : formatMoney(value) + " so'm"
}

function firstDayOfMonthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Akt sverka (o'zaro hisob-kitob dalolatnomasi) — Mijozlar va Yetkazib
 * beruvchilar ekranlarida qayta ishlatiladi. Davr tanlanadi, oqib
 * boruvchi qoldiq bilan ro'yxat ko'rsatiladi, PDF sifatida yuklab
 * olinadi (jspdf/jspdf-autotable, chunki jo'natish kanali sifatida
 * foydalanuvchi PDF'ni tanladi).
 */
export default function AktSverkaPanel({ entityType, entityId, entityName, departmentId, departmentName, onClose }) {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthIso())
  const [dateTo, setDateTo] = useState(todayIso())
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const result =
        entityType === 'customer'
          ? await loadCustomerLedger(entityId, departmentId, dateFrom, dateTo)
          : await loadSupplierLedger(entityId, departmentId, dateFrom, dateTo)
      setSections(result)
    } catch (e) {
      setErrorMsg(e.message)
    }
    setLoading(false)
  }, [entityType, entityId, departmentId, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  function handleDownload() {
    exportAktSverkaPdf({
      entityName,
      departmentName,
      dateFrom,
      dateTo,
      sections,
      generatedAt: new Date().toLocaleString('uz-UZ'),
    })
  }

  const hasData = sections.some((s) => s.rows.length > 0)

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <span style={styles.title}>Akt sverka</span>
        <button type="button" style={styles.closeBtn} onClick={onClose}>
          Yopish
        </button>
      </div>

      <div style={styles.controlsRow}>
        <div style={styles.field}>
          <label style={styles.label}>Dan</label>
          <CustomDatePicker value={dateFrom} onChange={setDateFrom} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Gacha</label>
          <CustomDatePicker value={dateTo} onChange={setDateTo} />
        </div>
        <button
          type="button"
          style={styles.downloadBtn}
          onClick={handleDownload}
          disabled={loading || !!errorMsg || sections.length === 0}
        >
          PDF yuklab olish
        </button>
      </div>

      {errorMsg && <div style={styles.errorBox}>Xato: {errorMsg}</div>}
      {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

      {!loading &&
        !errorMsg &&
        sections.map((section, i) => (
          <div key={i} style={styles.section}>
            <div style={styles.sectionTitle}>{section.title}</div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Sana</th>
                    <th style={styles.th}>Izoh</th>
                    <th style={styles.thRight}>{section.debitLabel}</th>
                    <th style={styles.thRight}>{section.creditLabel}</th>
                    <th style={styles.thRight}>Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}></td>
                    <td style={styles.tdMuted}>Davr boshiga qoldiq</td>
                    <td style={styles.tdRight}></td>
                    <td style={styles.tdRight}></td>
                    <td style={styles.tdRight} className="mono-figure">
                      {fmtAmount(section.openingBalance, section.currency)}
                    </td>
                  </tr>
                  {section.rows.map((r, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{r.date}</td>
                      <td style={styles.td}>{r.label}</td>
                      <td style={styles.tdRight} className="mono-figure">
                        {r.debit ? fmtAmount(r.debit, section.currency) : '—'}
                      </td>
                      <td style={styles.tdRight} className="mono-figure">
                        {r.credit ? fmtAmount(r.credit, section.currency) : '—'}
                      </td>
                      <td style={styles.tdRight} className="mono-figure">
                        {fmtAmount(r.balance, section.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={styles.td}></td>
                    <td style={styles.tdMuted}>
                      <strong>Davr oxiriga qoldiq</strong>
                    </td>
                    <td style={styles.tdRight}></td>
                    <td style={styles.tdRight}></td>
                    <td style={styles.tdRight} className="mono-figure">
                      <strong>{fmtAmount(section.closingBalance, section.currency)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

      {!loading && !errorMsg && !hasData && (
        <p style={styles.emptyText}>Bu davrda operatsiya topilmadi — faqat qoldiq ko'rsatildi.</p>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid #e6dcc7',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--canvas-text)' },
  closeBtn: {
    background: 'transparent',
    border: '1px solid var(--shell-line)',
    color: 'var(--canvas-text-muted)',
    padding: '5px 12px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 12,
  },
  controlsRow: { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  downloadBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '9px 12px',
    borderRadius: 'var(--radius-control)',
    fontSize: 12,
  },
  statusText: { color: 'var(--canvas-text-muted)', fontSize: 13 },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 13 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--canvas-text)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  thRight: {
    textAlign: 'right',
    padding: '6px 8px',
    color: 'var(--canvas-text-muted)',
    fontWeight: 500,
    borderBottom: '1px solid #e6dcc7',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '6px 8px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    whiteSpace: 'nowrap',
  },
  tdMuted: {
    padding: '6px 8px',
    color: 'var(--canvas-text-muted)',
    fontStyle: 'italic',
    borderBottom: '1px solid #efe7d6',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    padding: '6px 8px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
}
