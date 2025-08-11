/**
 * SeedDataService — генерация демонстрационных данных совместимых со страницей «Коллекции».
 */

import { StorageService, type SimpleCollection, type SimpleProduct } from './storage'

/**
 * Сгенерировать товары для демонстрации
 */
export function generateProducts(): SimpleProduct[] {
  const now = new Date().toISOString()
  const id = StorageService.id
  return [
    { id: id(), name: 'Тумба 600 Белая', article: 'TB-600-WHT', imageKeyword: 'bathroom furniture', created_at: now, updated_at: now },
    { id: id(), name: 'Тумба 800 Дуб', article: 'TB-800-OAK', imageKeyword: 'modern cabinet', created_at: now, updated_at: now },
    { id: id(), name: 'Пенал узкий', article: 'PENAL-NARROW', imageKeyword: 'tall cabinet', created_at: now, updated_at: now },
    { id: id(), name: 'Зеркало 600', article: 'MIR-600', imageKeyword: 'mirror', created_at: now, updated_at: now },
    { id: id(), name: 'Полка настенная', article: 'SHELF-600', imageKeyword: 'shelf', created_at: now, updated_at: now },
    { id: id(), name: 'Тумба 1000 Глянец', article: 'TB-1000-GL', imageKeyword: 'gloss furniture', created_at: now, updated_at: now },
  ]
}

/**
 * Сгенерировать коллекции на базе переданных товаров
 */
export function generateCollections(productIds: string[]): SimpleCollection[] {
  const now = new Date().toISOString()
  const id = StorageService.id
  const half = Math.ceil(productIds.length / 2)
  return [
    {
      id: id(),
      name: '2025 Весна',
      description: 'Светлая и лаконичная коллекция',
      group: '2025 Весна',
      is_archived: false,
      pinned: true,
      product_order: productIds.slice(0, half),
      created_at: now,
      updated_at: now,
    },
    {
      id: id(),
      name: '2025 Осень',
      description: 'Тёплые тона и натуральные фактуры',
      group: '2025 Осень',
      is_archived: false,
      pinned: false,
      product_order: productIds.slice(half),
      created_at: now,
      updated_at: now,
    },
  ]
}

/**
 * Выполнить загрузку демо-данных и записать событие в аудит
 */
export function seedDemoData(): { products: SimpleProduct[]; collections: SimpleCollection[] } {
  const products = generateProducts()
  const collections = generateCollections(products.map((p) => p.id))
  StorageService.saveProducts(products)
  StorageService.saveCollections(collections)
  StorageService.pushAudit({
    action: 'seed',
    entity: 'system',
    details: { products: products.length, collections: collections.length },
  })
  return { products, collections }
}
