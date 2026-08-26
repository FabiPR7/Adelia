import AdminKpiCard from './AdminKpiCard'
import AdminGrowthLineChart from './AdminGrowthLineChart'
import AdminGeographicBarChart from './AdminGeographicBarChart'
import AdminAnalyticsFilters from './AdminAnalyticsFilters'
import AdminDonutChart from './AdminDonutChart'
import AdminColumnChart from './AdminColumnChart'
import AdminKpiSkeleton from './AdminKpiSkeleton'
import AdminChartSkeleton from './AdminChartSkeleton'
import AdminEmptyState from './AdminEmptyState'
import AdminErrorState from './AdminErrorState'
import {
  IconBan,
  IconBuildings,
  IconCalendar,
  IconClock,
  IconCrown,
  IconGuests,
  IconTrend,
  IconUsers,
} from './AdminIcons'
import type { AdminOverview } from '../../utils/adminOverview'
import type { DateRangeFilter, TimeRange } from '../../services/adminAnalytics.types'
import {
  exportGeographicDataToCSV,
  exportGrowthDataToCSV,
  exportSlicesToCSV,
} from '../../utils/exportAnalytics'
import styles from '../../pages/AdminDashboard.module.css'

interface AdminOverviewBoardProps {
  overview: AdminOverview | null
  isLoading: boolean
  error: string | null
  timeRange: TimeRange
  countryFilter: string
  onTimeRangeChange: (range: TimeRange) => void
  onCountryFilterChange: (country: string) => void
  onCustomDateRangeChange: (range: DateRangeFilter) => void
  onRetry: () => void
}

function AdminOverviewBoard({
  overview,
  isLoading,
  error,
  timeRange,
  countryFilter,
  onTimeRangeChange,
  onCountryFilterChange,
  onCustomDateRangeChange,
  onRetry,
}: AdminOverviewBoardProps) {
  if (error && !overview) {
    return <AdminErrorState message={error} onRetry={onRetry} />
  }

  if (isLoading && !overview) {
    return (
      <>
        <div className={styles.kpiGrid}>
          {Array.from({ length: 8 }, (_, index) => <AdminKpiSkeleton key={index} />)}
        </div>
        <div className={styles.chartsGrid}>
          <AdminChartSkeleton />
          <AdminChartSkeleton />
        </div>
      </>
    )
  }

  if (!overview) {
    return (
      <AdminEmptyState
        icon="◇"
        title="Aún no hay estadísticas"
        description="Cuando entren clientes, restaurantes y reservas, aquí verás el pulso de Adelia."
        action={{ label: 'Actualizar', onClick: onRetry }}
      />
    )
  }

  const { stats } = overview

  return (
    <>
      {error ? <AdminErrorState title="No se pudo actualizar" message={error} onRetry={onRetry} /> : null}

      <AdminAnalyticsFilters
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        countryFilter={countryFilter}
        onCountryFilterChange={onCountryFilterChange}
        availableCountries={overview.countries}
        onCustomDateRangeChange={onCustomDateRangeChange}
      />

      <div className={styles.kpiGrid}>
        <AdminKpiCard
          title="Clientes"
          value={stats.totalCustomers}
          subtitle="Cuentas de comensal"
          accent="teal"
          icon={<IconUsers />}
          sparkline={overview.userSpark}
          trend={{ value: stats.newUsersThisWeek, label: 'altas esta semana', positive: stats.newUsersThisWeek >= 0 }}
        />
        <AdminKpiCard
          title="Restaurantes"
          value={stats.totalCompanies}
          subtitle={`${stats.paidCompanies} con plan de pago`}
          accent="gold"
          icon={<IconBuildings />}
          sparkline={overview.companySpark}
          trend={{ value: stats.newCompaniesThisMonth, label: 'este mes', positive: stats.companyGrowthRate >= 0 }}
        />
        <AdminKpiCard
          title="Reservas"
          value={stats.totalReservations}
          subtitle={`${stats.reservationsToday} hoy`}
          accent="coral"
          icon={<IconCalendar />}
          sparkline={overview.reservationSpark}
          trend={{
            value: Math.abs(stats.reservationGrowthRate),
            label: 'vs mes anterior',
            positive: stats.reservationGrowthRate >= 0,
          }}
        />
        <AdminKpiCard
          title="Comensales"
          value={stats.totalGuests}
          subtitle={`Media ${stats.avgPartySize} por mesa`}
          accent="ink"
          icon={<IconGuests />}
        />
        <AdminKpiCard
          title="Crecimiento clientes"
          value={Math.abs(stats.userGrowthRate)}
          suffix="%"
          decimals={1}
          subtitle="Altas mes vs mes anterior"
          accent="teal"
          icon={<IconTrend />}
          trend={{ value: stats.previousMonthUsers, label: 'mes anterior', positive: stats.userGrowthRate >= 0 }}
        />
        <AdminKpiCard
          title="Cancelación"
          value={stats.cancellationRate}
          suffix="%"
          decimals={1}
          subtitle={`${stats.cancelledReservations} canceladas`}
          accent="coral"
          icon={<IconBan />}
          trend={{
            value: stats.completedReservations,
            label: 'completadas',
            positive: true,
          }}
        />
        <AdminKpiCard
          title="Planes de pago"
          value={stats.paidCompanies}
          subtitle={`${stats.monthlyPlans} mensual · ${stats.perpetualPlans} perpetua`}
          accent="gold"
          icon={<IconCrown />}
        />
        <AdminKpiCard
          title="Próximas"
          value={stats.upcomingReservations}
          subtitle="Confirmadas que aún no han pasado"
          accent="ink"
          icon={<IconClock />}
        />
      </div>

      <div className={styles.heroGrid}>
        <AdminGrowthLineChart
          title="Reservas en el tiempo"
          subtitle="Altas de reserva en el periodo elegido"
          data={overview.reservationGrowth}
          color="#e25a3c"
          onExport={() => exportGrowthDataToCSV(overview.reservationGrowth, 'reservas')}
        />
        <AdminDonutChart
          title="Estado de las reservas"
          subtitle="En el periodo filtrado"
          slices={overview.reservationsByStatus}
          centerLabel="reservas"
          onExport={() => exportSlicesToCSV(overview.reservationsByStatus, 'estado-reservas')}
        />
      </div>

      <div className={styles.chartsGrid}>
        <AdminGrowthLineChart
          title="Altas de clientes"
          subtitle="Nuevas cuentas de comensal"
          data={overview.userGrowth}
          color="#2e7d6b"
          onExport={() => exportGrowthDataToCSV(overview.userGrowth, 'usuarios')}
        />
        <AdminGrowthLineChart
          title="Altas de restaurantes"
          subtitle="Nuevas empresas en Adelia"
          data={overview.companyGrowth}
          color="#c49a3a"
          onExport={() => exportGrowthDataToCSV(overview.companyGrowth, 'empresas')}
        />
      </div>

      <div className={styles.chartsGrid}>
        <AdminDonutChart
          title="Mix de planes"
          subtitle="Cómo está el catálogo ahora"
          slices={overview.plansDistribution}
          centerLabel="locales"
          onExport={() => exportSlicesToCSV(overview.plansDistribution, 'planes')}
        />
        <AdminColumnChart
          title="Reservas por día"
          subtitle="Lunes a domingo en el periodo"
          data={overview.reservationsByWeekday}
        />
      </div>

      <div className={styles.chartsGrid}>
        <AdminGeographicBarChart
          title="Locales que más reservan"
          subtitle="Top del periodo"
          data={overview.topCompanies}
          color="#e25a3c"
        />
        <AdminDonutChart
          title="Tipo de cobro"
          subtitle="Mensual, perpetua o Mesa"
          slices={overview.billingDistribution}
          centerLabel="locales"
          onExport={() => exportSlicesToCSV(overview.billingDistribution, 'tipo-plan')}
        />
      </div>

      <div className={styles.chartsGrid}>
        <AdminGeographicBarChart
          title="Clientes por país"
          data={overview.usersByCountry}
          color="#2e7d6b"
          onExport={() => exportGeographicDataToCSV(
            overview.usersByCountry.map((item) => ({ country: item.label, count: item.count })),
            'usuarios',
          )}
        />
        <AdminGeographicBarChart
          title="Restaurantes por país"
          data={overview.companiesByCountry}
          color="#c49a3a"
          onExport={() => exportGeographicDataToCSV(
            overview.companiesByCountry.map((item) => ({ country: item.label, count: item.count })),
            'empresas',
          )}
        />
      </div>
    </>
  )
}

export default AdminOverviewBoard
