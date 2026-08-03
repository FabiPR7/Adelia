const EXCEL_SEPARATOR = ';'

function escapeCell(value: string | number): string {
  const text = String(value)
  if (text.includes(EXCEL_SEPARATOR) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function downloadExcelFile(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const lines = [
    headers.map(escapeCell).join(EXCEL_SEPARATOR),
    ...rows.map((row) => row.map(escapeCell).join(EXCEL_SEPARATOR)),
  ]

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function formatExcelDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatExcelDateTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${formatExcelDate(date)} ${hours}:${minutes}`
}
