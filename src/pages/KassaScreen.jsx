import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import CustomDatePicker from '../components/CustomDatePicker'
import MonthPicker from '../components/MonthPicker'
import NumberInput from '../components/NumberInput'
import { formatMoney } from '../lib/formatNumbers'

function som(value) {
  return formatMoney(value) + " so'm"
}
function usd(value) {
  return '$' + formatMoney(value)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return { start: `${monthKey}-01`, end: new Date(year, month, 0).toISOString().slice(0, 10) }
}

const TYPE_TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'kirim', label: 'Kirim' },
  { key: 'chiqim', label: 'Chiqim' },
]
const ACCOUNT_TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'naqd', label: 'Naqd' },
  { key: 'bank', label: 'Bank' },
]

/**
 * Kassa — Naqd/Bank balansi (SOM+USD alohida, jismoniy pul, DECISIONS.md
 * 2026-07-13 eslatmasiga mos: bu yetkazib beruvchi qarzini birlashtirish
 * qaroriga kirmaydi), pul harakati lentasi, "+Xarajat" va "Tuzatish
 * kiritish" (DECISIONS.md 2026-07-12 maketiga mos).
 *
 * DIQQAT: cash_current_balance hali security_invoker=true bilan emas —
 * department_id bo'yicha frontendda qat'iy filtrlanadi. Faqat Bigmanager
 * kirita oladi (2026-07-11 "5-modul moliyaviy huquqlar" qarori).
 */
export default function KassaScreen({ departmentId, departmentName, appUserId, onSignOut, onBack }) {
  const [cashRows, setCashRows] = useState([])
  const [balLoading, setBalLoading] = useState(true)

  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [feedRows, setFeedRows] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const [showExpense, setShowExpense] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)

  const loadBalances = useCallback(async () => {
    setBalLoading(true)
    const { data, error } = await supabase
      .from('cash_current_balance')
      .select('account_type, currency, balance_som')
      .eq('department_id', departmentId)
    if (!error) setCashRows(data ?? [])
    setBalLoading(false)
  }, [departmentId])

  const loadFeed = useCallback(async () => {
    setFeedLoading(true)
    setErrorMsg(null)
    const { start, end } = monthRange(monthKey)

    const [adjRes, payRes, expRes, supRes] = await Promise.all([
      supabase
        .from('cash_account_adjustments')
        .select('id, account_type, currency, amount, adjustment_type, reason, created_at')
        .eq('department_id', departmentId)
        .eq('is_archived', false),
      supabase
        .from('sales_payments')
        .select('id, payment_date, amount, currency, payment_method, customers(full_name)')
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .not('payment_method', 'is', null)
        .gte('payment_date', start)
        .lte('payment_date', end),
      supabase
        .from('expenses')
        .select('id, expense_date, category, description, amount, currency, payment_method')
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .not('payment_method', 'is', null)
        .gte('expense_date', start)
        .lte('expense_date', end),
      supabase
        .from('supplier_transactions')
        .select('id, transaction_date, amount, currency, payment_method, suppliers(name)')
        .eq('department_id', departmentId)
        .eq('is_archived', false)
        .eq('transaction_type', 'tolov')
        .not('payment_method', 'is', null)
        .gte('transaction_date', start)
        .lte('transaction_date', end),
    ])

    const firstError = adjRes.error || payRes.error || expRes.error || supRes.error
    if (firstError) {
      setErrorMsg(firstError.message)
      setFeedLoading(false)
      return
    }

    const rows = []

    ;(adjRes.data ?? []).forEach((a) => {
      const d = a.created_at.slice(0, 10)
      if (d < start || d > end) return
      rows.push({
        date: d,
        label: (a.adjustment_type === 'opening' ? "Boshlang'ich zaxira" : 'Tuzatish') + (a.reason ? ' — ' + a.reason : ''),
        accountType: a.account_type,
        currency: a.currency,
        amount: Number(a.amount),
      })
    })
    ;(payRes.data ?? []).forEach((p) => {
      rows.push({
        date: p.payment_date,
        label: 'Mijoz to‘lovi' + (p.customers?.full_name ? ' — ' + p.customers.full_name : ''),
        accountType: p.payment_method,
        currency: p.currency,
        amount: Number(p.amount),
      })
    })
    ;(expRes.data ?? []).forEach((e) => {
      rows.push({
        date: e.expense_date,
        label: 'Xarajat: ' + e.category + (e.description ? ' — ' + e.description : ''),
        accountType: e.payment_method,
        currency: e.currency,
        amount: -Number(e.amount),
      })
    })
    ;(supRes.data ?? []).forEach((s) => {
      rows.push({
        date: s.transaction_date,
        label: 'Yetkazib beruvchiga to‘lov' + (s.suppliers?.name ? ' — ' + s.suppliers.name : ''),
        accountType: s.payment_method,
        currency: s.currency,
        amount: -Number(s.amount),
      })
    })

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    setFeedRows(rows)
    setFeedLoading(false)
  }, [departmentId, monthKey])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const visibleFeed = useMemo(() => {
    return feedRows
      .filter((r) => (accountFilter === 'all' ? true : r.accountType === accountFilter))
      .filter((r) => {
        if (typeFilter === 'kirim') return r.amount > 0
        if (typeFilter === 'chiqim') return r.amount < 0
        return true
      })
  }, [feedRows, accountFilter, typeFilter])

  function balanceFor(accountType, currency) {
    return Number(cashRows.find((r) => r.account_type === accountType && r.currency === currency)?.balance_som || 0)
  }

  function handleSaved() {
    setShowExpense(false)
    setShowAdjustment(false)
    loadBalances()
    loadFeed()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Kassa</span>
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
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Naqd</span>
            <span className="mono-figure" style={styles.kpiValue}>
              {balLoading ? '—' : som(balanceFor('naqd', 'SOM'))}
            </span>
            {!balLoading && balanceFor('naqd', 'USD') !== 0 && (
              <span className="mono-figure" style={styles.kpiSecondary}>
                {usd(balanceFor('naqd', 'USD'))}
              </span>
            )}
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Bank</span>
            <span className="mono-figure" style={styles.kpiValue}>
              {balLoading ? '—' : som(balanceFor('bank', 'SOM'))}
            </span>
            {!balLoading && balanceFor('bank', 'USD') !== 0 && (
              <span className="mono-figure" style={styles.kpiSecondary}>
                {usd(balanceFor('bank', 'USD'))}
              </span>
            )}
          </div>
        </div>

        <div style={styles.actionsRow}>
          <button type="button" style={styles.actionBtn} onClick={() => { setShowExpense((v) => !v); setShowAdjustment(false) }}>
            {showExpense ? 'Yopish' : '+ Xarajat'}
          </button>
          <button type="button" style={styles.actionBtnSecondary} onClick={() => { setShowAdjustment((v) => !v); setShowExpense(false) }}>
            {showAdjustment ? 'Yopish' : 'Tuzatish kiritish'}
          </button>
        </div>

        {showExpense && (
          <div style={styles.formPanel}>
            <ExpenseForm departmentId={departmentId} appUserId={appUserId} onSaved={handleSaved} onCancel={() => setShowExpense(false)} />
          </div>
        )}
        {showAdjustment && (
          <div style={styles.formPanel}>
            <AdjustmentForm departmentId={departmentId} appUserId={appUserId} onSaved={handleSaved} onCancel={() => setShowAdjustment(false)} />
          </div>
        )}

        <div style={styles.filtersPanel}>
          <div style={styles.tabRow}>
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...styles.tabBtn, ...(typeFilter === tab.key ? styles.tabBtnActive : {}) }}
                onClick={() => setTypeFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={styles.tabRow}>
            {ACCOUNT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...styles.tabBtn, ...(accountFilter === tab.key ? styles.tabBtnActive : {}) }}
                onClick={() => setAccountFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Oy</label>
            <MonthPicker value={monthKey} onChange={setMonthKey} />
          </div>
        </div>

        {errorMsg && <div style={styles.errorBox}>Ma'lumotni olishda xato: {errorMsg}</div>}
        {feedLoading && <p style={styles.statusText}>Yuklanmoqda...</p>}
        {!feedLoading && !errorMsg && visibleFeed.length === 0 && (
          <p style={styles.emptyText}>Bu filtrlar bo'yicha harakat topilmadi.</p>
        )}

        {!feedLoading && visibleFeed.length > 0 && (
          <div style={styles.feedList}>
            {visibleFeed.map((r, idx) => (
              <div key={idx} style={styles.feedRow}>
                <div style={styles.feedLeft}>
                  <span style={styles.feedDate}>{r.date}</span>
                  <span style={styles.feedLabel}>{r.label}</span>
                  <span style={styles.feedTag}>{r.accountType === 'naqd' ? 'Naqd' : 'Bank'}</span>
                </div>
                <span
                  className="mono-figure"
                  style={{ ...styles.feedAmount, ...(r.amount >= 0 ? styles.feedAmountPositive : styles.feedAmountNegative) }}
                >
                  {r.amount >= 0 ? '+' : '−'}
                  {r.currency === 'USD' ? usd(Math.abs(r.amount)) : som(Math.abs(r.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ExpenseForm({ departmentId, appUserId, onSaved, onCancel }) {
  const [expenseDate, setExpenseDate] = useState(todayIso())
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('SOM')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('naqd')
  const [rate, setRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [manualRate, setManualRate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (currency !== 'USD') return
    let isMounted = true
    setRateLoading(true)
    supabase
      .from('exchange_rates')
      .select('usd_to_som')
      .eq('rate_date', expenseDate)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return
        setRate(data?.usd_to_som ?? null)
        setRateLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [currency, expenseDate])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    if (!category.trim()) {
      setErrorMsg('Kategoriyani kiriting.')
      return
    }
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
    const { error } = await supabase.from('expenses').insert({
      department_id: departmentId,
      category: category.trim(),
      description: description.trim() || null,
      amount: amountNum,
      currency,
      exchange_rate: currency === 'USD' ? effectiveRate : null,
      amount_som: amountSom,
      expense_date: expenseDate,
      created_by: appUserId,
      payment_method: method,
    })

    if (error) {
      setErrorMsg('Saqlashda xatolik: ' + error.message)
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
          <CustomDatePicker value={expenseDate} onChange={setExpenseDate} />
        </div>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Kategoriya</label>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} style={pfStyles.input} placeholder="Masalan: Ijara, Transport" />
        </div>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Valyuta</label>
          <div style={pfStyles.pillRow}>
            {['SOM', 'USD'].map((cur) => (
              <button key={cur} type="button" style={{ ...pfStyles.pillBtn, ...(currency === cur ? pfStyles.pillBtnActive : {}) }} onClick={() => setCurrency(cur)}>
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
            {[{ key: 'naqd', label: 'Naqd' }, { key: 'bank', label: 'Bank' }].map((m) => (
              <button key={m.key} type="button" style={{ ...pfStyles.pillBtn, ...(method === m.key ? pfStyles.pillBtnActive : {}) }} onClick={() => setMethod(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={pfStyles.field}>
        <label style={pfStyles.label}>Izoh (ixtiyoriy)</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={pfStyles.input} placeholder="Qo'shimcha izoh..." />
      </div>

      {currency === 'USD' && !rateLoading && !rate && (
        <div style={pfStyles.rateRow}>
          <span style={pfStyles.rateHint}>{expenseDate} kuni uchun kurs topilmadi:</span>
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

function AdjustmentForm({ departmentId, appUserId, onSaved, onCancel }) {
  const [adjType, setAdjType] = useState('opening')
  const [accountType, setAccountType] = useState('naqd')
  const [currency, setCurrency] = useState('SOM')
  const [direction, setDirection] = useState('increase')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      setErrorMsg("Summani to'g'ri kiriting.")
      return
    }
    if (adjType === 'correction' && !reason.trim()) {
      setErrorMsg('Tuzatish uchun sabab kiritish majburiy.')
      return
    }

    const signedAmount = adjType === 'correction' && direction === 'decrease' ? -amountNum : amountNum

    setSubmitting(true)
    const { error } = await supabase.from('cash_account_adjustments').insert({
      department_id: departmentId,
      account_type: accountType,
      currency,
      adjustment_type: adjType,
      amount: signedAmount,
      reason: adjType === 'correction' ? reason.trim() : null,
      created_by: appUserId,
    })

    if (error) {
      setErrorMsg('Saqlashda xatolik: ' + error.message)
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
          <label style={pfStyles.label}>Turi</label>
          <div style={pfStyles.pillRow}>
            {[{ key: 'opening', label: "Boshlang'ich" }, { key: 'correction', label: 'Tuzatish' }].map((t) => (
              <button key={t.key} type="button" style={{ ...pfStyles.pillBtn, ...(adjType === t.key ? pfStyles.pillBtnActive : {}) }} onClick={() => setAdjType(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Hisob</label>
          <div style={pfStyles.pillRow}>
            {[{ key: 'naqd', label: 'Naqd' }, { key: 'bank', label: 'Bank' }].map((a) => (
              <button key={a.key} type="button" style={{ ...pfStyles.pillBtn, ...(accountType === a.key ? pfStyles.pillBtnActive : {}) }} onClick={() => setAccountType(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Valyuta</label>
          <div style={pfStyles.pillRow}>
            {['SOM', 'USD'].map((cur) => (
              <button key={cur} type="button" style={{ ...pfStyles.pillBtn, ...(currency === cur ? pfStyles.pillBtnActive : {}) }} onClick={() => setCurrency(cur)}>
                {cur}
              </button>
            ))}
          </div>
        </div>
        {adjType === 'correction' && (
          <div style={pfStyles.field}>
            <label style={pfStyles.label}>Yo'nalish</label>
            <div style={pfStyles.pillRow}>
              {[{ key: 'increase', label: 'Ortirish' }, { key: 'decrease', label: 'Kamaytirish' }].map((d) => (
                <button key={d.key} type="button" style={{ ...pfStyles.pillBtn, ...(direction === d.key ? pfStyles.pillBtnActive : {}) }} onClick={() => setDirection(d.key)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Summa</label>
          <NumberInput value={amount} onChange={setAmount} placeholder="0" style={pfStyles.input} />
        </div>
      </div>

      {adjType === 'correction' && (
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Sabab (majburiy)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={pfStyles.input} placeholder="Masalan: kassa hisobida farq aniqlandi" />
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
    maxWidth: 860,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
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
  actionsRow: { display: 'flex', gap: 10 },
  actionBtn: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnSecondary: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--on-navy)',
    fontSize: 13,
    cursor: 'pointer',
  },
  formPanel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 18px',
  },
  filtersPanel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 18px',
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
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
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '12px 16px',
    borderRadius: 'var(--radius-control)',
  },
  statusText: { color: 'var(--on-navy-muted)' },
  emptyText: { color: 'var(--on-navy-muted)', fontSize: 14 },
  feedList: { display: 'flex', flexDirection: 'column', gap: 8 },
  feedRow: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  feedLeft: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  feedDate: { fontSize: 12, color: 'var(--canvas-text-muted)' },
  feedLabel: { fontSize: 13, color: 'var(--canvas-text)' },
  feedTag: {
    fontSize: 11,
    color: 'var(--canvas-text-muted)',
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
    padding: '2px 8px',
    borderRadius: 999,
  },
  feedAmount: { fontSize: 14, fontWeight: 600 },
  feedAmountPositive: { color: 'var(--teal)' },
  feedAmountNegative: { color: 'var(--danger)' },
}

const pfStyles = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130, flex: 1 },
  label: { fontSize: 11, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  input: {
    padding: '9px 10px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 13,
  },
  pillRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
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
