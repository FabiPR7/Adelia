import type { AdminStats, UserGrowthData, CompanyGrowthData, GeographicData } from '../services/adminAnalytics'

export function exportStatsToCSV(stats: AdminStats): void {
  const csvData = [
    ['Métrica', 'Valor'],
    ['Total Usuarios', stats.totalUsers],
    ['Total Clientes', stats.totalCustomers],
    ['Total Empresas', stats.totalCompanies],
    ['Nuevos Usuarios Hoy', stats.newUsersToday],
    ['Nuevos Usuarios Esta Semana', stats.newUsersThisWeek],
    ['Nuevos Usuarios Este Mes', stats.newUsersThisMonth],
    ['Nuevas Empresas Hoy', stats.newCompaniesToday],
    ['Nuevas Empresas Esta Semana', stats.newCompaniesThisWeek],
    ['Nuevas Empresas Este Mes', stats.newCompaniesThisMonth],
    ['Tasa Crecimiento Usuarios (%)', stats.userGrowthRate],
    ['Tasa Crecimiento Empresas (%)', stats.companyGrowthRate],
  ]

  downloadCSV(csvData, 'adelia-estadisticas-generales')
}

export function exportGrowthDataToCSV(
  data: UserGrowthData | CompanyGrowthData,
  type: 'usuarios' | 'empresas'
): void {
  const csvData = [
    ['Periodo', `Nuevos ${type}`],
    ...data.labels.map((label, index) => [label, data.values[index]])
  ]

  downloadCSV(csvData, `adelia-crecimiento-${type}`)
}

export function exportGeographicDataToCSV(
  data: GeographicData[],
  type: 'usuarios' | 'empresas'
): void {
  const csvData = [
    ['País', `Cantidad de ${type}`],
    ...data.map(item => [item.country, item.count])
  ]

  downloadCSV(csvData, `adelia-geografia-${type}`)
}

function downloadCSV(data: Array<Array<string | number>>, filename: string): void {
  const csvContent = data
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
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
