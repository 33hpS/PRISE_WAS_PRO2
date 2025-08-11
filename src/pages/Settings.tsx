/**
 * Страница "Настройки" — Ценообразование
 * Управление типами изделий и типами отделки: наценки (%) и стоимость работ.
 * Хранение в localStorage по ключу "wasser_price_settings_data" (совместимо со страницей "Изделия").
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Check, Plus, Save, Trash2, RotateCcw } from 'lucide-react'
import type { FinishType, PriceSettings, PriceType } from '../types/models'
import NumericField from '../components/common/NumericField'

/**
 * Ключи localStorage
 */
const LS_KEYS = {
  price: 'wasser_price_settings_data',
} as const

/**
 * Безопасное чтение JSON из localStorage
 */
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Безопасная запись JSON в localStorage
 */
function writeLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* noop */
  }
}

/**
 * Значения по умолчанию для ценообразования
 */
function seedPrice(): PriceSettings {
  return {
    productTypes: [
      { id: 'pt1', name: 'Тумба с дверями', markup: 10, workCost: 1000 },
      { id: 'pt2', name: 'Тумба с ящиками', markup: 15, workCost: 1500 },
      { id: 'pt3', name: 'Пенал', markup: 20, workCost: 2000 },
    ],
    finishTypes: [
      { id: 'ft1', name: 'Крашеный', markup: 50 },
      { id: 'ft2', name: 'Пленочный', markup: 30 },
    ],
  }
}

/**
 * Утилита: короткий ID
 */
function rid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Валидация полей типов
 */
function sanitizeNumber(n: any, min: number, max?: number): number {
  const val = Number(n)
  if (Number.isNaN(val)) return min
  if (max != null) return Math.min(Math.max(val, min), max)
  return Math.max(val, min)
}

/**
 * Компонент: строка типа изделия
 */
function PriceTypeRow({
  item,
  onChange,
  onDelete,
}: {
  item: PriceType
  onChange: (patch: Partial<PriceType>) => void
  onDelete: () => void
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_48px] gap-3 items-center">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Название типа изделия"
        aria-label="Название типа изделия"
      />
      <NumericField
        value={item.markup}
        min={0}
        max={500}
        onValueChange={(n) => onChange({ markup: sanitizeNumber(n ?? 0, 0, 500) })}
        inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        ariaLabel="Наценка, %"
      />
      <NumericField
        value={item.workCost}
        min={0}
        onValueChange={(n) => onChange({ workCost: sanitizeNumber(n ?? 0, 0) })}
        inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        ariaLabel="Стоимость работ"
      />
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center justify-center h-10 rounded-lg border border-gray-300 text-red-600 hover:bg-red-50"
        title="Удалить тип изделия"
        aria-label="Удалить тип изделия"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

/**
 * Компонент: строка типа отделки
 */
function FinishTypeRow({
  item,
  onChange,
  onDelete,
}: {
  item: FinishType
  onChange: (patch: Partial<FinishType>) => void
  onDelete: () => void
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_48px] gap-3 items-center">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Название типа отделки"
        aria-label="Название типа отделки"
      />
      <NumericField
        value={item.markup}
        min={0}
        max={500}
        onValueChange={(n) => onChange({ markup: sanitizeNumber(n ?? 0, 0, 500) })}
        inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        ariaLabel="Наценка, %"
      />
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center justify-center h-10 rounded-lg border border-gray-300 text-red-600 hover:bg-red-50"
        title="Удалить тип отделки"
        aria-label="Удалить тип отделки"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

/**
 * Страница "Настройки" — Ценообразование
 */
export default function SettingsPage(): React.ReactElement {
  // Текущее состояние настроек (из LS или дефолты)
  const [settings, setSettings] = useState<PriceSettings>(() => readLS<PriceSettings>(LS_KEYS.price, seedPrice()))
  const [savedFlag, setSavedFlag] = useState(false)

  /** Добавить тип изделия */
  const addPriceType = useCallback(() => {
    const p: PriceType = { id: rid(), name: 'Новый тип', markup: 0, workCost: 0 }
    setSettings((prev) => ({ ...prev, productTypes: [...prev.productTypes, p] }))
  }, [])

  /** Добавить тип отделки */
  const addFinishType = useCallback(() => {
    const f: FinishType = { id: rid(), name: 'Новая отделка', markup: 0 }
    setSettings((prev) => ({ ...prev, finishTypes: [...prev.finishTypes, f] }))
  }, [])

  /** Обновить один тип изделия */
  const patchPriceType = useCallback((id: string, patch: Partial<PriceType>) => {
    setSettings((prev) => ({
      ...prev,
      productTypes: prev.productTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  /** Обновить один тип отделки */
  const patchFinishType = useCallback((id: string, patch: Partial<FinishType>) => {
    setSettings((prev) => ({
      ...prev,
      finishTypes: prev.finishTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  /** Удалить тип изделия */
  const removePriceType = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      productTypes: prev.productTypes.filter((t) => t.id !== id),
    }))
  }, [])

  /** Удалить тип отделки */
  const removeFinishType = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      finishTypes: prev.finishTypes.filter((t) => t.id !== id),
    }))
  }, [])

  /** Сохранить в localStorage */
  const saveAll = useCallback(() => {
    writeLS(LS_KEYS.price, settings)
    setSavedFlag(true)
    // Скрыть индикатор "сохранено" через 2 сек
    window.setTimeout(() => setSavedFlag(false), 2000)
  }, [settings])

  /** Сбросить к дефолтам */
  const resetDefaults = useCallback(() => {
    if (!window.confirm('Сбросить настройки ценообразования к значениям по умолчанию?')) return
    const def = seedPrice()
    setSettings(def)
    writeLS(LS_KEYS.price, def)
    setSavedFlag(true)
    window.setTimeout(() => setSavedFlag(false), 2000)
  }, [])

  /** Признак пустых списков */
  const isEmptyPT = useMemo(() => settings.productTypes.length === 0, [settings.productTypes])
  const isEmptyFT = useMemo(() => settings.finishTypes.length === 0, [settings.finishTypes])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ценообразование</h1>
          <p className="text-gray-600 mt-1">
            Управляйте типами изделий и отделки: наценки и стоимость работ используются в расчётах на страницах
            “Изделия” и “Прайс‑лист”.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            title="Сбросить к значениям по умолчанию"
          >
            <RotateCcw size={16} />
            Сбросить
          </button>
          <button
            type="button"
            onClick={saveAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            title="Сохранить настройки"
          >
            <Save size={16} />
            Сохранить
          </button>
        </div>
      </div>

      {savedFlag && (
        <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 inline-flex items-center gap-2">
          <Check size={16} />
          Настройки сохранены
        </div>
      )}

      {/* Типы изделий */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Типы изделий</h2>
            <p className="text-sm text-gray-600">
              Наценка в процентах применяется к сумме (материалы + работы) перед учётом отделки.
            </p>
          </div>
          <button
            type="button"
            onClick={addPriceType}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            title="Добавить тип изделия"
          >
            <Plus size={16} />
            Добавить тип
          </button>
        </div>

        <div className="space-y-3">
          {isEmptyPT ? (
            <div className="text-sm text-gray-600">Пока нет типов. Добавьте первый тип изделия.</div>
          ) : (
            settings.productTypes.map((t) => (
              <PriceTypeRow
                key={t.id}
                item={t}
                onChange={(patch) => patchPriceType(t.id, patch)}
                onDelete={() => removePriceType(t.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Типы отделки */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify_between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Типы отделки</h2>
            <p className="text-sm text-gray-600">
              Наценка в процентах применяется после наценки типа изделия.
            </p>
          </div>
          <button
            type="button"
            onClick={addFinishType}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            title="Добавить тип отделки"
          >
            <Plus size={16} />
            Добавить отделку
          </button>
        </div>

        <div className="space-y-3">
          {isEmptyFT ? (
            <div className="text-sm text-gray-600">Пока нет типов отделки. Добавьте первый тип отделки.</div>
          ) : (
            settings.finishTypes.map((t) => (
              <FinishTypeRow
                key={t.id}
                item={t}
                onChange={(patch) => patchFinishType(t.id, patch)}
                onDelete={() => removeFinishType(t.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={saveAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          title="Сохранить настройки"
        >
          <Save size={16} />
          Сохранить изменения
        </button>
      </div>
    </div>
  )
}
