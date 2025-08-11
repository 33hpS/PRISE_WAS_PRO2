/**
 * NumericField — универсальное числовое поле с "draft → commit" стратегией.
 * Во время ввода позволяет оставлять пустую строку и не проставляет 0 автоматически.
 * Коммит значения происходит по blur или Enter. Escape — откат к последнему коммиту.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Пропсы компонента NumericField
 */
export interface NumericFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** Текущее числовое значение (коммиченное) */
  value: number | null | undefined
  /** Коммит нового значения (по blur или Enter). null означает "пусто" */
  onValueChange: (next: number | null) => void
  /** Мин/Макс ограничения (опционально) */
  min?: number
  max?: number
  /** Разрешить отрицательные значения (по умолчанию false) */
  allowNegative?: boolean
  /** Класс инпута (чтобы не конфликтовать с обёрткой) */
  inputClassName?: string
  /** ARIA label */
  ariaLabel?: string
}

/**
 * Утилита: нормализация черновой строки к числу с учётом ограничений
 */
function normalizeToNumber(
  raw: string,
  opts: { min?: number; max?: number; allowNegative?: boolean },
): number | null {
  const s = (raw ?? '').trim()
  if (s === '') return null
  // Заменяем запятую на точку, убираем пробелы
  const cleaned = s.replace(',', '.')
  // Разрешаем цифры, один минус (в начале) и одну точку
  const valid = cleaned.replace(/[^0-9\.\-]/g, '')
  // Запрещаем множественные минусы, минус не в начале
  const fixedMinus = valid.replace(/(?!^)-/g, '')
  // Запрещаем более одной точки
  const parts = fixedMinus.split('.')
  const fixedDot = parts.length > 2 ? parts.slice(0, 2).join('.') : fixedMinus

  let n = Number(fixedDot)
  if (Number.isNaN(n)) return null
  if (!opts.allowNegative && n < 0) n = 0
  if (opts.min != null && n < opts.min) n = opts.min
  if (opts.max != null && n > opts.max) n = opts.max
  return n
}

/**
 * Компонент NumericField
 */
export default function NumericField({
  value,
  onValueChange,
  min,
  max,
  allowNegative = false,
  inputClassName,
  ariaLabel,
  onBlur,
  onKeyDown,
  ...rest
}: NumericFieldProps): React.ReactElement {
  const committed = useMemo(() => (typeof value === 'number' ? String(value) : ''), [value])
  const [draft, setDraft] = useState<string>(committed)
  const lastCommittedRef = useRef<string>(committed)

  // Синхронизируем черновик при внешнем изменении value
  useEffect(() => {
    setDraft(committed)
    lastCommittedRef.current = committed
  }, [committed])

  /** Обработчик коммита (blur / Enter) */
  const commit = useCallback(() => {
    const n = normalizeToNumber(draft, { min, max, allowNegative })
    onValueChange(n)
    // Обновим отображение нормализованным значением (или пустой строкой)
    setDraft(typeof n === 'number' ? String(n) : '')
    lastCommittedRef.current = typeof n === 'number' ? String(n) : ''
  }, [draft, min, max, allowNegative, onValueChange])

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      {...rest}
      className={inputClassName ?? rest.className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          // Откат к последнему коммиту
          const prev = lastCommittedRef.current
          setDraft(prev)
        }
        onKeyDown?.(e)
      }}
    />
  )
}
