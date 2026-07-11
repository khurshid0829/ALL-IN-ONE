/**
 * Arxivlash ekranida ko'rsatiladigan jadvallar ro'yxati.
 * Yangi jadval qo'shish uchun shu ro'yxatga bitta yozuv qo'shish kifoya —
 * ArchiveManager.jsx'ga tegish shart emas.
 */
export const ARCHIVE_ENTITIES = [
  {
    key: 'sku_master',
    label: 'Nomenklatura (SKU)',
    table: 'sku_master',
    departmentScoped: true,
    selectColumns:
      'id, department_id, sku_code, display_name, unit, category, is_archived, updated_at, departments(name)',
    columns: [
      { key: 'sku_code', label: 'SKU kod' },
      { key: 'display_name', label: 'Nomi' },
      { key: 'unit', label: "O'lchov" },
      {
        key: 'department_name',
        label: "Bo'lim",
        derive: (row) => row.departments?.name ?? '\u2014',
      },
    ],
  },
  {
    key: 'customers',
    label: 'Mijozlar',
    table: 'customers',
    departmentScoped: false,
    selectColumns: 'id, full_name, phone, is_archived, updated_at',
    columns: [
      { key: 'full_name', label: 'F.I.Sh / Nomi' },
      { key: 'phone', label: 'Telefon' },
    ],
  },
  {
    key: 'sales',
    label: 'Savdo (cheklar)',
    table: 'sales',
    departmentScoped: true,
    selectColumns:
      'id, department_id, sale_date, total_amount, status, is_archived, updated_at, customers(full_name), departments(name)',
    columns: [
      { key: 'sale_date', label: 'Sana' },
      {
        key: 'customer_name',
        label: 'Mijoz',
        derive: (row) => row.customers?.full_name ?? '\u2014',
      },
      { key: 'total_amount', label: 'Summa (som)', isNumber: true },
      { key: 'status', label: 'Holat' },
      {
        key: 'department_name',
        label: "Bo'lim",
        derive: (row) => row.departments?.name ?? '\u2014',
      },
    ],
  },
  {
    key: 'warehouse_entries',
    label: 'Ombor kirim-chiqim',
    table: 'warehouse_entries',
    departmentScoped: true,
    selectColumns:
      'id, department_id, entry_date, qty_in, qty_out, note, is_archived, updated_at, sku_master(sku_code, display_name), departments(name)',
    columns: [
      { key: 'entry_date', label: 'Sana' },
      {
        key: 'sku_label',
        label: 'SKU',
        derive: (row) =>
          row.sku_master
            ? `${row.sku_master.sku_code} \u2014 ${row.sku_master.display_name}`
            : '\u2014',
      },
      { key: 'qty_in', label: 'Kirim', isNumber: true },
      { key: 'qty_out', label: 'Chiqim', isNumber: true },
      { key: 'note', label: 'Izoh' },
      {
        key: 'department_name',
        label: "Bo'lim",
        derive: (row) => row.departments?.name ?? '\u2014',
      },
    ],
  },
]
