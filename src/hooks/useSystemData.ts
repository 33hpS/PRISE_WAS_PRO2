/**
 * useSystemData — хук для инкапсуляции данных главной страницы
 * Возвращает коллекции, товары, аудит, метрики и операции (seed/refresh).
 */

import { useCallback, useMemo, useState } from 'react'
import { StorageService, type AuditEvent, type SimpleCollection, type SimpleProduct } from '../services/storage'
import { AnalyticsService, type SystemMetrics } from '../services/analytics'
import { seedDemoData } from '../services/seed'

/**
 * Результат хука useSystemData
 */
export interface UseSystemDataResult {
  products: SimpleProduct[]
  collections: SimpleCollection[]
  auditLog: AuditEvent[]
  metrics: SystemMetrics
  pinnedCollections: SimpleCollection[]
  seed: () => void
  refresh: () => void
}

/**
 * useSystemData — главный хук
 */
export function useSystemData(): UseSystemDataResult {
  const [tick, setTick] = useState(0)

  // Чтение данных из LS
  const products = useMemo(() => StorageService.getProducts(), [tick])
  const collections = useMemo(() => StorageService.getCollections(), [tick])
  const auditLog = useMemo(() => StorageService.getAudit(), [tick])

  // Метрики
  const metrics = useMemo(() => AnalyticsService.calculate(collections, products, auditLog), [collections, products, auditLog])

  // Закреплённые коллекции
  const pinnedCollections = useMemo(
    () => collections.filter((c) => c.pinned && !c.is_archived),
    [collections],
  )

  /** Обновить (перечитать) данные */
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  /** Загрузить демо-данные */
  const seed = useCallback(() => {
    seedDemoData()
    refresh()
  }, [refresh])

  return { products, collections, auditLog, metrics, pinnedCollections, seed, refresh }
}
