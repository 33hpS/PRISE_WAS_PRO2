/**
 * CollectionCard — карточка одной коллекции
 * Включает: обложку коллекции, заголовок, группа/архив/закреп, краткое описание, превью товаров,
 * быстрые действия, фильтр по типам мебели (Тумбы/Пеналы/Зеркала/Прочее) для быстрого добавления.
 * Дополнено: клик по товару открывает карточку товара (через onOpenProduct).
 */

import React, { useMemo, useState } from 'react'
import { FolderOpen, Archive, ArchiveRestore, Edit2, GripVertical, Trash2, Star, StarOff, Plus } from 'lucide-react'
import ProgressiveImage from '../common/ProgressiveImage'

/**
 * Мини-интерфейсы для изоляции компонента
 */
export interface IProduct {
  id: string
  name: string
  article: string
  imageKeyword?: string
}

/**
 * Интерфейс коллекции (локальный для карточки)
 */
export interface ICollection {
  id: string
  name: string
  description?: string
  group?: string
  is_archived?: boolean
  pinned?: boolean
  product_order: string[]
  /** URL обложки коллекции (опционально) */
  cover_url?: string
  updated_at: string
}

/**
 * Пропсы карточки коллекции
 */
export interface CollectionCardProps {
  /** Данные коллекции */
  collection: ICollection
  /** Отображение максимум N превью товаров */
  previewLimit?: number
  /** Map для получения данных изделия по id */
  productMap: Map<string, IProduct>
  /** Обработчики действий */
  onEdit: (c: ICollection) => void
  onOpenEditor: (c: ICollection) => void
  onToggleArchive: (c: ICollection) => void
  onDelete: (c: ICollection) => void
  onTogglePin: (c: ICollection) => void
  onQuickAddProduct: (collectionId: string, productId: string) => void
  /** Открыть карточку товара по клику по превью */
  onOpenProduct: (productId: string) => void
}

/** Типы мебели для фильтра в карточке */
type FurnitureKind = 'tumbas' | 'penals' | 'mirrors' | 'other' | 'all'

/**
 * Классификация изделия по эвристикам (название/артикул)
 */
function classifyProduct(p: { name: string; article: string }): Exclude<FurnitureKind, 'all'> {
  const n = (p.name || '').toLowerCase()
  const a = (p.article || '').toLowerCase()
  if (n.includes('тумб') || a.includes('tumb') || a.includes('tb-')) return 'tumbas'
  if (n.includes('пенал') || a.includes('penal')) return 'penals'
  if (n.includes('зеркал') || a.includes('mir')) return 'mirrors'
  return 'other'
}

/**
 * Маленький бейдж с типом изделия
 */
function KindBadge({ product }: { product: IProduct }) {
  const kind = classifyProduct(product)
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

/**
 * Компонент карточки коллекции с обложкой и быстрыми действиями
 */
export default function CollectionCard({
  collection,
  previewLimit = 6,
  productMap,
  onEdit,
  onOpenEditor,
  onToggleArchive,
  onDelete,
  onTogglePin,
  onQuickAddProduct,
  onOpenProduct,
}: CollectionCardProps): React.ReactElement {
  const count = collection.product_order.length

  // Список изделий в коллекции (для превью)
  const inCollection = useMemo(
    () => collection.product_order.map((id) => productMap.get(id)).filter(Boolean) as IProduct[],
    [collection.product_order, productMap],
  )

  // Доступные изделия (не в коллекции) — для быстрого добавления
  const availableAll = useMemo(() => {
    const all = Array.from(productMap.values())
    const set = new Set(collection.product_order)
    return all.filter((p) => !set.has(p.id))
  }, [collection.product_order, productMap])

  /** Локальный фильтр по типу для быстрого добавления */
  const [typeFilter, setTypeFilter] = useState<FurnitureKind>('all')

  /** Доступные с учётом фильтра */
  const available = useMemo(() => {
    if (typeFilter === 'all') return availableAll
    return availableAll.filter((p) => classifyProduct(p) === typeFilter)
  }, [availableAll, typeFilter])

  const [selectedProduct, setSelectedProduct] = useState<string>('')

  // Дефолтные источники изображений (с WebP) для обложки и превью
  const COVER_WEBP =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fm=webp&q=75&w=1600'
  const COVER_FALLBACK =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&q=80&w=1600'
  const PREVIEW_WEBP =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fm=webp&q=70&w=160&h=160&fit=crop&crop=faces,center'
  const PREVIEW_FALLBACK =
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&q=75&w=160&h=160&fit=crop&crop=faces,center'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Обложка коллекции */}
      <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 aspect-[16/5] bg-gray-100">
        {collection.cover_url ? (
          <ProgressiveImage
            alt={collection.name}
            src={collection.cover_url}
            className="w-full h-full"
            imgClassName="object-cover w-full h-full"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ProgressiveImage
            alt={collection.name}
            src={COVER_FALLBACK}
            webpSrc={COVER_WEBP}
            className="w-full h-full"
            imgClassName="object-cover w-full h-full"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

      {/* Шапка коллекции */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <FolderOpen size={22} className="text-blue-600 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{collection.name}</h3>

              {collection.group && (
                <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {collection.group}
                </span>
              )}

              {collection.is_archived && (
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  Архив
                </span>
              )}

              {collection.pinned && (
                <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Закреплено
                </span>
              )}
            </div>

            {collection.description && <p className="text-gray-600 mt-1">{collection.description}</p>}

            <div className="text-xs text-gray-500 mt-1">
              Обновлено:{' '}
              {new Date(collection.updated_at).toLocaleString('ru-RU', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              • Товаров: {count}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={() => onEdit(collection)}
            title="Редактировать"
          >
            <Edit2 size={16} className="inline mr-1" />
            Редактировать
          </button>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={() => onOpenEditor(collection)}
            title="Редактор (DnD)"
          >
            <GripVertical size={16} className="inline mr-1" />
            Редактор
          </button>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={() => onTogglePin(collection)}
            title={collection.pinned ? 'Снять закрепление' : 'Закрепить'}
          >
            {collection.pinned ? (
              <Star size={16} className="inline mr-1 text-amber-500" />
            ) : (
              <StarOff size={16} className="inline mr-1" />
            )}
            {collection.pinned ? 'Открепить' : 'Закрепить'}
          </button>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={() => onToggleArchive(collection)}
            title={collection.is_archived ? 'Разархивировать' : 'Архивировать'}
          >
            {collection.is_archived ? (
              <>
                <ArchiveRestore size={16} className="inline mr-1" /> Разархив
              </>
            ) : (
              <>
                <Archive size={16} className="inline mr-1" /> Архив
              </>
            )}
          </button>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onDelete(collection)}
            title="Удалить"
          >
            <Trash2 size={16} className="inline mr-1" />
            Удалить
          </button>
        </div>
      </div>

      {/* Превью товаров */}
      {count > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {inCollection.slice(0, previewLimit).map((p) => (
            <div
              key={p.id}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              onClick={() => onOpenProduct(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenProduct(p.id)
                }
              }}
              title="Открыть карточку товара"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-white overflow-hidden border border-gray-200 flex-shrink-0">
                  <ProgressiveImage
                    alt={p.name}
                    src={PREVIEW_FALLBACK}
                    webpSrc={PREVIEW_WEBP}
                    className="w-full h-full"
                    imgClassName="object-cover w-full h-full"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                    {p.name}
                    <KindBadge product={p} />
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{p.article}</div>
                </div>
              </div>
            </div>
          ))}
          {count > previewLimit && (
            <div className="flex items-center justify-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
              и ещё {count - previewLimit}…
            </div>
          )}
        </div>
      )}

      {/* Быстрое добавление изделия */}
      <div className="mt-4 space-y-2">
        {/* Фильтр по типу */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              ['all', 'Все'],
              ['tumbas', 'Тумбы'],
              ['penals', 'Пеналы'],
              ['mirrors', 'Зеркала'],
              ['other', 'Прочее'],
            ] as Array<[FurnitureKind, string]>
          ).map(([key, label]) => {
            const active = typeFilter === key
            return (
              <button
                key={key}
                className={`px-2.5 py-1 text-xs rounded-full border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setTypeFilter(key)}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">Добавить изделие…</option>
            {available.slice(0, 100).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.article})
              </option>
            ))}
          </select>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            disabled={!selectedProduct}
            onClick={() => {
              if (!selectedProduct) return
              onQuickAddProduct(collection.id, selectedProduct)
              setSelectedProduct('')
            }}
            title="Добавить выбранное изделие в эту коллекцию"
          >
            <Plus size={16} className="inline mr-1" />
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
