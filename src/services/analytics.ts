/**
 * AnalyticsService — вычисление метрик системы и отбор активностей.
 */

import type { AuditEvent, SimpleCollection, SimpleProduct } from './storage'

/**
 * SystemMetrics — набор показателей состояния
 */
export interface SystemMetrics {
  /** Всего коллекций */
  totalCollections: number
  /** Всего изделий */
  totalProducts: number
  /** Активных (неархивных) коллекций */
  activeCollections: number
  /** Закреплённых коллекций */
  pinnedCollections: number
  /** Всего операций в журнале */
  totalOperations: number
  /** Операций за последние 24 часа */
  todayOperations: number
  /** Состояние системы */
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical'
  /** Примерный аптайм, % */
  uptime: number
}

/**
 * AnalyticsService — методы аналитики
 */
export class AnalyticsService {
  /** Посчитать метрики */
  static calculate(
    collections: SimpleCollection[],
    products: SimpleProduct[],
    audit: AuditEvent[],
  ): SystemMetrics {
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    const active = collections.filter((c) => !c.is_archived)
    const pinned = collections.filter((c) => c.pinned && !c.is_archived)
    const todayOps = audit.filter((a) => a.at > dayAgo)

    const health = this.assessHealth(collections, products, audit)

    return {
      totalCollections: collections.length,
      totalProducts: products.length,
      activeCollections: active.length,
      pinnedCollections: pinned.length,
      totalOperations: audit.length,
      todayOperations: todayOps.length,
      systemHealth: health,
      uptime: this.estimateUptime(),
    }
  }

  /** Определить здоровье системы по простым эвристикам */
  private static assessHealth(
    collections: SimpleCollection[],
    products: SimpleProduct[],
    audit: AuditEvent[],
  ): SystemMetrics['systemHealth'] {
    const hasData = collections.length > 0 && products.length > 0
    const hasRecent = audit.some((a) => a.at > Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (hasData && hasRecent) return 'excellent'
    if (hasData) return 'good'
    if (collections.length > 0 || products.length > 0) return 'warning'
    return 'critical'
  }

  /** Черновая оценка аптайма для демо */
  private static estimateUptime(): number {
    return 95 + Math.floor(Math.random() * 5)
  }

  /** Последние N событий */
  static recent(audit: AuditEvent[], limit = 5): AuditEvent[] {
    return audit.slice(0, limit)
  }
}
