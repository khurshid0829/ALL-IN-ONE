import { supabase } from './supabaseClient'

/**
 * Akt sverka (o'zaro hisob-kitob dalolatnomasi) uchun mijoz/yetkazib
 * beruvchi ledgerini quradi: davr boshiga qoldiq, davr ichidagi
 * operatsiyalar (oqib boruvchi qoldiq bilan), davr oxiriga qoldiq.
 *
 * Mijoz uchun har doim SOM (savdo doim SOM'da, 2026-07-09 qarori).
 * Yetkazib beruvchi uchun SOM/USD alohida bo'limlarda (netto qilinmaydi,
 * 2026-07-10 qarori).
 */

export async function loadCustomerLedger(customerId, departmentId, dateFrom, dateTo) {
  const [salesRes, paymentsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, sale_date, total_amount, vehicle_number')
      .eq('customer_id', customerId)
      .eq('department_id', departmentId)
      .eq('is_archived', false)
      .order('sale_date'),
    supabase
      .from('sales_payments')
      .select('id, payment_date, amount_som')
      .eq('customer_id', customerId)
      .eq('department_id', departmentId)
      .eq('is_archived', false)
      .order('payment_date'),
  ])

  if (salesRes.error) throw salesRes.error
  if (paymentsRes.error) throw paymentsRes.error

  const sales = salesRes.data ?? []
  const payments = paymentsRes.data ?? []

  const opening =
    sales.filter((s) => s.sale_date < dateFrom).reduce((sum, s) => sum + Number(s.total_amount || 0), 0) -
    payments.filter((p) => p.payment_date < dateFrom).reduce((sum, p) => sum + Number(p.amount_som || 0), 0)

  const rows = []
  sales
    .filter((s) => s.sale_date >= dateFrom && s.sale_date <= dateTo)
    .forEach((s) => {
      rows.push({
        date: s.sale_date,
        label: 'Nakladnoy' + (s.vehicle_number ? ' (' + s.vehicle_number + ')' : ''),
        debit: Number(s.total_amount || 0),
        credit: 0,
      })
    })
  payments
    .filter((p) => p.payment_date >= dateFrom && p.payment_date <= dateTo)
    .forEach((p) => {
      rows.push({ date: p.payment_date, label: "To'lov", debit: 0, credit: Number(p.amount_som || 0) })
    })

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let running = opening
  rows.forEach((r) => {
    running += r.debit - r.credit
    r.balance = running
  })

  return [
    {
      currency: 'SOM',
      title: "Hisob (so'm)",
      debitLabel: 'Sotilgan',
      creditLabel: "To'langan",
      openingBalance: opening,
      closingBalance: running,
      rows,
    },
  ]
}

export async function loadSupplierLedger(supplierId, departmentId, dateFrom, dateTo) {
  const { data, error } = await supabase
    .from('supplier_transactions')
    .select('id, transaction_date, transaction_type, currency, amount, description')
    .eq('supplier_id', supplierId)
    .eq('department_id', departmentId)
    .eq('is_archived', false)
    .order('transaction_date')

  if (error) throw error

  const txs = data ?? []
  const currencies = Array.from(new Set(txs.map((t) => t.currency))).sort()

  if (currencies.length === 0) {
    return [
      {
        currency: 'SOM',
        title: "Hisob (so'm)",
        debitLabel: 'Xarid',
        creditLabel: "To'langan",
        openingBalance: 0,
        closingBalance: 0,
        rows: [],
      },
    ]
  }

  return currencies.map((cur) => {
    const curTxs = txs.filter((t) => t.currency === cur)

    const opening = curTxs
      .filter((t) => t.transaction_date < dateFrom)
      .reduce((sum, t) => sum + (t.transaction_type === 'xarid' ? Number(t.amount) : -Number(t.amount)), 0)

    const rows = curTxs
      .filter((t) => t.transaction_date >= dateFrom && t.transaction_date <= dateTo)
      .map((t) => ({
        date: t.transaction_date,
        label: (t.transaction_type === 'xarid' ? 'Xarid' : "To'lov") + (t.description ? ' — ' + t.description : ''),
        debit: t.transaction_type === 'xarid' ? Number(t.amount) : 0,
        credit: t.transaction_type === 'tolov' ? Number(t.amount) : 0,
      }))

    let running = opening
    rows.forEach((r) => {
      running += r.debit - r.credit
      r.balance = running
    })

    return {
      currency: cur,
      title: cur === 'USD' ? 'Hisob (USD)' : "Hisob (so'm)",
      debitLabel: 'Xarid',
      creditLabel: "To'langan",
      openingBalance: opening,
      closingBalance: running,
      rows,
    }
  })
}
