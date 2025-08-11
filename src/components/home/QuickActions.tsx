/**
 * QuickActions — быстрые действия на главной странице
 * Мобильные улучшения: min-height ≥44px, focus-ring, увеличенный gap.
 */

import React, { memo } from 'react'

/**
 * QuickActionItem — описание одного быстрого действия
 */
export interface QuickActionItem {
  /** Заголовок действия */
  label: string
  /** Иконка (lucide-react) */
  icon: React.ReactNode
  /** Обработчик клика */
  onClick: () => void
  /** Цветовой акцент (tailwind класс), опционально */
  accentClass?: string
  /** Подсказка в title */
  title?: string
}

/**
 * Пропсы компонента QuickActions
 */
export interface QuickActionsProps {
  /** Набор быстрых действий */
  items: QuickActionItem[]
}

/**
 * QuickActions — сетка быстрых действий
 */
const QuickActions = memo(function QuickActions({ items }: QuickActionsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it, idx) => (
        <button
          key={idx}
          type="button"
          onClick={it.onClick}
          title={it.title || it.label}
          className={`group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500`}
          aria-label={it.title || it.label}
        >
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${it.accentClass || 'bg-blue-50 border-blue-100 text-blue-700'}`}
          >
            {it.icon}
          </span>
          <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">{it.label}</span>
        </button>
      ))}
    </div>
  )
})

export default QuickActions
