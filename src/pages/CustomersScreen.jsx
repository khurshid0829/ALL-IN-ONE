import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import CustomDatePicker from '../components/CustomDatePicker'
import NumberInput from '../components/NumberInput'
import { formatMoney } from '../lib/formatNumbers'

function som(value) {
  return formatMoney(value) + ' so‘m'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const FILTER_TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'debtors', label: 'Qarzdorlar' },
]

/**
 * Mijozlar — qidiruv + Qarzdorlar filtri, har qatorda qarz + tezkor
 * "To'lov kiritish" (DECISIONS.md 2026-07-12 maketiga mos, USD filtri
 * kiritilmadi — foydalanuvchi tasdiqladi, chunki mijoz qarzi doim
 * SOM'da hisoblanadi).
 *
 * customer_debt_balance hali security_invoker=true bilan emas (PROGRESS.md
 * ochiq eslatmasi) — shu sabab department_id bo'yicha frontendda qat'iy
 * filtrlanadi.
 */
export default function CustomersScreen({ departmentId, departmentName, appUserId, onSignOut, onBack }) {
  const [customers, setCustomers] = useState([])
  const [debtMap, setDebtMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [openPaymentFor, setOpenPaymentFor] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const [customersRes, debtRes] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone').eq('is_archived', false).order('full_name'),
      supabase.from('customer_debt_balance').select('customer_id, debt_som').eq('department_id', departmentId),
    ])

    if (customersRes.error || debtRes.error) {
      setErrorMsg((customersRes.error || debtRes.error).message)
      setLoading(false)
      return
    }

    const debts = {}
    for (const row of debtRes.data ?? []) {
      debts[row.customer_id] = Number(row.debt_som || 0)
    }

    setCustomers(customersRes.data ?? [])
    setDebtMap(debts)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers
      .map((c) => ({ ...c, debt: debtMap[c.id] || 0 }))
      .filter((c) => (q ? c.full_name.toLowerCase().includes(q) : true))
      .filter((c) => (filter === 'debtors' ? c.debt > 0 : true))
  }, [customers, debtMap, search, filter])

  function handlePaymentSaved() {
    setOpenPaymentFor(null)
    loadData()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Mijozlar</span>
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
        <div style={styles.controlsPanel}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mijoz nomi bo'yicha qidirish..."
            style={styles.searchInput}
          />
          <div style={styles.tabRow}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...styles.tabBtn, ...(filter === tab.key ? styles.tabBtnActive : {}) }}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && <div style={styles.errorBox}>Ma'lumotni olishda xato: {errorMsg}</div>}
        {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

        {!loading && !errorMsg && rows.length === 0 && (
          <p style={styles.emptyText}>Bu filtrlar bo'yicha mijoz topilmadi.</p>
        )}

        {!loading && (
          <div style={styles.list}>
            {rows.map((c) => (
              <div key={c.id} style={styles.card}>
                <div style={styles.cardRow}>
                  <div>
                    <div style={styles.customerName}>{c.full_name}</div>
                    {c.phone && <div style={styles.customerPhone}>{c.phone}</div>}
                  </div>
                  <div style={styles.cardRight}>
                    <span
                      className="mono-figure"
                      style={{ ...styles.debtValue, ...(c.debt > 0 ? styles.debtValuePositive : {}) }}
                    >
                      {som(c.debt)}
                    </span>
                    <button
                      type="button"
                      style={styles.paymentBtn}
                      onClick={() => setOpenPaymentFor(openPaymentFor === c.id ? null : c.id)}
                    >
                      {openPaymentFor === c.id ? 'Yopish' : "To'lov kiritish"}
                    </button>
                  </div>
                </div>

                {openPaymentFor === c.id && (
                  <PaymentForm
                    customerId={c.id}
                    departmentId={departmentId}
                    appUserId={appUserId}
                    onSaved={handlePaymentSaved}
                    onCancel={() => setOpenPaymentFor(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function PaymentForm({ customerId, departmentId, appUserId, onSaved, onCancel }) {
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [currency, setCurrency] = useState('SOM')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [manualRate, setManualRate] = useState('')
  const [method, setMethod] = useState('naqd')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (currency !== 'USD') return
    let isMounted = true
    setRateLoading(true)
    supabase
      .from('exchange_rates')
      .select('usd_to_som')
      .eq('rate_date', paymentDate)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return
        setRate(data?.usd_to_som ?? null)
        setRateLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [currency, paymentDate])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      setErrorMsg("Summani to'g'ri kiriting.")
      return
    }

    let effectiveRate = rate
    if (currency === 'USD' && !effectiveRate) {
      effectiveRate = Number(manualRate)
      if (!effectiveRate || effectiveRate <= 0) {
        setErrorMsg("Bu kun uchun kurs topilmadi — qo'lda kiriting.")
        return
      }
    }

    const amountSom = currency === 'USD' ? amountNum * effectiveRate : amountNum

    setSubmitting(true)

    const { error } = await supabase.from('sales_payments').insert({
      department_id: departmentId,
      customer_id: customerId,
      sale_id: null,
      payment_date: paymentDate,
      amount: amountNum,
      currency,
      exchange_rate: currency === 'USD' ? effectiveRate : null,
      amount_som: amountSom,
      method,
      payment_method: method,
      created_by: appUserId,
    })

    if (error) {
      setErrorMsg("Saqlashda xatolik: " + error.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} style={pfStyles.form}>
      <div style={pfStyles.row}>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Sana</label>
          <CustomDatePicker value={paymentDate} onChange={setPaymentDate} />
        </div>

        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Valyuta</label>
          <div style={pfStyles.pillRow}>
            {['SOM', 'USD'].map((cur) => (
              <button
                key={cur}
                type="button"
                style={{ ...pfStyles.pillBtn, ...(currency === cur ? pfStyles.pillBtnActive : {}) }}
                onClick={() => setCurrency(cur)}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Summa</label>
          <NumberInput value={amount} onChange={setAmount} placeholder="0" style={pfStyles.input} />
        </div>

        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Usul</label>
          <div style={pfStyles.pillRow}>
            {[
              { key: 'naqd', label: 'Naqd' },
              { key: 'bank', label: 'Bank' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                style={{ ...pfStyles.pillBtn, ...(method === m.key ? pfStyles.pillBtnActive : {}) }}
                onClick={() => setMethod(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {currency === 'USD' && !rateLoading && !rate && (
        <div style={pfStyles.rateRow}>
          <span style={pfStyles.rateHint}>{paymentDate} kuni uchun kurs topilmadi:</span>
          <NumberInput value={manualRate} onChange={setManualRate} placeholder="masalan 12600" style={pfStyles.rateInput} />
        </div>
      )}
      {currency === 'USD' && rate && (
        <div style={pfStyles.rateRow}>
          <span style={pfStyles.rateHint} className="mono-figure">
            Kurs: 1$ = {formatMoney(rate)} so'm
          </span>
        </div>
      )}

      {errorMsg && <div style={pfStyles.errorBox}>{errorMsg}</div>}

      <div style={pfStyles.actions}>
        <button type="submit" disabled={submitting} style={pfStyles.submitBtn}>
          {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        <button type="button" style={pfStyles.cancelBtn} onClick={onCancel}>
          Bekor qilish
        </button>
      </div>
    </form>
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
    maxWidth: 760,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  controlsPanel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 18px',
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    padding: '9px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 14,
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
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '12px 16px',
    borderRadius: 'var(--radius-control)',
  },
  statusText: { color: 'var(--on-navy-muted)' },
  emptyText: { color: 'var(--on-navy-muted)', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '14px 18px',
  },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  customerName: { fontSize: 15, fontWeight: 600, color: 'var(--canvas-text)' },
  customerPhone: { fontSize: 12, color: 'var(--canvas-text-muted)', marginTop: 2 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 14 },
  debtValue: { fontSize: 15, color: 'var(--canvas-text-muted)' },
  debtValuePositive: { color: 'var(--danger)', fontWeight: 600 },
  paymentBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--copper)',
    background: 'transparent',
    color: 'var(--copper)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}

const pfStyles = {
  form: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid #e6dcc7',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 },
  label: { fontSize: 11, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  input: {
    padding: '9px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 13,
  },
  pillRow: { display: 'flex', gap: 4 },
  pillBtn: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    cursor: 'pointer',
    fontSize: 12,
  },
  pillBtnActive: {
    background: 'var(--copper)',
    borderColor: 'var(--copper)',
    color: '#fff',
    fontWeight: 600,
  },
  rateRow: { display: 'flex', alignItems: 'center', gap: 10 },
  rateHint: { fontSize: 12, color: 'var(--canvas-text-muted)' },
  rateInput: {
    width: 120,
    padding: '7px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 13,
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '9px 12px',
    borderRadius: 'var(--radius-control)',
    fontSize: 12,
  },
  actions: { display: 'flex', gap: 8 },
  submitBtn: {
    padding: '9px 18px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '9px 14px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    fontSize: 13,
    cursor: 'pointer',
  },
}
