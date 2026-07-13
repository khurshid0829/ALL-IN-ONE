import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import CustomDatePicker from '../components/CustomDatePicker'
import NumberInput from '../components/NumberInput'
import { formatMoney } from '../lib/formatNumbers'
import AktSverkaPanel from '../components/AktSverkaPanel'

function som(value) {
  return formatMoney(value) + ' so‘m'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Yetkazib beruvchilar — bizning qarzimiz (yagona SOM qiymatida,
 * DECISIONS.md 2026-07-13 qaroriga mos: USD tranzaksiyalar shu kungi
 * kursda SOM'ga aylantirilib qo'shiladi, mijoz qarzi bilan bir xil
 * mantiq) + "Amaliyot" (xarid/to'lov) tezkor kiritish (DECISIONS.md
 * 2026-07-12 maketiga mos).
 *
 * DIQQAT: suppliers/supplier_transactions faqat Bigmanager'ga ochiq
 * (2026-07-11 "5-modul moliyaviy huquqlar" qarori). supplier_debt_balance
 * hali security_invoker=true bilan emas — department_id bo'yicha
 * frontendda qat'iy filtrlanadi.
 */
export default function SuppliersScreen({ departmentId, departmentName, appUserId, onSignOut, onBack }) {
  const [suppliers, setSuppliers] = useState([])
  const [debtRows, setDebtRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const [search, setSearch] = useState('')
  const [openTxFor, setOpenTxFor] = useState(null)
  const [openAktFor, setOpenAktFor] = useState(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const [suppliersRes, debtRes] = await Promise.all([
      supabase.from('suppliers').select('id, name, phone, note').eq('department_id', departmentId).eq('is_archived', false).order('name'),
      supabase.from('supplier_debt_balance').select('supplier_id, debt_som').eq('department_id', departmentId),
    ])

    if (suppliersRes.error || debtRes.error) {
      setErrorMsg((suppliersRes.error || debtRes.error).message)
      setLoading(false)
      return
    }

    setSuppliers(suppliersRes.data ?? [])
    setDebtRows(debtRes.data ?? [])
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return suppliers
      .map((s) => {
        const debtRow = debtRows.find((d) => d.supplier_id === s.id)
        return { ...s, debt: Number(debtRow?.debt_som || 0) }
      })
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
  }, [suppliers, debtRows, search])

  function handleSaved() {
    setOpenTxFor(null)
    loadData()
  }

  function handleSupplierAdded() {
    setShowAddSupplier(false)
    loadData()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Yetkazib beruvchilar</span>
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
            placeholder="Yetkazib beruvchi nomi bo'yicha qidirish..."
            style={styles.searchInput}
          />
          <button type="button" style={styles.addToggleBtn} onClick={() => setShowAddSupplier((v) => !v)}>
            {showAddSupplier ? 'Yopish' : "+ Yangi yetkazib beruvchi"}
          </button>
        </div>

        {showAddSupplier && (
          <div style={styles.addPanel}>
            <AddSupplierForm departmentId={departmentId} onSaved={handleSupplierAdded} onCancel={() => setShowAddSupplier(false)} />
          </div>
        )}

        {errorMsg && <div style={styles.errorBox}>Ma'lumotni olishda xato: {errorMsg}</div>}
        {loading && <p style={styles.statusText}>Yuklanmoqda...</p>}

        {!loading && !errorMsg && rows.length === 0 && (
          <p style={styles.emptyText}>Hozircha yetkazib beruvchi yo'q.</p>
        )}

        {!loading && (
          <div style={styles.list}>
            {rows.map((s) => (
              <div key={s.id} style={styles.card}>
                <div style={styles.cardRow}>
                  <div>
                    <div style={styles.supplierName}>{s.name}</div>
                    {s.phone && <div style={styles.supplierMeta}>{s.phone}</div>}
                  </div>
                  <div style={styles.cardRight}>
                    <span
                      className="mono-figure"
                      style={{ ...styles.debtValue, ...(s.debt > 0 ? styles.debtValuePositive : {}) }}
                    >
                      {som(s.debt)}
                    </span>
                    <button
                      type="button"
                      style={styles.secondaryActionBtn}
                      onClick={() => setOpenAktFor(openAktFor === s.id ? null : s.id)}
                    >
                      {openAktFor === s.id ? 'Yopish' : 'Akt sverka'}
                    </button>
                    <button
                      type="button"
                      style={styles.txBtn}
                      onClick={() => setOpenTxFor(openTxFor === s.id ? null : s.id)}
                    >
                      {openTxFor === s.id ? 'Yopish' : 'Amaliyot'}
                    </button>
                  </div>
                </div>

                {openTxFor === s.id && (
                  <TransactionForm
                    supplierId={s.id}
                    departmentId={departmentId}
                    appUserId={appUserId}
                    onSaved={handleSaved}
                    onCancel={() => setOpenTxFor(null)}
                  />
                )}

                {openAktFor === s.id && (
                  <AktSverkaPanel
                    entityType="supplier"
                    entityId={s.id}
                    entityName={s.name}
                    departmentId={departmentId}
                    departmentName={departmentName}
                    onClose={() => setOpenAktFor(null)}
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

function AddSupplierForm({ departmentId, onSaved, onCancel }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Nomini kiriting.')
      return
    }
    setSubmitting(true)
    setErrorMsg(null)

    const { error } = await supabase.from('suppliers').insert({
      department_id: departmentId,
      name: name.trim(),
      phone: phone.trim() || null,
    })

    if (error) {
      setErrorMsg('Saqlashda xatolik: ' + error.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setName('')
    setPhone('')
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} style={pfStyles.form}>
      <div style={pfStyles.row}>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Nomi</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={pfStyles.input} placeholder="Yetkazib beruvchi nomi" />
        </div>
        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Telefon (ixtiyoriy)</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={pfStyles.input} placeholder="+998..." />
        </div>
      </div>
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

function TransactionForm({ supplierId, departmentId, appUserId, onSaved, onCancel }) {
  const [txType, setTxType] = useState('xarid')
  const [txDate, setTxDate] = useState(todayIso())
  const [currency, setCurrency] = useState('SOM')
  const [amount, setAmount] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [rate, setRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [manualRate, setManualRate] = useState('')
  const [method, setMethod] = useState('naqd')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (currency !== 'USD') return
    let isMounted = true
    setRateLoading(true)
    supabase
      .from('exchange_rates')
      .select('usd_to_som')
      .eq('rate_date', txDate)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return
        setRate(data?.usd_to_som ?? null)
        setRateLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [currency, txDate])

  const computedAmount = Number(qty || 0) * Number(unitPrice || 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    const amountNum = txType === 'xarid' ? computedAmount : Number(amount)
    if (!amountNum || amountNum <= 0) {
      setErrorMsg(
        txType === 'xarid' ? "Miqdor va narxni to'g'ri kiriting." : "Summani to'g'ri kiriting."
      )
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

    const { error } = await supabase.from('supplier_transactions').insert({
      department_id: departmentId,
      supplier_id: supplierId,
      transaction_type: txType,
      description: description.trim() || null,
      amount: amountNum,
      currency,
      exchange_rate: currency === 'USD' ? effectiveRate : null,
      amount_som: amountSom,
      transaction_date: txDate,
      created_by: appUserId,
      payment_method: txType === 'tolov' ? method : null,
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
            {[
              { key: 'xarid', label: 'Xarid' },
              { key: 'tolov', label: "To'lov" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                style={{ ...pfStyles.pillBtn, ...(txType === t.key ? pfStyles.pillBtnActive : {}) }}
                onClick={() => setTxType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={pfStyles.field}>
          <label style={pfStyles.label}>Sana</label>
          <CustomDatePicker value={txDate} onChange={setTxDate} />
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

        {txType === 'xarid' ? (
          <>
            <div style={pfStyles.field}>
              <label style={pfStyles.label}>Miqdor</label>
              <NumberInput value={qty} onChange={setQty} placeholder="masalan 50" style={pfStyles.input} />
            </div>
            <div style={pfStyles.field}>
              <label style={pfStyles.label}>Narx (birlik uchun)</label>
              <NumberInput value={unitPrice} onChange={setUnitPrice} placeholder="masalan 12000" style={pfStyles.input} />
            </div>
          </>
        ) : (
          <div style={pfStyles.field}>
            <label style={pfStyles.label}>Summa</label>
            <NumberInput value={amount} onChange={setAmount} placeholder="0" style={pfStyles.input} />
          </div>
        )}

        {txType === 'tolov' && (
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
        )}
      </div>

      {txType === 'xarid' && computedAmount > 0 && (
        <div style={pfStyles.rateRow}>
          <span style={pfStyles.rateHint} className="mono-figure">
            Jami: {currency === 'USD' ? '$' + formatMoney(computedAmount) : som(computedAmount)}
          </span>
        </div>
      )}

      <div style={pfStyles.field}>
        <label style={pfStyles.label}>Izoh (ixtiyoriy)</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={pfStyles.input} placeholder="Masalan: 50kg shakar" />
      </div>

      {currency === 'USD' && !rateLoading && !rate && (
        <div style={pfStyles.rateRow}>
          <span style={pfStyles.rateHint}>{txDate} kuni uchun kurs topilmadi:</span>
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
    maxWidth: 780,
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
  addToggleBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-control)',
    border: '1px dashed var(--copper)',
    background: 'transparent',
    color: 'var(--copper)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  addPanel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '16px 18px',
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
  supplierName: { fontSize: 15, fontWeight: 600, color: 'var(--canvas-text)' },
  supplierMeta: { fontSize: 12, color: 'var(--canvas-text-muted)', marginTop: 2 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 14 },
  debtValue: { fontSize: 14, color: 'var(--canvas-text-muted)' },
  debtValuePositive: { color: 'var(--danger)', fontWeight: 600 },
  txBtn: {
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
  secondaryActionBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: 'transparent',
    color: 'var(--canvas-text-muted)',
    cursor: 'pointer',
    fontSize: 13,
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
