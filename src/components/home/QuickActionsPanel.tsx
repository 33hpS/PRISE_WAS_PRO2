/**
 * QuickActionsPanel — панель быстрых действий с иконками и краткими подсказками.
 * Мобильные улучшения: min-height ≥44px для touch, focus-ring для a11y, чуть больше gap.
 */

import React from 'react'
import Card from '../common/Card'
import { Grid2X2, Package, Layers, FileSpreadsheet } from 'lucide-react'

/**
 * Описание одного действия
 */
export interface QuickAction {
  /** Заголовок */
  label: string
  /** Подсказка (маленький текст) */
  description?: string
  /** Цветовой акцент (Tailwind классы) */
  accentClass?: string
  /** Обработчик клика */
  onClick: () => void
  /** Иконка */
  icon: React.ReactNode
}

/**
 * Пропсы панели быстрых действий
 */
export interface QuickActionsPanelProps {
  /** Набор действий */
  items?: QuickAction[]
}

/**
 * QuickActionsPanel — компонент
 */
export default function QuickActionsPanel({ items }: QuickActionsPanelProps): React.ReactElement {
  const defaults: QuickAction[] = [
    {
      label: 'Коллекции',
      description: 'Управление витриной',
      icon: <Grid2X2 size={18} />,
      onClick: () => {},
      accentClass: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      label: 'Изделия',
      description: 'Каталог изделий',
      icon: <Package size={18} />,
      onClick: () => {},
      accentClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Материалы',
      description: 'Реестр материалов',
      icon: <Layers size={18} />,
      onClick: () => {},
      accentClass: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
      label: 'Прайс-лист',
      description: 'PDF/Excel',
      icon: <FileSpreadsheet size={18} />,
      onClick: () => {},
      accentClass: 'border-violet-200 bg-violet-50 text-violet-700',
    },
  ]

  const list = items && items.length ? items : defaults

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {list.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={it.onClick}
          className={`group text-left p-4 rounded-xl border ${it.accentClass} hover:shadow-sm transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500`}
          title={it.label}
          aria-label={it.label}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              {it.icon}
              {it.label}
            </span>
          </div>
          {it.description && <div className="text-xs opacity-80 mt-1 text-gray-700">{it.description}</div>}
        </button>
      ))}
    </div>
  )
}
