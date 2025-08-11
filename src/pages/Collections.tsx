/** 
 * Страница "Коллекции"
 * Улучшения:
 * - Статистика (всего коллекций, изделий, архивных)
 * - Фильтры с чипами групп
 * - Карточка коллекции с закреплением (pin) и быстрым добавлением изделия
 * - DnD-редактор — фильтрация по типам (Тумбы/Пеналы/Зеркала/Прочее)
 * - Новое: обложка коллекции (cover_url) + поле в модалке "Обложка (URL)"
 * - Дополнено: клик по товару из превью открывает карточку товара с редактированием.
 * - Новое: в DnD-редакторе карточка товара кликабельна — открывается полная модалка товара с вкладкой "Технологическая карта".
 * - Новое: AI (Claude) — генерация описания коллекции и подсказка технологической карты изделия.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Grid2X2,
  Plus,
  BookOpenCheck,
  Layers,
  GripVertical,
  Trash2,
  Wand2,
  Sparkles,
} from 'lucide-react'

import CollectionStatsBar from '../components/collections/CollectionStatsBar'
import CollectionsFilters from '../components/collections/CollectionsFilters'
import CollectionCard, { type ICollection as CardCollection, type IProduct as CardProduct } from '../components/collections/CollectionCard'
import ProgressiveImage from '../components/common/ProgressiveImage'
import TechCardManager from '../components/techcard/TechCardManager'
import type { Material, TechCardItem } from '../types/models'
import { AiService, type MaterialsCatalogItem, type AiTechCardItem } from '../services/ai'

/**
 * Тип события журнала
 */
interface AuditEvent {
  id: string
  at: number
  action: string
  entity: 'collection' | 'product' | 'system' | string
  entityId?: string
  details?: any
  version?: string
}

/**
 * Тип товара (дополнен: tech_card для редактирования ТД)
 */
interface Product {
  id: string
  name: string
  article: string
  imageKeyword?: string
  /** Техкарта (опционально для обратной совместимости) */
  tech_card?: TechCardItem[]
  created_at: string
  updated_at: string
}

/**
 * Тип коллекции (добавлено поле cover_url)
 */
interface Collection {
  id: string
  name: string
  description?: string
  group?: string
  is_archived?: boolean
  pinned?: boolean
  product_order: string[]
  /** URL обложки коллекции */
  cover_url?: string
  created_at: string
  updated_at: string
}

/**
 * Локальные ключи хранилища
 */
const LS_KEYS = {
  collections: 'wasser_collections_data',
  products: 'wasser_products_data',
  audit: 'wasser_change_log',
  materials: 'wasser_materials_data',
}

/**
 * Утилиты
 */
const utils = {
  /** Генерация ID */
  id: () => Date.now().toString(36) + Math.random().toString(36).slice(2),
  /** Короткий формат даты */
  shortDate: (d: string | number | Date) =>
    new Date(d).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }),
  /** Безопасное чтение из LS */
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  /** Запись в LS */
  write<T>(key: string, value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* noop */
    }
  },
}

/**
 * Классификация изделий по типу для UX (эвристика по названию/артикулу)
 */
type FurnitureKind = 'tumbas' | 'penals' | 'mirrors' | 'other'
function classifyProduct(p: { name: string; article?: string }): FurnitureKind {
  const n = (p.name || '').toLowerCase()
  const a = (p.article || '').toLowerCase()
  // Тумбы
  if (n.includes('тумб') || a.includes('tumb') || a.includes('tb-')) return 'tumbas'
  // Пеналы
  if (n.includes('пенал') || a.includes('penal')) return 'penals'
  // Зеркала
  if (n.includes('зеркал') || a.includes('mir')) return 'mirrors'
  return 'other'
}

/**
 * Логирование событий в общий журнал
 */
function logEvent(event: Omit<AuditEvent, 'id' | 'at' | 'version'>) {
  const list = utils.read<AuditEvent[]>(LS_KEYS.audit, [])
  const item: AuditEvent = {
    id: utils.id(),
    at: Date.now(),
    version: 'v1',
    ...event,
  }
  utils.write(LS_KEYS.audit, [item, ...list])
}

/**
 * Начальные тестовые продукты (если нет в LS)
 * Дополнено: добавляем пустую техкарту
 */
function seedProducts(): Product[] {
  const now = new Date().toISOString()
  return [
    { id: utils.id(), name: 'Тумба 600 Белая', article: 'TB-600-WHT', imageKeyword: 'bathroom furniture', tech_card: [], created_at: now, updated_at: now },
    { id: utils.id(), name: 'Тумба 800 Дуб', article: 'TB-800-OAK', imageKeyword: 'modern cabinet', tech_card: [], created_at: now, updated_at: now },
    { id: utils.id(), name: 'Пенал узкий', article: 'PENAL-NARROW', imageKeyword: 'tall cabinet', tech_card: [], created_at: now, updated_at: now },
    { id: utils.id(), name: 'Зеркало 600', article: 'MIR-600', imageKeyword: 'mirror', tech_card: [], created_at: now, updated_at: now },
    { id: utils.id(), name: 'Полка настенная', article: 'SHELF-600', imageKeyword: 'shelf', tech_card: [], created_at: now, updated_at: now },
    { id: utils.id(), name: 'Тумба 1000 Глянец', article: 'TB-1000-GL', imageKeyword: 'gloss furniture', tech_card: [], created_at: now, updated_at: now },
  ]
}

/**
 * Начальные коллекции (если нет в LS). Добавлено поле cover_url: пустое по умолчанию.
 */
function seedCollections(productIds: string[]): Collection[] {
  const now = new Date().toISOString()
  const firstHalf = productIds.slice(0, Math.ceil(productIds.length / 2))
  return [
    {
      id: utils.id(),
      name: '2025 Весна',
      description: 'Светлая и лаконичная коллекция',
      group: '2025 Весна',
      is_archived: false,
      pinned: true,
      product_order: firstHalf,
      cover_url: '',
      created_at: now,
      updated_at: now,
    },
    {
      id: utils.id(),
      name: '2025 Осень',
      description: 'Теплые тона и натуральные фактуры',
      group: '2025 Осень',
      is_archived: false,
      pinned: false,
      product_order: productIds.filter((id) => !firstHalf.includes(id)),
      cover_url: '',
      created_at: now,
      updated_at: now,
    },
  ]
}

/**
 * Компонент "Коллекции"
 */
export default function CollectionsPage(): React.ReactElement {
  // Данные
  const [products, setProducts] = useState<Product[]>(
    () => utils.read<Product[]>(LS_KEYS.products, seedProducts()),
  )
  const [collections, setCollections] = useState<Collection[]>(
    () =>
      utils.read<Collection[]>(
        LS_KEYS.collections,
        seedCollections(utils.read<Product[]>(LS_KEYS.products, seedProducts()).map((p) => p.id)),
      ),
  )

  // Сохранение в LS
  useEffect(() => utils.write(LS_KEYS.products, products), [products])
  useEffect(() => utils.write(LS_KEYS.collections, collections), [collections])

  // Фильтры
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [showArchived, setShowArchived] = useState<boolean>(false)

  // Группы
  const groups = useMemo(() => {
    const s = new Set<string>()
    collections.forEach((c) => c.group && s.add(c.group))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [collections])

  // Подсчёты для статистики
  const stats = useMemo(() => {
    const archivedCount = collections.filter((c) => c.is_archived).length
    const productsUnique = new Set<string>()
    collections.forEach((c) => c.product_order.forEach((id) => productsUnique.add(id)))
    return {
      collectionsCount: collections.length,
      productsCount: productsUnique.size,
      archivedCount,
    }
  }, [collections])

  // Словарь изделий
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Фильтрация и сортировка (закреплённые сверху)
  const filteredCollections = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = collections
      .filter((c) => (showArchived ? true : !c.is_archived))
      .filter((c) => (groupFilter === 'all' ? true : (c.group || '') === groupFilter))
      .filter((c) => {
        if (!term) return true
        const nameMatch = c.name.toLowerCase().includes(term)
        const descrMatch = (c.description || '').toLowerCase().includes(term)
        const hasProductMatch = c.product_order
          .map((id) => productMap.get(id))
          .filter(Boolean)
          .some((p) => p!.name.toLowerCase().includes(term) || p!.article.toLowerCase().includes(term))
        return nameMatch || descrMatch || hasProductMatch
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    // Закреплённые сначала
    list = list.slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
    return list
  }, [collections, productMap, search, groupFilter, showArchived])

  // Модалки
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editorCollection, setEditorCollection] = useState<Collection | null>(null)
  /** Какая вкладка в модалке товара открыта */
  const [productTab, setProductTab] = useState<'info' | 'tc'>('info')

  // CRUD: Коллекции
  const createCollection = useCallback(() => {
    const now = new Date().toISOString()
    const c: Collection = {
      id: utils.id(),
      name: 'Новая коллекция',
      description: '',
      group: groups[0] || 'Без группы',
      is_archived: false,
      pinned: false,
      product_order: [],
      cover_url: '',
      created_at: now,
      updated_at: now,
    }
    setCollections((prev) => [c, ...prev])
    logEvent({ action: 'create', entity: 'collection', entityId: c.id, details: { name: c.name } })
    setEditingCollection(c)
  }, [groups])

  const updateCollection = useCallback((id: string, patch: Partial<Collection>) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c)),
    )
    logEvent({ action: 'update', entity: 'collection', entityId: id, details: patch })
  }, [])

  const deleteCollection = useCallback((id: string) => {
    const c = collections.find((x) => x.id === id)
    if (!c) return
    if (!confirm(`Удалить коллекцию "${c.name}"? Товары будут помечены как неприкрепленные.`)) return
    setCollections((prev) => prev.filter((x) => x.id !== id))
    logEvent({ action: 'delete', entity: 'collection', entityId: id, details: { name: c.name } })
  }, [collections])

  const toggleArchive = useCallback((id: string) => {
    const c = collections.find((x) => x.id === id)
    if (!c) return
    const next = !c.is_archived
    updateCollection(id, { is_archived: next })
    logEvent({
      action: next ? 'archive' : 'unarchive',
      entity: 'collection',
      entityId: id,
      details: { name: c.name },
    })
  }, [collections, updateCollection])

  const togglePin = useCallback((id: string) => {
    const c = collections.find((x) => x.id === id)
    if (!c) return
    updateCollection(id, { pinned: !c.pinned })
  }, [collections, updateCollection])

  // CRUD: Продукты (минимально)
  const createProduct = useCallback(() => {
    const now = new Date().toISOString()
    const p: Product = {
      id: utils.id(),
      name: 'Новое изделие',
      article: `ART-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      imageKeyword: 'furniture',
      tech_card: [],
      created_at: now,
      updated_at: now,
    }
    setProducts((prev) => [p, ...prev])
    logEvent({ action: 'create', entity: 'product', entityId: p.id, details: { name: p.name } })
    setEditingProduct(p)
    setProductTab('info')
  }, [])

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)),
    )
    logEvent({ action: 'update', entity: 'product', entityId: id, details: patch })
  }, [])

  const deleteProduct = useCallback((id: string) => {
    const p = products.find((x) => x.id === id)
    if (!p) return
    if (!confirm(`Удалить изделие "${p.name}"?`)) return
    // Удаляем из порядков в коллекциях
    setCollections((prev) =>
      prev.map((c) => ({ ...c, product_order: c.product_order.filter((pid) => pid !== id) })),
    )
    setProducts((prev) => prev.filter((x) => x.id !== id))
    logEvent({ action: 'delete', entity: 'product', entityId: id, details: { name: p.name } })
  }, [products])

  /**
   * Быстро добавить изделие в коллекцию (из выпадающего списка)
   */
  const quickAddProductToCollection = useCallback((collectionId: string, productId: string) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId && !c.product_order.includes(productId)
          ? { ...c, product_order: [...c.product_order, productId], updated_at: new Date().toISOString() }
          : c,
      ),
    )
    logEvent({
      action: 'add_product',
      entity: 'collection',
      entityId: collectionId,
      details: { productId },
    })
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Заголовок и действия */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Grid2X2 size={22} className="text-blue-600" />
            Коллекции
          </h1>
          <p className="text-gray-600 mt-1">
            Управляйте витриной изделий по коллекциям. Закрепляйте важные, быстро добавляйте изделия и открывайте DnD-редактор для детального порядка.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={() => (location.hash = '#/journal')}
            title="Открыть журнал изменений"
          >
            <BookOpenCheck size={16} className="inline mr-2" />
            Журнал
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={createProduct}
            title="Добавить изделие"
          >
            <Plus size={16} className="inline mr-2" />
            Изделие
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
            onClick={createCollection}
            title="Создать коллекцию"
          >
            <Plus size={16} className="inline mr-2" />
            Коллекция
          </button>
        </div>
      </div>

      {/* Статистика */}
      <CollectionStatsBar
        collectionsCount={stats.collectionsCount}
        productsCount={stats.productsCount}
        archivedCount={stats.archivedCount}
      />

      {/* Панель фильтров с чипами групп */}
      <CollectionsFilters
        search={search}
        onSearchChange={setSearch}
        groups={groups}
        groupFilter={groupFilter}
        onGroupChange={setGroupFilter}
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        onReset={() => {
          setSearch('')
          setGroupFilter('all')
          setShowArchived(false)
        }}
      />

      {/* Список коллекций */}
      <div className="space-y-6">
        {filteredCollections.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
            <Layers size={48} className="mx-auto mb-3 text-gray-300" />
            <div className="text-gray-600">Коллекции не найдены. Создайте первую коллекцию или измените фильтры.</div>
          </div>
        ) : (
          filteredCollections.map((c) => {
            const asCard: CardCollection = {
              id: c.id,
              name: c.name,
              description: c.description,
              group: c.group,
              is_archived: c.is_archived,
              pinned: c.pinned,
              product_order: c.product_order,
              cover_url: c.cover_url,
              updated_at: c.updated_at,
            }
            const mapForCard = productMap as unknown as Map<string, CardProduct>
            return (
              <CollectionCard
                key={c.id}
                collection={asCard}
                productMap={mapForCard}
                onEdit={(col) => setEditingCollection(c)}
                onOpenEditor={(col) => setEditorCollection(c)}
                onToggleArchive={(col) => toggleArchive(c.id)}
                onDelete={(col) => {
                  const ok = confirm(`Удалить коллекцию "${c.name}"?`)
                  if (ok) deleteCollection(c.id)
                }}
                onTogglePin={(col) => togglePin(c.id)}
                onQuickAddProduct={quickAddProductToCollection}
                onOpenProduct={(productId) => {
                  const full = productMap.get(productId)
                  if (full) {
                    setEditingProduct(full)
                    setProductTab('info')
                  }
                }}
              />
            )
          })
        )}
      </div>

      {/* Модалки: редактирование коллекции, редактирование товара, редактор DnD */}
      {editingCollection && (
        <CollectionModal
          value={editingCollection}
          /** Имена товаров коллекции — для AI описания */
          productNames={editingCollection.product_order.map((id) => productMap.get(id)?.name).filter(Boolean) as string[]}
          onClose={() => setEditingCollection(null)}
          onSubmit={(val) => {
            updateCollection(val.id, {
              name: val.name,
              description: val.description,
              group: val.group,
              cover_url: val.cover_url,
              pinned: val.pinned,
            })
            setEditingCollection(null)
          }}
        />
      )}

      {editingProduct && (
        <ProductModal
          value={editingProduct}
          initialTab={productTab}
          onClose={() => setEditingProduct(null)}
          onSubmit={(val) => {
            updateProduct(val.id, {
              name: val.name,
              article: val.article,
              imageKeyword: val.imageKeyword,
              tech_card: val.tech_card || [],
            })
            setEditingProduct(null)
          }}
          onDelete={() => {
            deleteProduct(editingProduct.id)
            setEditingProduct(null)
          }}
          onApplyTechCard={(tc) => {
            updateProduct(editingProduct.id, { tech_card: tc })
          }}
        />
      )}

      {editorCollection && (
        <DnDEditor
          collection={editorCollection}
          products={products}
          onClose={() => setEditorCollection(null)}
          onApply={(nextOrder) => {
            updateCollection(editorCollection.id, { product_order: nextOrder })
            logEvent({
              action: 'reorder',
              entity: 'collection',
              entityId: editorCollection.id,
              details: { order: nextOrder },
            })
            setEditorCollection(null)
          }}
          onAddProduct={() =>
            setEditingProduct({
              id: utils.id(),
              name: 'Новое изделие',
              article: `ART-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
              imageKeyword: 'furniture',
              tech_card: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
          onOpenProduct={(id) => {
            const p = products.find((x) => x.id === id)
            if (p) {
              setEditingProduct(p)
              setProductTab('tc')
            }
          }}
        />
      )}
    </div>
  )
}

/**
 * CollectionModal — модальное окно редактирования коллекции (добавлено поле cover_url)
 * Новое: кнопка AI для генерации описания.
 */
function CollectionModal({
  value,
  productNames,
  onClose,
  onSubmit,
}: {
  value: Collection
  /** Для AI описания — список наименований изделий в коллекции */
  productNames: string[]
  onClose: () => void
  onSubmit: (val: Collection) => void
}) {
  const [form, setForm] = useState<Collection>(value)
  /** Состояния AI */
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  /** Вызов AI для генерации описания коллекции */
  const doGenerateDescription = useCallback(async () => {
    setAiError(null)
    setAiLoading(true)
    try {
      const desc = await AiService.generateCollectionDescription({
        name: form.name || '',
        group: form.group || '',
        productNames: productNames || [],
      })
      setForm((prev) => ({ ...prev, description: desc }))
    } catch (e: any) {
      setAiError(e?.message || 'Не удалось получить описание')
    } finally {
      setAiLoading(false)
    }
  }, [form.name, form.group, productNames])

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-gray-900">Редактировать коллекцию</div>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Название</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Группа</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Например: 2025 Весна"
              value={form.group || ''}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
            />
          </div>

          {/* Новое поле: обложка коллекции */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Обложка (URL)</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/cover.jpg"
              value={form.cover_url || ''}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
            />
            {/* Превью для удобства */}
            <div className="mt-2 aspect-[16/5] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {form.cover_url ? (
                <ProgressiveImage
                  alt="Превью обложки"
                  src={form.cover_url}
                  className="w-full h-full"
                  imgClassName="object-cover w-full h-full"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <ProgressiveImage
                  alt="Превью обложки"
                  src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&q=80&w=1200"
                  webpSrc="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fm=webp&q=75&w=1200"
                  className="w-full h-full"
                  imgClassName="object-cover w-full h-full"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm text-gray-700 mb-1">Описание</label>
              <button
                type="button"
                onClick={doGenerateDescription}
                disabled={aiLoading}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${
                  aiLoading ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-300'
                }`}
                title="Сгенерировать описание (AI)"
              >
                <Wand2 size={14} />
                {aiLoading ? 'Генерация…' : 'Сгенерировать (AI)'}
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Краткое описание коллекции…"
            />
            {aiError && <div className="text-xs text-red-600 mt-1">{aiError}</div>}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={!!form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Закрепить коллекцию
          </label>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700" onClick={onClose}>
            Отмена
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onSubmit(form)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * ProductModal — полная модалка редактирования товара с вкладками и ТД
 * Новое: панель AI для подсказки технологической карты.
 */
function ProductModal({
  value,
  initialTab = 'info',
  onClose,
  onSubmit,
  onDelete,
  onApplyTechCard,
}: {
  value: Product
  initialTab?: 'info' | 'tc'
  onClose: () => void
  onSubmit: (val: Product) => void
  onDelete: () => void
  onApplyTechCard: (tc: TechCardItem[]) => void
}) {
  const [form, setForm] = useState<Product>(value)
  const [tab, setTab] = useState<'info' | 'tc'>(initialTab)

  /** Материалы для ТД */
  const materials = utils.read<Material[]>(LS_KEYS.materials, [])

  /** Состояния AI блока */
  const [aiBrief, setAiBrief] = useState<string>('')
  const [aiLoading, setAiLoading] = useState<boolean>(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResolved, setAiResolved] = useState<TechCardItem[]>([])
  const [aiUnresolved, setAiUnresolved] = useState<AiTechCardItem[]>([])

  /** Сопоставление AI-позиций с каталогом материалов */
  const resolveAiItemsToTechCard = useCallback((items: AiTechCardItem[], catalog: Material[]): { resolved: TechCardItem[]; unresolved: AiTechCardItem[] } => {
    const byArticle = new Map(catalog.map((m) => [String(m.article || '').trim().toLowerCase(), m]))
    const byName = new Map(catalog.map((m) => [String(m.name || '').trim().toLowerCase(), m]))

    const resolved: TechCardItem[] = []
    const unresolved: AiTechCardItem[] = []

    for (const it of items) {
      const articleKey = String(it.article || '').trim().toLowerCase()
      const nameKey = String(it.name || '').trim().toLowerCase()
      let matched: Material | undefined

      if (articleKey) {
        matched = byArticle.get(articleKey)
      }
      // Если не нашли по артикулу — пробуем по имени (строгое совпадение)
      if (!matched && nameKey) {
        matched = byName.get(nameKey)
      }
      // Доп: если нет строгого, пробуем "содержит" по имени (эвристика)
      if (!matched && nameKey) {
        matched = catalog.find((m) => String(m.name || '').trim().toLowerCase().includes(nameKey))
      }

      if (matched) {
        resolved.push({
          materialId: matched.id,
          quantity: Number(it.quantity) || 0,
          _techCardId: utils.id(),
        })
      } else {
        unresolved.push(it)
      }
    }

    return { resolved, unresolved }
  }, [])

  /** Вызов AI — предложить состав ТД */
  const doSuggestTechCard = useCallback(async () => {
    setAiError(null)
    setAiLoading(true)
    try {
      const catalog: MaterialsCatalogItem[] = materials.map((m) => ({
        name: m.name,
        article: m.article,
        unit: m.unit,
        price: m.price,
      }))

      const items = await AiService.suggestTechCard({
        productName: form.name || '',
        brief: aiBrief || '',
        typeName: '', // в этой модалке нет справочника типов — оставим пусто
        finishName: '', // аналогично
        materialsCatalog: catalog,
      })

      const { resolved, unresolved } = resolveAiItemsToTechCard(items, materials)
      setAiResolved(resolved)
      setAiUnresolved(unresolved)
    } catch (e: any) {
      setAiError(e?.message || 'Не удалось получить подсказки по ТД')
      setAiResolved([])
      setAiUnresolved([])
    } finally {
      setAiLoading(false)
    }
  }, [materials, form.name, aiBrief, resolveAiItemsToTechCard])

  /** Применить найденные позиции в текущую форму */
  const applyResolvedToForm = useCallback(() => {
    if (!aiResolved.length) return
    const base = Array.isArray(form.tech_card) ? form.tech_card : []
    // Сливаем с существующими (по materialId суммируем количество)
    const map = new Map<string, TechCardItem>()
    for (const it of base) map.set(it.materialId, it)
    for (const it of aiResolved) {
      const exist = map.get(it.materialId)
      if (exist) {
        map.set(it.materialId, { ...exist, quantity: (Number(exist.quantity) || 0) + (Number(it.quantity) || 0) })
      } else {
        map.set(it.materialId, it)
      }
    }
    const next = Array.from(map.values())
    setForm({ ...form, tech_card: next })
    // Очистим результаты AI, чтобы не дублировать повторно
    setAiResolved([])
    setAiUnresolved([])
  }, [aiResolved, form])

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-gray-900">{`Редактирование: ${form.name}`}</div>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Табы */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-2 -mb-px border-b-2 ${tab === 'info' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600'}`}
              onClick={() => setTab('info')}
            >
              Основная информация
            </button>
            <button
              className={`px-4 py-2 -mb-px border-b-2 ${tab === 'tc' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600'}`}
              onClick={() => setTab('tc')}
            >
              Технологическая карта
            </button>
          </div>

          {tab === 'info' ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.name.trim()) return alert('Укажите наименование')
                if (!form.article.trim()) return alert('Укажите артикул')
                onSubmit(form)
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
                  <input
                    name="article"
                    type="text"
                    value={form.article}
                    onChange={(e) => setForm({ ...form, article: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="PROD-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Наименование</label>
                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Тумба 600 Белая"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ключевое слово картинки</label>
                <input
                  name="imageKeyword"
                  type="text"
                  value={form.imageKeyword || ''}
                  onChange={(e) => setForm({ ...form, imageKeyword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: modern furniture"
                />
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white"
                  onClick={onDelete}
                >
                  <Trash2 size={16} className="inline mr-1" />
                  Удалить
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                    onClick={onClose}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Новое: AI помощь по ТД */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-blue-900 flex items-center gap-2">
                    <Sparkles size={16} />
                    AI помощь: подсказать состав ТД
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-5">
                    <textarea
                      value={aiBrief}
                      onChange={(e) => setAiBrief(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder='Краткое ТЗ (например: "тумба 600мм, фасады МДФ, 2 дверцы, петли clip-on")'
                    />
                  </div>
                  <div className="md:col-span-1 flex md:block">
                    <button
                      type="button"
                      onClick={doSuggestTechCard}
                      disabled={aiLoading}
                      className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${
                        aiLoading ? 'bg-blue-300 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                      title="Получить подсказку состава от AI"
                    >
                      {aiLoading ? 'Запрос…' : 'Предложить'}
                    </button>
                  </div>
                </div>

                {(aiError || aiResolved.length > 0 || aiUnresolved.length > 0) && (
                  <div className="mt-2 rounded-md border border-blue-200 bg-white p-2">
                    {aiError && <div className="text-sm text-red-600">{aiError}</div>}
                    {!aiError && (
                      <>
                        <div className="text-sm text-gray-800">
                          Найдено позиций в каталоге: <span className="font-semibold">{aiResolved.length}</span>
                          {aiResolved.length > 0 && (
                            <button
                              type="button"
                              onClick={applyResolvedToForm}
                              className="ml-2 inline-flex items-center gap-2 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              title="Добавить найденные позиции в текущую техкарту"
                            >
                              Добавить найденные
                            </button>
                          )}
                        </div>
                        {aiResolved.length > 0 && (
                          <ul className="mt-1 text-xs text-gray-700 list-disc list-inside">
                            {aiResolved.slice(0, 5).map((r) => (
                              <li key={r._techCardId}>{r.materialId} × {r.quantity}</li>
                            ))}
                            {aiResolved.length > 5 && <li>… и ещё {aiResolved.length - 5}</li>}
                          </ul>
                        )}
                        {aiUnresolved.length > 0 && (
                          <div className="mt-2">
                            <div className="text-sm text-gray-800">Не сопоставлено с каталогом: <span className="font-semibold">{aiUnresolved.length}</span></div>
                            <ul className="mt-1 text-xs text-gray-700 list-disc list-inside">
                              {aiUnresolved.slice(0, 5).map((u, idx) => (
                                <li key={`${u.article || u.name}-${idx}`}>{u.name}{u.article ? ` (${u.article})` : ''} × {u.quantity}</li>
                              ))}
                              {aiUnresolved.length > 5 && <li>… и ещё {aiUnresolved.length - 5}</li>}
                            </ul>
                            <div className="text-xs text-gray-500 mt-1">Добавьте отсутствующие материалы в разделе “Материалы”, чтобы в следующий раз всё сопоставилось автоматически.</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <TechCardManager
                materials={materials}
                value={form.tech_card || []}
                onChange={(tc) => setForm({ ...form, tech_card: tc })}
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                  onClick={() => onApplyTechCard(form.tech_card || [])}
                >
                  Сохранить ТД
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * DnDEditor — модалка редактора коллекции с перетаскиванием
 * Добавлено: фильтр по типу мебели для правой колонки "Доступные"
 * Новое: клик по карточке изделия открывает полную модалку товара (вкладка "ТД")
 */
function DnDEditor({
  collection,
  products,
  onClose,
  onApply,
  onAddProduct,
  onOpenProduct,
}: {
  collection: Collection
  products: Product[]
  onClose: () => void
  onApply: (order: string[]) => void
  onAddProduct: () => void
  /** Открыть модалку товара */
  onOpenProduct: (id: string) => void
}) {
  const [order, setOrder] = useState<string[]>(collection.product_order)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  /** Фильтр по типу мебели для правой колонки */
  const [kindFilter, setKindFilter] = useState<FurnitureKind | 'all'>('all')

  /** Изделия в коллекции */
  const inCollection = useMemo(
    () => order.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [order, products],
  )

  /** Все доступные (не в коллекции) */
  const availableAll = useMemo(() => products.filter((p) => !order.includes(p.id)), [order, products])

  /** Доступные с учётом фильтра типа */
  const available = useMemo(() => {
    if (kindFilter === 'all') return availableAll
    return availableAll.filter((p) => classifyProduct(p) === kindFilter)
  }, [availableAll, kindFilter])

  const onDragStart = useCallback((id: string) => setDraggingId(id), [])
  const onDragOverCard = useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const insertAt = (arr: string[], idx: number, val: string) => {
    const copy = arr.slice()
    copy.splice(idx, 0, val)
    return copy
  }

  const onDropOverItem = useCallback(
    (targetId: string) => {
      if (!draggingId || draggingId === targetId) return
      let next = order.slice().filter((id) => id !== draggingId)
      const targetIdx = next.indexOf(targetId)
      next = insertAt(next, targetIdx, draggingId)
      setOrder(next)
      setDraggingId(null)
      setOverId(null)
    },
    [draggingId, order],
  )

  const onDropToListEnd = useCallback(() => {
    if (!draggingId) return
    const next = order.filter((id) => id !== draggingId).concat(draggingId)
    setOrder(next)
    setDraggingId(null)
    setOverId(null)
  }, [draggingId, order])

  const removeFromCollection = useCallback((id: string) => {
    setOrder((prev) => prev.filter((x) => x !== id))
  }, [])

  /** Рендер бейджа типа */
  const KindBadge = ({ p }: { p: Product }) => {
    const kind = classifyProduct(p)
    const classes =
      kind === 'tumbas'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : kind === 'penals'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : kind === 'mirrors'
        ? 'bg-violet-50 text-violet-800 border-violet-200'
        : 'bg-gray-50 text-gray-700 border-gray-200'
    const label =
      kind === 'tumbas' ? 'Тумбы' : kind === 'penals' ? 'Пеналы' : kind === 'mirrors' ? 'Зеркала' : 'Прочее'
    return <span className={`text-[10px] px-2 py-0.5 rounded border ${classes}`}>{label}</span>
  }

  // Источники изображений для миниатюр в редакторе
  const THUMB_WEBP =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fm=webp&q=70&w=100&h=100&fit=crop&crop=faces,center'
  const THUMB_FALLBACK =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&q=75&w=100&h=100&fit=crop&crop=faces,center'

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            <GripVertical size={18} className="text-blue-600" />
            Редактор коллекции — {collection.name}
          </div>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-y-auto">
          {/* В коллекции */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50" onDragOver={onDragOverCard} onDrop={onDropToListEnd}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-800">В коллекции ({inCollection.length})</div>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {inCollection.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded-lg bg-white">
                  Перетащите изделия сюда из правой колонки
                </div>
              )}
              {inCollection.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart(p.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverId(p.id)
                  }}
                  onDragLeave={() => setOverId(null)}
                  onDrop={() => onDropOverItem(p.id)}
                  className={`bg-white border rounded-lg p-2 flex items-center gap-3 transition-all ${
                    overId === p.id ? 'border-blue-400 shadow-sm' : 'border-gray-200'
                  }`}
                  title="Перетащите, чтобы изменить порядок"
                >
                  <GripVertical size={16} className="text-gray-400 flex-shrink-0 cursor-move" />
                  <div
                    className="w-14 h-14 rounded bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProduct(p.id)
                    }}
                    role="button"
                    title="Открыть карточку товара"
                  >
                    <ProgressiveImage
                      alt={p.name}
                      src={THUMB_FALLBACK}
                      webpSrc={THUMB_WEBP}
                      className="w-full h-full"
                      imgClassName="object-cover w-full h-full"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProduct(p.id)
                    }}
                    title="Открыть карточку товара"
                  >
                    <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                      {p.name}
                      <KindBadge p={p} />
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{p.article}</div>
                  </div>
                  <button
                    className="px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm"
                    onClick={() => removeFromCollection(p.id)}
                    title="Убрать из коллекции"
                  >
                    Убрать
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Доступные */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-800">Доступные ({availableAll.length})</div>
              <button className="px-3 py-1.5 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700" onClick={onAddProduct}>
                <Plus size={14} className="inline mr-1" />
                Добавить изделие
              </button>
            </div>

            {/* Фильтр по типу мебели */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'Все'],
                  ['tumbas', 'Тумбы'],
                  ['penals', 'Пеналы'],
                  ['mirrors', 'Зеркала'],
                  ['other', 'Прочее'],
                ] as Array<[FurnitureKind | 'all', string]>
              ).map(([key, label]) => {
                const active = kindFilter === key
                return (
                  <button
                    key={key}
                    className={`px-2.5 py-1 text-xs rounded-full border ${
                      active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setKindFilter(key as FurnitureKind | 'all')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {available.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart(p.id)}
                  className="bg-white border border-gray-200 rounded-lg p-2 flex items-center gap-3 cursor-move hover:shadow-sm"
                  title="Перетащите в левую колонку"
                >
                  <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                  <div
                    className="w-12 h-12 rounded bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProduct(p.id)
                    }}
                    role="button"
                    title="Открыть карточку товара"
                  >
                    <ProgressiveImage
                      alt={p.name}
                      src={THUMB_FALLBACK}
                      webpSrc={THUMB_WEBP}
                      className="w-full h-full"
                      imgClassName="object-cover w-full h-full"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div
                    className="min-w-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProduct(p.id)
                    }}
                    title="Открыть карточку товара"
                  >
                    <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                      {p.name}
                      <KindBadge p={p} />
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{p.article}</div>
                  </div>
                </div>
              ))}
              {available.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded-lg bg-white col-span-full">
                  Нет изделий для выбранного типа
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700" onClick={onClose}>
            Отмена
          </button>
          <button className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onApply(order)}>
            Применить изменения
          </button>
        </div>
      </div>
    </div>
  )
}
