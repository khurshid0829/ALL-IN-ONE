import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatMoney } from './formatNumbers'

/**
 * jsPDF standart shriftlari (Helvetica) faqat WinAnsi/Latin-1 belgilarni
 * qo'llab-quvvatlaydi — bizning UI'da ishlatiladigan "qayrilgan" tirnoq
 * (‘ ‘) va boshqa "smart" belgilar bo'sh katakcha bo'lib chiqadi.
 * Shu sabab PDF'ga yozishdan oldin oddiy ASCII muqobiliga almashtiriladi.
 */
function sanitizeForPdf(text) {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/[‘’ʼʻ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
}

function fmtAmount(value, currency) {
  const num = sanitizeForPdf(formatMoney(value))
  return currency === 'USD' ? '$' + num : num + " so'm"
}

/**
 * Akt sverka PDF fayl sifatida yuklab olinadi.
 * sections: [{ currency, title, debitLabel, creditLabel, openingBalance,
 *   closingBalance, rows: [{date, label, debit, credit, balance}] }]
 */
export function exportAktSverkaPdf({ entityName, departmentName, dateFrom, dateTo, sections, generatedAt }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 40
  let y = 50

  doc.setFontSize(16)
  doc.text(sanitizeForPdf('Akt sverka'), marginX, y)
  y += 22

  doc.setFontSize(11)
  doc.text(sanitizeForPdf('Kontragent: ' + entityName), marginX, y)
  y += 16
  doc.text(sanitizeForPdf("Bo'lim: " + (departmentName ?? '-')), marginX, y)
  y += 16
  doc.text(sanitizeForPdf('Davr: ' + dateFrom + ' - ' + dateTo), marginX, y)
  y += 24

  sections.forEach((section) => {
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text(sanitizeForPdf(section.title), marginX, y)

    const openingRow = [
      '',
      sanitizeForPdf('Davr boshiga qoldiq'),
      '',
      '',
      fmtAmount(section.openingBalance, section.currency),
    ]
    const dataRows = section.rows.map((r) => [
      r.date,
      sanitizeForPdf(r.label),
      r.debit ? fmtAmount(r.debit, section.currency) : '',
      r.credit ? fmtAmount(r.credit, section.currency) : '',
      fmtAmount(r.balance, section.currency),
    ])
    const closingRow = [
      '',
      sanitizeForPdf('Davr oxiriga qoldiq'),
      '',
      '',
      fmtAmount(section.closingBalance, section.currency),
    ]

    // "foot" mexanizmi o'rniga oddiy qator sifatida qo'shildi va
    // didParseCell orqali ajratib bo'yaladi — bu ishonchliroq ishlaydi.
    const allRows = [openingRow, ...dataRows, closingRow]
    const closingRowIndex = allRows.length - 1

    autoTable(doc, {
      startY: y + 10,
      margin: { left: marginX, right: marginX },
      head: [['Sana', 'Izoh', sanitizeForPdf(section.debitLabel), sanitizeForPdf(section.creditLabel), 'Qoldiq']],
      body: allRows,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: [181, 101, 29], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 190 },
        2: { cellWidth: 85, halign: 'right' },
        3: { cellWidth: 85, halign: 'right' },
        4: { cellWidth: 95, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === 0 || data.row.index === closingRowIndex) {
          data.cell.styles.fillColor = [244, 239, 228]
          data.cell.styles.textColor = [34, 29, 22]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    y = doc.lastAutoTable.finalY + 24
  })

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(sanitizeForPdf('Yaratildi: ' + generatedAt), marginX, y)

  const fileSafeName = sanitizeForPdf(entityName)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  doc.save('akt_sverka_' + fileSafeName + '_' + dateTo + '.pdf')
}
