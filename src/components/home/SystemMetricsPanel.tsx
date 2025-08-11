/**
 * SystemMetricsPanel — виджет ключевых метрик системы
 * Показывает четыре карточки: коллекции, изделия, операции за сегодня и аптайм.
 */

import React from 'react'
import { Grid2X2, Package, Activity, CheckCircle, AlertCircle } from 'lucide-react'
import Card from '../common/Card'
import type { SystemMetrics } from '../../services/analytics'

/**
 * Пропсы панели метрик
 */
export interface SystemMetricsPanelProps {
  /** Набор метрик */
  metrics: SystemMetrics
}

/**
 * Карточка метрики (внутренняя)
 */
function MetricCard({
  title,
  value,
  icon,
  tone = 'default',
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneCls =
    tone === 'success'
      ? 'bg-green-50 border-green-200'
      : tone === 'warning'
      ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-gray-200'

  return (
    <Card className={`p-4 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <div className="text-gray-500">{icon}</div>
      </div>
    </Card>
  )
}

/**
 * SystemMetricsPanel — основной компонент
 */
export default function SystemMetricsPanel({ metrics }: SystemMetricsPanelProps): React.ReactElement {
  const health = metrics.systemHealth
  const HealthIcon = health === 'warning' || health === 'critical' ? AlertCircle : CheckCircle
  const healthTone: 'success' | 'warning' = health === 'warning' || health === 'critical' ? 'warning' : 'success'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard title="Коллекции" value={metrics.totalCollections} icon={<Grid2X2 size={22} className="text-blue-600" />} />
      <MetricCard title="Изделия" value={metrics.totalProducts} icon={<Package size={22} className="text-emerald-600" />} />
      <MetricCard title="Операции (24ч)" value={metrics.todayOperations} icon={<Activity size={22} className="text-violet-600" />} />
      <MetricCard
        title="Доступность"
        value={`${metrics.uptime}%`}
        icon={<HealthIcon size={22} className={healthTone === 'success' ? 'text-green-600' : 'text-amber-600'} />}
        tone={healthTone}
      />
    </div>
  )
}
