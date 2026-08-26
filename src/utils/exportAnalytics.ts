import type { AdminOverviewStats, DonutSlice, SeriesPoint } from './adminOverview'

export function exportStatsToCSV(stats: AdminOverviewStats): void {
  const csvData = [
    ['Métrica', 'Valor'],
    ['Total usuarios', stats.totalUsers],
    ['Clientes', stats.totalCustomers],
    ['Cuentas empresa', stats.totalCompanyAccounts],
    ['Restaurantes', stats.totalCompanies],
    ['Planes de pago', stats.paidCompanies],
    ['Planes mensuales', stats.monthlyPlans],
    ['Planes perpetuos', stats.perpetualPlans],
    ['Reservas', stats.totalReservations],
    ['Reservas hoy', stats.reservationsToday],
    ['Reservas esta semana', stats.reservationsThisWeek],
    ['Reservas este mes', stats.reservationsThisMonth],
    ['Comensales', stats.totalGuests],
    ['Media pax', stats.avgPartySize],
    ['Cancelación %', stats.cancellationRate],
    ['Próximas confirmadas', stats.upcomingReservations],
    ['Crecimiento clientes %', stats.userGrowthRate],
    ['Crecimiento empresas %', stats.companyGrowthRate],
    ['Crecimiento reservas %', stats.reservationGrowthRate],
  ]

  downloadCSV(csvData, 'adelia-kpis')
}

export function exportGrowthDataToCSV(
  data: SeriesPoint,
  type: 'usuarios' | 'empresas' | 'reservas',
): void {
  downloadCSV(
    [['Periodo', `Nuevos ${type}`], ...data.labels.map((label, index) => [label, data.values[index]])],
    `adelia-crecimiento-${type}`,
  )
}

export function exportGeographicDataToCSV(
  data: Array<{ country: string; count: number }>,
  type: 'usuarios' | 'empresas',
): void {
  downloadCSV(
    [['País', `Cantidad de ${type}`], ...data.map((item) => [item.country, item.count])],
    `adelia-geografia-${type}`,
  )
}

export function exportSlicesToCSV(slices: DonutSlice[], filename: string): void {
  downloadCSV(
    [['Segmento', 'Valor'], ...slices.map((slice) => [slice.label, slice.value])],
    `adelia-${filename}`,
  )
}

function downloadCSV(data: Array<Array<string | number>>, filename: string): void {
  const csvContent = data
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
