/**
 * currency.ts — централизованные настройки валют и конвертация
 * Хранение конфигурации в localStorage, чтение/запись, хук и утилиты.
 */

import { useEffect, useState } from 'react'

/**
 * Конфигурация валют
 * base — базовая валюта (по умолчанию KGS)
 * extras — дополнительные валюты для дубляжа вывода
 * rates — курсы вида: 1 base = rates[EXTRA] EXTRA
 * locale — опционально принудительная локаль форматирования
 */
export interface CurrencyConfig {
  base: string
  extras: string[]
  rates: Record<string, number>
  locale?: string
}

/** Ключ localStorage для настроек валют */
export const CURRENCY_LS_KEY = 'wasser_currency_config_v1'

/**
 * Значения по умолчанию: KGS как база, несколько частых валют без курса
 * Пользователь может ввести курс вручную в панели настроек.
 */
export function defaultCurrencyConfig(): CurrencyConfig {
  return {
    base: 'KGS',
    extras: ['USD', 'EUR', 'RUB'],
    rates: {
      USD: 0,
      EUR: 0,
      RUB: 0,
    },
    locale: undefined,
  }
}

/**
 * Безопасное чтение конфигурации валют
 */
export function readCurrencyConfig(): CurrencyConfig {
  try {
    const raw = localStorage.getItem(CURRENCY_LS_KEY)
    if (!raw) return defaultCurrencyConfig()
    const parsed = JSON.parse(raw) as CurrencyConfig
    // Нормализация
    return {
      base: parsed.base || 'KGS',
      extras: Array.isArray(parsed.extras) ? parsed.extras : [],
      rates: typeof parsed.rates === 'object' && parsed.rates ? parsed.rates : {},
      locale: parsed.locale,
    }
  } catch {
    return defaultCurrencyConfig()
  }
}

/**
 * Безопасная запись конфигурации валют
 */
export function saveCurrencyConfig(cfg: CurrencyConfig): void {
  try {
    localStorage.setItem(CURRENCY_LS_KEY, JSON.stringify(cfg))
    // Cобытие для других вкладок
    window.dispatchEvent(new StorageEvent('storage', { key: CURRENCY_LS_KEY, newValue: JSON.stringify(cfg) } as any))
  } catch {
    /* noop */
  }
}

/**
 * Конвертация суммы из базовой валюты в выбранные дополнительные
 * Возвращает массив пар [код валюты, сумма]
 */
export function convertToExtras(amountBase: number, cfg: CurrencyConfig): Array<{ code: string; amount: number }> {
  const list: Array<{ code: string; amount: number }> = []
  for (const code of cfg.extras) {
    const rate = Number(cfg.rates?.[code] ?? 0)
    if (rate && rate > 0) list.push({ code, amount: amountBase * rate })
  }
  return list
}

/**
 * Хук — реактивное чтение конфигурации с автообновлением при изменениях
 */
export function useCurrencyConfig(): CurrencyConfig {
  const [cfg, setCfg] = useState<CurrencyConfig>(() => readCurrencyConfig())
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CURRENCY_LS_KEY) setCfg(readCurrencyConfig())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return cfg
}
