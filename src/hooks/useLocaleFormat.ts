/**
 * useLocaleFormat — универсальное форматирование чисел/дат/валют по текущему языку i18n
 */

import { useMemo } from 'react'
import i18n from '../i18n'

/** Соответствие языка i18n -> системная локаль */
function langToLocale(lang: string): string {
  const l = (lang || 'ru').toLowerCase()
  if (l.startsWith('ky')) return 'ky-KG'
  if (l.startsWith('en')) return 'en-US'
  return 'ru-RU'
}

/**
 * Хук форматирования
 * @param defaultCurrency Валюта по умолчанию (например, 'KGS')
 */
export function useLocaleFormat(defaultCurrency: string = 'KGS') {
  const locale = useMemo(() => langToLocale(i18n.language || 'ru'), [i18n.language])

  /** Формат числа без валюты */
  const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(locale, opts).format(n ?? 0)
    } catch {
      return String(n ?? 0)
    }
  }

  /** Формат валюты */
  const formatCurrency = (amount: number, currency: string = defaultCurrency, opts?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        ...opts,
      }).format(amount ?? 0)
    } catch {
      // Фолбэк без локали
      return `${(amount ?? 0).toFixed(2)} ${currency}`
    }
  }

  /** Формат даты */
  const formatDate = (d: string | Date, opts?: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...opts,
      }).format(new Date(d))
    } catch {
      return new Date(d).toLocaleDateString()
    }
  }

  return { locale, formatNumber, formatCurrency, formatDate }
}
