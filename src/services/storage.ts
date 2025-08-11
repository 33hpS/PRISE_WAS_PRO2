/**
 * StorageService — централизованный доступ к localStorage
 * Согласованные ключи и безопасное чтение/запись.
 */

export interface AuditEvent {
  /** Уникальный ID события */
  id: string
  /** Время (ms epoch) */
  at: number
  /** Действие */
  action: string
  /** Сущность события */
  entity: 'collection' | 'product' | 'system' | string
  /** ID сущности (опционально) */
  entityId?: string
  /** Доп. данные */
  details?: any
  /** Версия записи */
  version?: string
}

/**
 * Упрощенный товар для главной
 */
export interface SimpleProduct {
  id: string
  name: string
  article: string
  imageKeyword?: string
  created_at: string
  updated_at: string
}

/**
 * Упрощенная коллекция для главной
 */
export interface SimpleCollection {
  id: string
  name: string
  description?: string
  group?: string
  is_archived?: boolean
  pinned?: boolean
  product_order: string[]
  created_at: string
  updated_at: string
}

/**
 * Ключи хранилища приложения
 */
export const LS_KEYS = {
  collections: 'wasser_collections_data',
  products: 'wasser_products_data',
  audit: 'wasser_change_log',
} as const

/**
 * Безопасное чтение/запись JSON в localStorage
 */
export class StorageService {
  /** Прочитать значение типа T из LS безопасно */
  static read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  /** Записать значение в LS безопасно */
  static write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* noop */
    }
  }

  /** Получить коллекции */
  static getCollections(): SimpleCollection[] {
    return this.read<SimpleCollection[]>(LS_KEYS.collections, [])
  }

  /** Сохранить коллекции */
  static saveCollections(list: SimpleCollection[]): void {
    this.write(LS_KEYS.collections, list)
  }

  /** Получить товары */
  static getProducts(): SimpleProduct[] {
    return this.read<SimpleProduct[]>(LS_KEYS.products, [])
  }

  /** Сохранить товары */
  static saveProducts(list: SimpleProduct[]): void {
    this.write(LS_KEYS.products, list)
  }

  /** Получить журнал аудита */
  static getAudit(): AuditEvent[] {
    return this.read<AuditEvent[]>(LS_KEYS.audit, [])
  }

  /** Добавить запись в журнал */
  static pushAudit(item: Omit<AuditEvent, 'id' | 'at' | 'version'>): void {
    const list = this.getAudit()
    const record: AuditEvent = {
      id: StorageService.id(),
      at: Date.now(),
      version: 'v1',
      ...item,
    }
    this.write(LS_KEYS.audit, [record, ...list])
  }

  /** Утилита: компактный ID */
  static id(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
  }
}
