import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import SearchSelect from '../components/SearchSelect'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Omborchi ekrani — kunlik xomashyo/mahsulot kirim va chiqimini
 * warehouse_entries jadvaliga qo'lda kiritish uchun.
 *
 * MUHIM: qty_out (chiqim) hech qachon avtomatik hisoblanmaydi —
 * bu ARCHITECTURE.md/DECISIONS.md'dagi qattiq qarorga mos
 * (elektr/uskuna uzilishlari sababli avtomatik ayirish rad etilgan).
 * expected_qty_out — ixtiyoriy, faqat taqqoslash uchun, majburiy emas.
 */
export default function WarehouseEntryScreen({
  departmentId,
  departmentName,
  userId,
  onSignOut,
}) {
  const [selectedSku, setSelectedSku] = useState(null)
  const [entryDate, setEntryDate] = useState(todayIso())
  const [qtyIn, setQtyIn] = useState('')
  const [qtyOut, setQtyOut] = useState('')
  const [expectedQtyOut, setExpectedQtyOut] = useState('')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [recentEntries, setRecentEntries] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    const { data, error } = await supabase
      .from('warehouse_entries')
      .select(
        'id, entry_date, qty_in, qty_out, expected_qty_out, note, created_at, sku_master(sku_code, display_name, unit)'
      )
      .eq('department_id', departmentId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(15)

    if (!error) {
      setRecentEntries(data ?? [])
    }
    setLoadingRecent(false)
  }, [departmentId])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  function resetFormAfterSubmit() {
    setSelectedSku(null)
    setQtyIn('')
    setQtyOut('')
    setExpectedQtyOut('')
    setNote('')
    // entryDate ataylab tozalanmaydi — bir kunda ketma-ket bir necha
    // yozuv kiritish odatiy holat, sana o'zgarmasdan qolgani qulay.
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!selectedSku) {
      setErrorMsg("Iltimos, mahsulot yoki xomashyoni tanlang.")
      return
    }

    const qtyInNum = qtyIn.trim() === '' ? 0 : Number(qtyIn)
    const qtyOutNum = qtyOut.trim() === '' ? 0 : Number(qtyOut)

    if (Number.isNaN(qtyInNum) || Number.isNaN(qtyOutNum)) {
      setErrorMsg("Miqdor faqat son bo'lishi kerak.")
      return
    }

    if (qtyInNum === 0 && qtyOutNum === 0) {
      setErrorMsg("Kirim yoki chiqimdan kamida bittasini kiriting.")
      return
    }

    if (qtyInNum < 0 || qtyOutNum < 0) {
      setErrorMsg("Miqdor manfiy bo'lishi mumkin emas.")
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('warehouse_entries').insert({
      department_id: departmentId,
      sku_id: selectedSku.id,
      entry_date: entryDate,
      qty_in: qtyInNum,
      qty_out: qtyOutNum,
      expected_qty_out:
        expectedQtyOut.trim() === '' ? null : Number(expectedQtyOut),
      note: note.trim() === '' ? null : note.trim(),
      created_by: userId,
    })

    if (error) {
      setErrorMsg('Saqlashda xatolik: ' + error.message)
      setSubmitting(false)
      return
    }

    setSuccessMsg(
      `Saqlandi: ${selectedSku.sku_code} — ${selectedSku.display_name}`
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
              <label style={styles.label}>Mahsulot / Xomashyo</label>
              <SearchSelect
                entityType="sku_master"
                departmentId={departmentId}
                placeholder="Kamida 3 harf yozing..."
                initialLabel={
                  selectedSku
                    ? `${selectedSku.sku_code} — ${selectedSku.display_name}`
                    : ''
                }
                onSelect={setSelectedSku}
              />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Sana</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Kirim (qty_in)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={qtyIn}
                  onChange={(e) => setQtyIn(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Chiqim (qty_out)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={qtyOut}
                  onChange={(e) => setQtyOut(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Me'yor bo'yicha kutilgan sarf (ixtiyoriy)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={expectedQtyOut}
                onChange={(e) => setExpectedQtyOut(e.target.value)}
                style={styles.input}
                placeholder="Retsept asosida taqqoslash uchun, majburiy emas"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Izoh</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={styles.input}
                placeholder="Ixtiyoriy izoh..."
              />
            </div>

            {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            {successMsg && <div style={styles.successBox}>{successMsg}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </form>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>So'nggi yozuvlar</h2>

          {loadingRecent && <p style={styles.statusText}>Yuklanmoqda...</p>}

          {!loadingRecent && recentEntries.length === 0 && (
            <p style={styles.emptyText}>Hozircha yozuv yo'q.</p>
          )}

          {!loadingRecent && recentEntries.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Sana</th>
                    <th style={styles.th}>SKU</th>
                    <th style={styles.thRight}>Kirim</th>
                    <th style={styles.thRight}>Chiqim</th>
                    <th style={styles.th}>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((row) => (
                    <tr key={row.id}>
                      <td style={styles.td}>{row.entry_date}</td>
                      <td style={styles.td}>
                        {row.sku_master
                          ? `${row.sku_master.sku_code} \u2014 ${row.sku_master.display_name}`
                          : '\u2014'}
                      </td>
                      <td style={styles.tdRight} className="mono-figure">
                        {row.qty_in ?? 0}
                      </td>
                      <td style={styles.tdRight} className="mono-figure">
                        {row.qty_out ?? 0}
                      </td>
                      <td style={styles.td}>{row.note ?? '\u2014'}</td>
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
    maxWidth: 760,
    margin: '32px auto',
    padding: '0 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
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
  },
  tdRight: {
    padding: '10px',
    color: 'var(--canvas-text)',
    borderBottom: '1px solid #efe7d6',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
}
