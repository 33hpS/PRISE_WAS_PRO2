/**
 * PinnedCollectionsPanel — виджет закреплённых коллекций
 * Показывает карточки с краткой информацией и миниатюрами изделий (Smart Placeholder Image).
 * Мобильные улучшения: progressive image loading и фокус‑стейты.
 */

import React from 'react'
import Card from '../common/Card'
import { Star, Package, Calendar, ChevronRight } from 'lucide-react'
import type { SimpleCollection, SimpleProduct } from '../../services/storage'
import ProgressiveImage from '../common/ProgressiveImage'

/**
 * Пропсы виджета
 */
export interface PinnedCollectionsPanelProps {
  /** Коллекции */
  collections: SimpleCollection[]
  /** Словарь товаров по id */
  productMap: Map<string, SimpleProduct>
  /** Переход ко всем коллекциям */
  onOpenCollections: () => void
}

/**
 * PinnedCollectionsPanel — основной компонент
 */
export default function PinnedCollectionsPanel({
  collections,
  productMap,
  onOpenCollections,
}: PinnedCollectionsPanelProps): React.ReactElement | null {
  if (!collections.length) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Star size={18} className="text-amber-500" />
          Закреплённые коллекции
        </h2>
        <button
          type="button"
          onClick={onOpenCollections}
          className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Открыть все коллекции"
          aria-label="Открыть все коллекции"
        >
          Все коллекции
          <ChevronRight size={14} className="inline ml-1" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {collections.map((c) => {
          const items = c.product_order.map((id) => productMap.get(id)).filter(Boolean) as SimpleProduct[]
          return (
            <Card key={c.id} className="p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{c.name}</div>
                  {c.group && (
                    <div className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {c.group}
                    </div>
                  )}
                  {c.description && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{c.description}</div>}
                </div>
                <Star size={16} className="text-amber-500 flex-shrink-0" />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <Package size={14} />
                  {c.product_order.length} изделий
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(c.updated_at).toLocaleDateString('ru-RU')}
                </span>
              </div>

              {items.length > 0 && (
                <div className="mt-3 flex -space-x-2">
                  {items.slice(0, 4).map((p) => (
                    <div key={p.id} className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-gray-50" title={p.name}>
                      <ProgressiveImage
                        alt={p.name}
                        // Плейсхолдер с WebP + fallback
                        webpSrc="https://placehold.co/64x64.webp?text=%20"
                        src="https://placehold.co/64x64.jpg?text=%20"
                        className="w-full h-full"
                        imgClassName="object-cover w-full h-full"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="w-8 h-8 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-xs text-gray-500">
                      +{items.length - 4}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
