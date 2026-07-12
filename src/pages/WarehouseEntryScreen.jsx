import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import SearchSelect from '../components/SearchSelect'
import StockBalancePanel from '../components/StockBalancePanel'
import NumberInput from '../components/NumberInput'
import CustomDatePicker from '../components/CustomDatePicker'
import { formatQty } from '../lib/formatNumbers'
import '../styles/dataTable.css'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function makeEmptyLine() {
  return {
    key: Math.random().toString(36).slice(2) + Date.now().toString(36),
    selectedSku: null,
    qtyIn: '',
    qtyOut: '',
    expectedQtyOut: '',
    note: '',
  }
}

/**
 * Omborchi ekrani — kunlik xomashyo kirim va chiqimini warehouse_entries
 * jadvaliga qo'lda kiritish uchun.
 *
 * MUHIM: bir "operatsiya"da bir nechta xomashyo qatorini birga kiritish
 * mumkin (Sale manager'ning "bir chek — ko'p mahsulot" mantig'iga o'xshab).
 * Farqi: bu yerda umumiy "chek" jadvali (header) kerak emas — har bir
 * qator warehouse_entries'ga alohida, lekin bir xil sana bilan, bitta
 * "Saqlash" bosilganda birga yoziladi. Baza sxemasi o'zgarmadi.
 *
 * qty_out (chiqim) hech qachon avtomatik hisoblanmaydi — bu
 * ARCHITECTURE.md/DECISIONS.md'dagi qattiq qarorga mos (elektr/uskuna
 * uzilishlari sababli avtomatik ayirish rad etilgan). expected_qty_out —
 * ixtiyoriy, faqat taqqoslash uchun, majburiy emas.
 */
export default function WarehouseEntryScreen({
  departmentId,
  departmentName,
  userId,
  onSignOut,
}) {
  const [entryDate, setEntryDate] = useState(todayIso())
  const [lines, setLines] = useState(() => [makeEmptyLine()])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [recentEntries, setRecentEntries] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [dateFilter, setDateFilter] = useState('') // bo'sh = filtrsiz, oxirgi 15 ta

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    let query = supabase
      .from('warehouse_entries')
      .select(
        'id, entry_date, qty_in, qty_out, expected_qty_out, note, created_at, sku_master(sku_code, display_name, unit)'
      )
      .eq('department_id', departmentId)
      .eq('is_archived', false)

    if (dateFilter) {
      query = query.eq('entry_date', dateFilter).order('created_at', { ascending: false }).limit(200)
    } else {
      query = query.order('created_at', { ascending: false }).limit(15)
    }

    const { data, error } = await query

    if (!error) {
      setRecentEntries(data ?? [])
    }
    setLoadingRecent(false)
  }, [departmentId, dateFilter])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, makeEmptyLine()])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  function resetFormAfterSubmit() {
    setLines([makeEmptyLine()])
    // entryDate ataylab tozalanmaydi — bir kunda ketma-ket bir necha
    // operatsiya kiritish odatiy holat, sana o'zgarmasdan qolgani qulay.
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    // Har bir qatorni tekshirish
    const rowsToInsert = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNo = i + 1

      if (!line.selectedSku) {
        setErrorMsg(`${lineNo}-qatorda mahsulot tanlanmagan.`)
        return
      }

      const qtyInNum = line.qtyIn.trim() === '' ? 0 : Number(line.qtyIn)
      const qtyOutNum = line.qtyOut.trim() === '' ? 0 : Number(line.qtyOut)

      if (Number.isNaN(qtyInNum) || Number.isNaN(qtyOutNum)) {
        setErrorMsg(`${lineNo}-qatorda miqdor faqat son bo'lishi kerak.`)
        return
      }
      if (qtyInNum === 0 && qtyOutNum === 0) {
        setErrorMsg(`${lineNo}-qatorda kirim yoki chiqimdan kamida bittasini kiriting.`)
        return
      }
      if (qtyInNum < 0 || qtyOutNum < 0) {
        setErrorMsg(`${lineNo}-qatorda miqdor manfiy bo'lishi mumkin emas.`)
        return
      }

      rowsToInsert.push({
        department_id: departmentId,
        sku_id: line.selectedSku.id,
        entry_date: entryDate,
        qty_in: qtyInNum,
        qty_out: qtyOutNum,
        expected_qty_out:
          line.expectedQtyOut.trim() === '' ? null : Number(line.expectedQtyOut),
        note: line.note.trim() === '' ? null : line.note.trim(),
        created_by: userId,
      })
    }

    // Bir xil mahsulot bir necha marta qo'shilib qolmaganini tekshirish
    const skuIds = rowsToInsert.map((r) => r.sku_id)
    const hasDuplicate = new Set(skuIds).size !== skuIds.length
    if (hasDuplicate) {
      setErrorMsg("Bir xil mahsulot ro'yxatda bir necha marta takrorlangan — har bir qatorda boshqa mahsulot tanlang.")
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('warehouse_entries').insert(rowsToInsert)

    if (error) {
      setErrorMsg('Saqlashda xatolik: ' + error.message)
      setSubmitting(false)
      return
    }

    setSuccessMsg(
      rowsToInsert.length === 1
        ? 'Saqlandi: 1 ta mahsulot.'
        : `Saqlandi: ${rowsToInsert.length} ta mahsulot.`
    )
    setSubmitting(false)
    resetFormAfterSubmit()
    loadRecent()
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Yagona Boshqaruv Tizimi &middot; Ombor</span>
        <div style={styles.headerRight}>
          <span style={styles.roleTag}>
            Omborchi &middot; {departmentName ?? '\u2014'}
          </span>
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Chiqish
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Yangi kirim / chiqim</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Sana (barcha qatorlar uchun umumiy)</label>
              <CustomDatePicker value={entryDate} onChange={setEntryDate} />
            </div>

            {lines.map((line, idx) => (
              <div key={line.key} style={styles.lineCard}>
                <div style={styles.lineHeader}>
                  <span style={styles.lineNumber}>{idx + 1}-mahsulot</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      style={styles.removeLineBtn}
                      onClick={() => removeLine(line.key)}
                    >
                      Olib tashlash
                    </button>
                  )}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Xomashyo</label>
                  <SearchSelect
                    entityType="sku_master"
                    departmentId={departmentId}
                    skuType="XOM"
                    placeholder="Kamida 3 harf yozing..."
                    initialLabel={
                      line.selectedSku
                        ? `${line.selectedSku.sku_code} — ${line.selectedSku.display_name}`
                        : ''
                    }
                    onSelect={(sku) => updateLine(line.key, { selectedSku: sku })}
                  />
                </div>

                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Kirim (qty_in)</label>
                    <NumberInput
                      value={line.qtyIn}
                      onChange={(v) => updateLine(line.key, { qtyIn: v })}
                      style={styles.input}
                      placeholder="0"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Chiqim (qty_out)</label>
                    <NumberInput
                      value={line.qtyOut}
                      onChange={(v) => updateLine(line.key, { qtyOut: v })}
                      style={styles.input}
                      placeholder="0"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Kutilgan sarf (ixtiyoriy)</label>
                    <NumberInput
                      value={line.expectedQtyOut}
                      onChange={(v) => updateLine(line.key, { expectedQtyOut: v })}
                      style={styles.input}
                      placeholder={'\u2014'}
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Izoh</label>
                  <input
                    type="text"
                    value={line.note}
                    onChange={(e) => updateLine(line.key, { note: e.target.value })}
                    style={styles.input}
                    placeholder="Ixtiyoriy izoh..."
                  />
                </div>
              </div>
            ))}

            <button type="button" style={styles.addLineBtn} onClick={addLine}>
              + Yana mahsulot qo'shish
            </button>

            {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            {successMsg && <div style={styles.successBox}>{successMsg}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting
                ? 'Saqlanmoqda...'
                : lines.length > 1
                ? `Barchasini saqlash (${lines.length} ta)`
                : 'Saqlash'}
            </button>
          </form>
        </div>

        <StockBalancePanel departmentId={departmentId} />

        <div style={styles.panel}>
          <div style={styles.headerRow}>
            <h2 style={{ ...styles.panelTitle, margin: 0 }}>So'nggi yozuvlar</h2>
            <div style={styles.dateFilterRow}>
              <CustomDatePicker
                value={dateFilter}
                onChange={setDateFilter}
                placeholder="Barcha sanalar"
                allowClear
              />
            </div>
          </div>

          {loadingRecent && <p style={styles.statusText}>Yuklanmoqda...</p>}

          {!loadingRecent && recentEntries.length === 0 && (
            <p style={styles.emptyText}>Hozircha yozuv yo'q.</p>
          )}

          {!loadingRecent && recentEntries.length > 0 && (
            <div className="dtable-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Sana</th>
                    <th>SKU</th>
                    <th className="dtable-right dtable-group-divider">Kirim</th>
                    <th className="dtable-right">Chiqim</th>
                    <th className="dtable-group-divider">Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.entry_date}</td>
                      <td>
                        {row.sku_master
                          ? `${row.sku_master.sku_code} \u2014 ${row.sku_master.display_name}`
                          : '\u2014'}
                      </td>
                      <td className="dtable-right dtable-group-divider mono-figure">
                        {formatQty(row.qty_in ?? 0)}
                      </td>
                      <td className="dtable-right mono-figure">
                        {formatQty(row.qty_out ?? 0)}
                      </td>
                      <td className="dtable-group-divider">{row.note ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
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
    gap: 24,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  dateFilterRow: { display: 'flex', gap: 8, alignItems: 'center' },
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '24px 24px 28px',
  },
  panelTitle: {
    margin: '0 0 16px',
    color: 'var(--canvas-text)',
    fontSize: 17,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  lineCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
    borderRadius: 10,
    padding: '14px 16px',
  },
  lineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineNumber: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--copper)',
    letterSpacing: '0.02em',
  },
  removeLineBtn: {
    background: 'transparent',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
  },
  addLineBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px dashed var(--copper)',
    color: 'var(--copper)',
    padding: '9px 16px',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  label: { fontSize: 12, color: 'var(--canvas-text-muted)', letterSpacing: '0.02em' },
  input: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--shell-line)',
    background: '#fff',
    color: 'var(--canvas-text)',
    fontSize: 14,
  },
  submitBtn: {
    marginTop: 4,
    padding: '11px 20px',
    borderRadius: 'var(--radius-control)',
    border: 'none',
    background: 'var(--copper)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  errorBox: {
    background: '#2a1a16',
    border: '1px solid var(--danger)',
    color: '#f0c9bd',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
  },
  successBox: {
    background: '#12261f',
    border: '1px solid var(--teal)',
    color: 'var(--teal-soft)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-control)',
    fontSize: 13,
  },
  statusText: { color: 'var(--canvas-text-muted)' },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 14 },
}
