import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import NumberInput from './NumberInput'
import CustomDatePicker from './CustomDatePicker'
import MonthPicker from './MonthPicker'
import { formatMoney } from '../lib/formatNumbers'

function som(value) {
  return formatMoney(value) + ' so‘m'
}
function usd(value) {
  return '$' + formatMoney(value)
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * "Oyni yopish" paneli — close_month() Postgres funksiyasini chaqiradi
 * (7-modul). Funksiya o'zi ichida rol/bo'lim/qayta-yopish tekshiruvlarini
 * bajaradi — bu yerda faqat kiritish formasi va natija/tarix ko'rsatiladi.
 */
export default function MonthlyClosingPanel({ departmentId, appUserId }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [rateDate, setRateDate] = useState(todayIso())
  const [rate, setRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(true)
  const [newRateValue, setNewRateValue] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const [closing, setClosing] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadRate = useCallback(async () => {
    setRateLoading(true)
    const { data } = await supabase
      .from('exchange_rates')
      .select('usd_to_som')
      .eq('rate_date', rateDate)
      .maybeSingle()
    setRate(data?.usd_to_som ?? null)
    setRateLoading(false)
  }, [rateDate])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('monthly_closing')
      .select('*')
      .eq('department_id', departmentId)
      .order('month_key', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [departmentId])

  useEffect(() => {
    loadRate()
  }, [loadRate])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function handleSaveRate(e) {
    e.preventDefault()
    if (!newRateValue.trim()) return
    setSavingRate(true)
    setErrorMsg(null)

    const { error } = await supabase.from('exchange_rates').insert({
      rate_date: rateDate,
      usd_to_som: Number(newRateValue),
      created_by: appUserId,
    })

    if (error) {
      setErrorMsg('Kursni saqlashda xatolik: ' + error.message)
      setSavingRate(false)
      return
    }

    setNewRateValue('')
    setSavingRate(false)
    loadRate()
  }

  async function handleCloseMonth() {
    setErrorMsg(null)
    setSuccessMsg(null)
    setClosing(true)

    const { error } = await supabase.rpc('close_month', {
      p_department_id: departmentId,
      p_month_key: monthKey,
      p_rate_date: rateDate,
    })

    if (error) {
      setErrorMsg(error.message)
      setClosing(false)
      return
    }

    setSuccessMsg(`${monthKey} oyi muvaffaqiyatli yopildi.`)
    setClosing(false)
    loadHistory()
  }

  const alreadyClosed = history.some((h) => h.month_key === monthKey)

  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>Oyni yopish</h2>

      <div style={styles.formRow}>
        <div style={styles.field}>
          <label style={styles.label}>Yopiladigan oy</label>
          <MonthPicker value={monthKey} onChange={setMonthKey} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Kurs sanasi (USD/SOM)</label>
          <CustomDatePicker value={rateDate} onChange={setRateDate} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Joriy kurs</label>
          <div style={styles.rateDisplay} className="mono-figure">
            {rateLoading ? '—' : rate != null ? `1$ = ${formatMoney(rate)} so'm` : 'Kiritilmagan'}
          </div>
        </div>
      </div>

      {!rateLoading && rate == null && (
        <form onSubmit={handleSaveRate} style={styles.rateForm}>
          <span style={styles.rateFormLabel}>
            {rateDate} kuni uchun kurs topilmadi — oyni yopishdan oldin kiriting:
          </span>
          <div style={styles.rateFormRow}>
            <NumberInput
              value={newRateValue}
              onChange={setNewRateValue}
              placeholder="masalan 12600"
              style={styles.input}
            />
            <button type="submit" disabled={savingRate} style={styles.secondaryBtn}>
              {savingRate ? 'Saqlanmoqda...' : 'Kursni saqlash'}
            </button>
          </div>
        </form>
      )}

      {alreadyClosed && (
        <div style={styles.warnBox}>
          {monthKey} oyi allaqachon yopilgan — qayta yopib bo'lmaydi.
        </div>
      )}

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
      {successMsg && <div style={styles.successBox}>{successMsg}</div>}

      <button
        type="button"
        disabled={closing || rate == null || alreadyClosed}
        onClick={handleCloseMonth}
        style={styles.closeBtn}
      >
        {closing ? 'Yopilmoqda...' : `${monthKey} oyini yopish`}
      </button>

      <div style={styles.historyWrap}>
        <h3 style={styles.historyTitle}>Yopilgan oylar</h3>

        {historyLoading && <p style={styles.statusText}>Yuklanmoqda...</p>}
        {!historyLoading && history.length === 0 && (
          <p style={styles.emptyText}>Hozircha yopilgan oy yo'q.</p>
        )}

        {!historyLoading && history.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Oy</th>
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
                {history.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{row.month_key}</td>
                    <td style={styles.tdRight} className="mono-figure">{som(row.cash_som)}</td>
                    <td style={styles.tdRight} className="mono-figure">{usd(row.cash_usd)}</td>
                    <td style={styles.tdRight} className="mono-figure">{som(row.customer_debt_som)}</td>
                    <td style={styles.tdRight} className="mono-figure">{som(row.supplier_debt_som)}</td>
                    <td style={styles.tdRight} className="mono-figure">{usd(row.supplier_debt_usd)}</td>
                    <td style={styles.tdRight} className="mono-figure">{som(row.total_assets_som)}</td>
                    <td style={styles.tdRight} className="mono-figure">{som(row.total_liabilities_som)}</td>
                    <td style={styles.tdRight} className="mono-figure">
                      <strong>{som(row.net_position_som)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

const styles = {
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '24px 24px 28px',
  },
  panelTitle: { margin: '0 0 16px', fontSize: 17, fontWeight: 600, color: 'var(--canvas-text)' },
  formRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 },
  label: { fontSize: 12, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  input: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 14,
  },
  rateDisplay: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-control)',
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
    color: 'var(--canvas-text)',
    fontSize: 14,
  },
  rateForm: {
    background: '#fbf1e2',
    border: '1px solid var(--copper-soft)',
    borderRadius: 'var(--radius-control)',
    padding: '12px 14px',
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  rateFormLabel: { fontSize: 13, color: 'var(--canvas-text)' },
  rateFormRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--copper)',
    background: 'transparent',
    color: 'var(--copper)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  warnBox: {
    background: '#fbf1e2',
    border: '1px solid var(--copper-soft)',
    color: '#7a4a1f',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
    marginBottom: 12,
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
  successBox: {
    background: '#12261f',
    border: '1px solid var(--teal)',
    color: 'var(--teal-soft)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
    marginBottom: 12,
  },
  closeBtn: {
    padding: '11px 20px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  historyWrap: { marginTop: 24 },
  historyTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--canvas-text)' },
  statusText: { color: 'var(--canvas-text-muted)' },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 14 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
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
