import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import SearchSelect from './SearchSelect'
import NumberInput from './NumberInput'
import CustomDatePicker from './CustomDatePicker'
import { formatQty } from '../lib/formatNumbers'
import '../styles/dataTable.css'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function makeEmptyLine() {
  return {
    key: Math.random().toString(36).slice(2) + Date.now().toString(36),
    selectedSku: null,
    qty: '',
  }
}

/**
 * NakladnoySection — Meneger uchun nakladnoy (savdo cheki) yozish.
 *
 * MUHIM: Meneger narx/summa ma'lumotini KO'RMAYDI va KIRITMAYDI. Har bir
 * mahsulotning narxi (sku_master.sale_price) fonda avtomatik olinadi va
 * sale_items.unit_price / line_total shu asosda hisoblanadi — ekranda hech
 * qayerda ko'rsatilmaydi. sales.total_amount'ni bazadagi trigger
 * (recalc_sale_totals) sale_items yozilgach o'zi qayta hisoblaydi.
 * Bigmanager keyinchalik narxni tekshirib/tuzatishi mumkin.
 */
export default function NakladnoySection({ departmentId, appUserId, onSaved }) {
  const [saleDate, setSaleDate] = useState(todayIso())
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [lines, setLines] = useState(() => [makeEmptyLine()])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [recentSales, setRecentSales] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [dateFilter, setDateFilter] = useState('')

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    let query = supabase
      .from('sales')
      .select(
        'id, sale_date, vehicle_number, created_at, customers(full_name), sale_items(qty, sku_master(sku_code, display_name, unit))'
      )
      .eq('department_id', departmentId)
      .eq('is_archived', false)

    if (dateFilter) {
      query = query.eq('sale_date', dateFilter).order('created_at', { ascending: false }).limit(200)
    } else {
      query = query.order('created_at', { ascending: false }).limit(15)
    }

    const { data, error } = await query

    if (!error) {
      setRecentSales(data ?? [])
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
    setSelectedCustomer(null)
    setVehicleNumber('')
    setLines([makeEmptyLine()])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!selectedCustomer) {
      setErrorMsg('Mijoz tanlanmagan.')
      return
    }

    const rowsToInsert = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNo = i + 1

      if (!line.selectedSku) {
        setErrorMsg(`${lineNo}-qatorda mahsulot tanlanmagan.`)
        return
      }

      const qtyNum = line.qty.trim() === '' ? NaN : Number(line.qty)
      if (Number.isNaN(qtyNum) || qtyNum <= 0) {
        setErrorMsg(`${lineNo}-qatorda miqdor musbat son bo'lishi kerak.`)
        return
      }

      const unitPrice = Number(line.selectedSku.sale_price) || 0
      rowsToInsert.push({
        sku_id: line.selectedSku.id,
        qty: qtyNum,
        unit_price: unitPrice,
        line_total: qtyNum * unitPrice,
      })
    }

    const skuIds = rowsToInsert.map((r) => r.sku_id)
    const hasDuplicate = new Set(skuIds).size !== skuIds.length
    if (hasDuplicate) {
      setErrorMsg("Bir xil mahsulot ro'yxatda bir necha marta takrorlangan — har bir qatorda boshqa mahsulot tanlang.")
      return
    }

    setSubmitting(true)

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        department_id: departmentId,
        customer_id: selectedCustomer.id,
        sale_date: saleDate,
        vehicle_number: vehicleNumber.trim() === '' ? null : vehicleNumber.trim(),
        created_by: appUserId,
      })
      .select()
      .single()

    if (saleError) {
      setErrorMsg('Nakladnoy sarlavhasini saqlashda xatolik: ' + saleError.message)
      setSubmitting(false)
      return
    }

    const itemRows = rowsToInsert.map((r) => ({ ...r, sale_id: sale.id, department_id: departmentId }))
    const { error: itemsError } = await supabase.from('sale_items').insert(itemRows)

    if (itemsError) {
      setErrorMsg('Mahsulot qatorlarini saqlashda xatolik: ' + itemsError.message)
      setSubmitting(false)
      return
    }

    setSuccessMsg(
      itemRows.length === 1
        ? 'Nakladnoy saqlandi: 1 ta mahsulot.'
        : `Nakladnoy saqlandi: ${itemRows.length} ta mahsulot.`
    )
    setSubmitting(false)
    resetFormAfterSubmit()
    loadRecent()
    if (onSaved) onSaved()
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <h2 style={styles.panelTitle}>Yangi nakladnoy</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Sana</label>
              <CustomDatePicker value={saleDate} onChange={setSaleDate} />
            </div>
            <div style={{ ...styles.field, flex: 2 }}>
              <label style={styles.label}>Mijoz</label>
              <SearchSelect
                entityType="customers"
                placeholder="Kamida 3 harf yozing..."
                initialLabel={selectedCustomer?.full_name ?? ''}
                onSelect={setSelectedCustomer}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Avto raqami (ixtiyoriy)</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                style={styles.input}
                placeholder="01 A 123 AA"
              />
            </div>
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

              <div style={styles.row}>
                <div style={{ ...styles.field, flex: 2 }}>
                  <label style={styles.label}>Mahsulot</label>
                  <SearchSelect
                    entityType="sku_master"
                    departmentId={departmentId}
                    skuType="MAX"
                    placeholder="Kamida 3 harf yozing..."
                    initialLabel={
                      line.selectedSku
                        ? `${line.selectedSku.sku_code} — ${line.selectedSku.display_name}`
                        : ''
                    }
                    onSelect={(sku) => updateLine(line.key, { selectedSku: sku })}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Miqdor</label>
                  <NumberInput
                    value={line.qty}
                    onChange={(v) => updateLine(line.key, { qty: v })}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" style={styles.addLineBtn} onClick={addLine}>
            + Yana mahsulot qo'shish
          </button>

          {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
          {successMsg && <div style={styles.successBox}>{successMsg}</div>}

          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Saqlanmoqda...' : 'Nakladnoyni saqlash'}
          </button>
        </form>
      </div>

      <div style={styles.panel}>
        <div style={styles.headerRow}>
          <h2 style={{ ...styles.panelTitle, margin: 0 }}>Bugungi nakladnoylar</h2>
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

        {!loadingRecent && recentSales.length === 0 && (
          <p style={styles.emptyText}>Hozircha nakladnoy yo'q.</p>
        )}

        {!loadingRecent && recentSales.length > 0 && (
          <div style={styles.saleList}>
            {recentSales.map((sale) => (
              <div key={sale.id} style={styles.saleCard}>
                <div style={styles.saleCardHeader}>
                  <span style={styles.saleCustomer}>{sale.customers?.full_name ?? '—'}</span>
                  <span style={styles.saleMeta}>
                    {sale.sale_date}
                    {sale.vehicle_number ? ` · ${sale.vehicle_number}` : ''}
                  </span>
                </div>
                <ul style={styles.saleItemList}>
                  {(sale.sale_items ?? []).map((item, idx) => (
                    <li key={idx} style={styles.saleItemRow}>
                      <span>{item.sku_master?.display_name ?? '—'}</span>
                      <span className="mono-figure">
                        {formatQty(item.qty)} {item.sku_master?.unit ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  panel: {
    background: 'var(--canvas)',
    borderRadius: 'var(--radius-panel)',
    boxShadow: 'var(--shadow-panel)',
    padding: '24px 24px 28px',
  },
  panelTitle: { margin: '0 0 16px', color: 'var(--canvas-text)', fontSize: 17 },
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
  lineCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
    borderRadius: 10,
    padding: '14px 16px',
  },
  lineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  lineNumber: { fontSize: 12, fontWeight: 600, color: 'var(--copper)', letterSpacing: '0.02em' },
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  dateFilterRow: { display: 'flex', gap: 8, alignItems: 'center' },
  statusText: { color: 'var(--canvas-text-muted)' },
  emptyText: { color: 'var(--canvas-text-muted)', fontSize: 14 },
  saleList: { display: 'flex', flexDirection: 'column', gap: 12 },
  saleCard: {
    background: 'var(--canvas-raised)',
    border: '1px solid #e6dcc7',
    borderRadius: 10,
    padding: '12px 16px',
  },
  saleCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  saleCustomer: { fontWeight: 600, color: 'var(--canvas-text)', fontSize: 14 },
  saleMeta: { fontSize: 12, color: 'var(--canvas-text-muted)' },
  saleItemList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  saleItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--canvas-text)',
  },
}
