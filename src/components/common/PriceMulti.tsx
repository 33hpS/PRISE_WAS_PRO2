/**
 * PriceMulti — вывод суммы в базовой валюте и дублей в выбранных иностранных валютах.
 * Использует конфигурацию из services/currency и хук useLocaleFormat для корректного форматирования.
 */

import React from 'react'
import { useCurrencyConfig, convertToExtras } from '../../services/currency'
import { useLocaleFormat } from '../../hooks/useLocaleFormat'

/**
 * Пропсы PriceMulti
 */
export interface PriceMultiProps {
  /** Сумма в базовой валюте (из расчётов) */
  amountBase: number
  /** Класс контейнера */
  className?: string
  /** Точность для форматирования базовой суммы (по умолчанию 2) */
  precision?: number
  /** Показать подпись к дублям (например, "≈") */
  showLabel?: boolean
}

/**
 * Компонент мультивалютного вывода цены
 */
export default function PriceMulti(props: PriceMultiProps): React.ReactElement {
  const { amountBase, className, precision = 2, showLabel = false } = props
  const cfg = useCurrencyConfig()
  const { formatCurrency } = useLocaleFormat(cfg.base || 'KGS')

  const extras = convertToExtras(amountBase || 0, cfg)

  return (
    <div className={['flex flex-wrap items-center gap-1', className || ''].join(' ')}>
      <span className="font-bold text-blue-600">
        {formatCurrency(Number(amountBase || 0), cfg.base, { minimumFractionDigits: precision, maximumFractionDigits: precision })}
      </span>
      {extras.length > 0 && (
        <>
          {showLabel && <span className="text-xs text-gray-500 mx-1">≈</span>}
          {extras.map((e) => (
            <span
              key={e.code}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-700"
              title={`Курс: 1 ${cfg.base} = ${cfg.rates?.[e.code] ?? 0} ${e.code}`}
            >
              {formatCurrency(e.amount, e.code, { minimumFractionDigits: precision, maximumFractionDigits: precision })}
            </span>
          ))}
        </>
      )}
    </div>
  )
}
