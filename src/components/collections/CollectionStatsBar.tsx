/**
 * CollectionStatsBar — сводка по коллекциям и изделиям
 * Отображает три метрики: всего коллекций, всего изделий, архивных коллекций.
 */

import React from 'react'
import { Layers, FolderOpen, Archive } from 'lucide-react'

/**
 * Пропсы сводки
 */
export interface CollectionStatsBarProps {
  /** Количество коллекций */
  collectionsCount: number
  /** Количество всех изделий (уникальных) */
  productsCount: number
  /** Количество архивных коллекций */
  archivedCount: number
}

/**
 * Колода карточек статистики
 */
export default function CollectionStatsBar({
  collectionsCount,
  productsCount,
  archivedCount,
}: CollectionStatsBarProps): React.ReactElement {
  const items = [
    {
      icon: <FolderOpen size={18} className="text-blue-600" />,
      label: 'Коллекций',
      value: collectionsCount,
      ring: 'ring-blue-100',
      bg: 'bg-blue-50/60',
      text: 'text-blue-900',
    },
    {
      icon: <Layers size={18} className="text-emerald-600" />,
      label: 'Изделий',
      value: productsCount,
      ring: 'ring-emerald-100',
      bg: 'bg-emerald-50/60',
      text: 'text-emerald-900',
    },
    {
      icon: <Archive size={18} className="text-gray-600" />,
      label: 'Архивных',
      value: archivedCount,
      ring: 'ring-gray-100',
      bg: 'bg-gray-50/60',
      text: 'text-gray-900',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className={`flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 bg-white`}
        >
          <div className={`p-2 rounded-lg ${it.bg} ${it.ring}`}>{it.icon}</div>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">{it.label}</div>
            <div className={`text-lg font-semibold ${it.text}`}>{it.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
