/**
 * CurrencyRatesCard — карточка с курсами валют к KGS (сом).
 * Источники: open.er-api.com (основной), exchangerate.host (резерв).
 * Кэширование в localStorage на 3 часа для снижения нагрузки на API.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Card from '../common/Card'
import { DollarSign, Euro, Banknote, RefreshCw, Coins, JapaneseYen } from 'lucide-react'

/** Состояние загрузки курсов */
interface RatesState {
  USDKGS?: number
  EURKGS?: number
  CNYKGS?: number
  RUBKGS?: number
  KZTKGS?: number
  updatedAt?: number
  loading: boolean
  error?: string
}

/** Ключ кэша в LS */
const LS_KEY = 'wasser_rates_kgs'
/** TTL кэша (мс) — 3 часа */
const CACHE_TTL = 3 * 60 * 60 * 1000

/** Форматирование числа */
function fmt(n?: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—'
  return n.toFixed(2)
}

/** Попытка получить курс base→KGS из open.er-api, затем exchangerate.host */
async function fetchToKGS(base: 'USD' | 'EUR' | 'RUB' | 'CNY' | 'KZT'): Promise<number | null> {
  try {
    const r1 = await fetch(`https://open.er-api.com/v6/latest/${base}`, { cache: 'no-store' })
    if (r1.ok) {
      const j = await r1.json()
      const v = j?.rates?.KGS
      if (typeof v === 'number') return v
    }
  } catch {
    /* noop */
  }
  try {
    const r2 = await fetch(`https://api.exchangerate.host/latest?base=${base}&symbols=KGS`, { cache: 'no-store' })
    if (r2.ok) {
      const j = await r2.json()
      const v = j?.rates?.KGS
      if (typeof v === 'number') return v
    }
  } catch {
    /* noop */
  }
  return null
}

/** Прочитать кэш из LS */
function readCache(): RatesState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as RatesState
    if (data.updatedAt && Date.now() - data.updatedAt < CACHE_TTL) return data
  } catch {
    /* noop */
  }
  return null
}

/** Сохранить кэш в LS */
function writeCache(state: RatesState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* noop */
  }
}

/** Компонент карточки курсов */
export default function CurrencyRatesCard(): React.ReactElement {
  const [state, setState] = useState<RatesState>({ loading: true })

  /** Загрузка данных (параллельно) */
  async function load() {
    setState((s) => ({ ...s, loading: true, error: undefined }))
    try {
      const [usd, eur, cny, rub, kzt] = await Promise.all([
        fetchToKGS('USD'),
        fetchToKGS('EUR'),
        fetchToKGS('CNY'),
        fetchToKGS('RUB'),
        fetchToKGS('KZT'),
      ])
      if (!usd && !eur && !cny && !rub && !kzt) throw new Error('Не удалось получить курсы')

      const next: RatesState = {
        USDKGS: usd ?? undefined,
        EURKGS: eur ?? undefined,
        CNYKGS: cny ?? undefined,
        RUBKGS: rub ?? undefined,
        KZTKGS: kzt ?? undefined,
        updatedAt: Date.now(),
        loading: false,
      }
      setState(next)
      writeCache(next)
    } catch (e: any) {
      setState({ loading: false, error: e?.message || 'Ошибка загрузки курсов' })
    }
  }

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setState({ ...cached, loading: false })
    } else {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updated = useMemo(
    () => (state.updatedAt ? new Date(state.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    [state.updatedAt],
  )

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">Курсы валют</div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          title="Обновить"
          aria-label="Обновить"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {state.loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
        </div>
      ) : state.error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{state.error}</div>
      ) : (
        <ul className="divide-y divide-gray-200 text-sm">
          <li className="py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-gray-700">
              <DollarSign size={16} className="text-blue-600" />
              USD
            </span>
            <span className="font-semibold text-gray-900">{fmt(state.USDKGS)} KGS</span>
          </li>
          <li className="py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-gray-700">
              <Euro size={16} className="text-emerald-600" />
              EUR
            </span>
            <span className="font-semibold text-gray-900">{fmt(state.EURKGS)} KGS</span>
          </li>
          <li className="py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-gray-700">
              <JapaneseYen size={16} className="text-rose-600" />
              CNY
            </span>
            <span className="font-semibold text-gray-900">{fmt(state.CNYKGS)} KGS</span>
          </li>
          <li className="py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-gray-700">
              <Banknote size={16} className="text-violet-600" />
              RUB
            </span>
            <span className="font-semibold text-gray-900">{fmt(state.RUBKGS)} KGS</span>
          </li>
          <li className="py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-gray-700">
              <Coins size={16} className="text-indigo-600" />
              KZT
            </span>
            <span className="font-semibold text-gray-900">{fmt(state.KZTKGS)} KGS</span>
          </li>
        </ul>
      )}
      <div className="mt-2 text-xs text-gray-500">Обновлено: {updated}</div>
    </Card>
  )
}
