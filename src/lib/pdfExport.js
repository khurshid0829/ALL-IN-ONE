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
    doc.text(sanitizeForPdf(section.title), marginX, y)

    const body = section.rows.map((r) => [
      r.date,
      sanitizeForPdf(r.label),
      r.debit ? fmtAmount(r.debit, section.currency) : '',
      r.credit ? fmtAmount(r.credit, section.currency) : '',
      fmtAmount(r.balance, section.currency),
    ])

    autoTable(doc, {
      startY: y + 10,
      margin: { left: marginX, right: marginX },
      head: [['Sana', 'Izoh', sanitizeForPdf(section.debitLabel), sanitizeForPdf(section.creditLabel), 'Qoldiq']],
      body: [
        ['', sanitizeForPdf('Davr boshiga qoldiq'), '', '', fmtAmount(section.openingBalance, section.currency)],
        ...body,
      ],
      foot: [['', sanitizeForPdf('Davr oxiriga qoldiq'), '', '', fmtAmount(section.closingBalance, section.currency)]],
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [181, 101, 29] },
      footStyles: { fillColor: [244, 239, 228], textColor: [34, 29, 22], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
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
