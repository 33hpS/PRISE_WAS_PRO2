/**
 * Страница «Материалы»
 * Функции:
 * - Просмотр, поиск, добавление, удаление материалов
 * - Импорт/экспорт CSV (UTF-8 с BOM)
 * - KGS как базовая валюта, форматирование через useLocaleFormat
 * - Тост‑уведомления на все ключевые действия
 */

import React, { memo, useCallback, useMemo, useState } from 'react'
import { Layers, Plus, Upload, Download, Search } from 'lucide-react'
import type { Material } from '../types/models'
import { useLocaleFormat } from '../hooks/useLocaleFormat'
import { toast } from 'sonner'

/**
 * Поддерживаемые ключи localStorage для чтения (совместимость со старыми версиями)
 */
const LS_READ_KEYS = ['wasser_materials', 'wasser_materials_data'] as const
/**
 * Ключ для записи материалов
 */
const LS_WRITE_KEY = 'wasser_materials'

/**
 * Безопасное чтение массива из localStorage
 */
function readArrayFromLS<T = unknown>(keys: readonly string[], fallback: T[]): T[] {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as T[]
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
  }
  return fallback
}

/**
 * Безопасная запись массива в localStorage
 */
function writeArrayToLS<T = unknown>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/**
 * Преобразование произвольной записи к Material (минимальная нормализация)
 */
function coerceMaterial(x: any): Material | null {
  if (!x || typeof x !== 'object') return null
  const id = String(x.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)))
  const name = String(x.name ?? '').trim()
  const article = String(x.article ?? '').trim()
  const unit = String(x.unit ?? 'шт')
  const price = Number(x.price ?? 0)
  const created_at = String(x.created_at ?? new Date().toISOString())
  const updated_at = String(x.updated_at ?? new Date().toISOString())
  if (!name) return null
  return { id, name, article, unit, price, created_at, updated_at }
}

/**
 * Парсинг CSV -> массив Material
 * Формат колонок: name,article,unit,price (простая CSV-логика с учётом кавычек)
 */
function parseCsvToMaterials(csv: string): Material[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const out: Material[] = []
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i]
    const cols = row
      .replace(/\uFEFF/g, '')
      .split(',')
      .map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim())

    if (cols.length === 1 && i === 0 && cols[0].toLowerCase().includes('name')) {
      // Учитываем, что первая строка может быть заголовком
      continue
    }

    const mat = coerceMaterial({
      name: cols[0] ?? '',
      article: cols[1] ?? '',
      unit: cols[2] ?? 'шт',
      price: cols[3] ?? 0,
    })
    if (mat) out.push(mat)
  }
  return out
}

/**
 * Экспорт массива Material в CSV (UTF-8 с BOM для кириллицы)
 */
function exportMaterialsCsv(items: Material[]): void {
  const header = ['name', 'article', 'unit', 'price']
  const rows = items.map((m) => [m.name, m.article, m.unit, String(m.price)])
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `materials_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Заголовок страницы «Материалы»
 */
const PageHeader = memo(function PageHeader(): React.ReactElement {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
          <Layers size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Материалы</h1>
          <div className="text-sm text-gray-600">База материалов: добавление, поиск, импорт/экспорт CSV</div>
        </div>
      </div>
    </div>
  )
})

/**
 * Панель действий: поиск + кнопки (импорт/экспорт/добавить)
 */
function ActionsBar({
  search,
  onSearch,
  onImport,
  onExport,
  onAdd,
}: {
  search: string
  onSearch: (v: string) => void
  onImport: (file: File) => void
  onExport: () => void
  onAdd: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск по названию или артикулу..."
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Поиск материалов"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.currentTarget.value = ''
            }}
            className="hidden"
            aria-label="Импорт CSV"
          />
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">
            <Upload size={16} />
            Импорт CSV
          </span>
        </label>

        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
          title="Экспорт в CSV"
          aria-label="Экспорт в CSV"
        >
          <Download size={16} />
          Экспорт
        </button>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700"
          title="Добавить материал"
          aria-label="Добавить материал"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>
    </div>
  )
}

/**
 * Карточка материала
 */
const MaterialCard = memo(function MaterialCard({
  item,
  onDelete,
}: {
  item: Material
  onDelete: (id: string) => void
}): React.ReactElement {
  const { formatCurrency } = useLocaleFormat('KGS')
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
          <div className="text-xs text-gray-500 font-mono">{item.article || '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-blue-600">{formatCurrency(item.price)}</div>
          <div className="text-[11px] text-gray-400">{item.unit || 'шт'}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
        <span>Создано: {new Date(item.created_at).toLocaleDateString('ru-RU')}</span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          title="Удалить материал"
          aria-label="Удалить материал"
        >
          Удалить
        </button>
      </div>
    </div>
  )
})

/**
 * Форма добавления материала (инлайн)
 */
function AddMaterialForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
}): React.ReactElement {
  const [name, setName] = useState('')
  const [article, setArticle] = useState('')
  const [unit, setUnit] = useState('шт')
  const [price, setPrice] = useState<number>(0)

  /** Отправка формы добавления нового материала */
  const submit = useCallback(() => {
    if (!name.trim()) {
      toast.error('Укажите название материала')
      return
    }
    onSubmit({
      name: name.trim(),
      article: article.trim(),
      unit: unit.trim() || 'шт',
      price: Number(price) || 0,
    } as any)
  }, [name, article, unit, price, onSubmit])

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Напр., ЛДСП Белый"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Артикул</label>
          <input
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Напр., LDSP-W"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Единица</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="шт, м²..."
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Цена (KGS)</label>
          <input
            type="number"
            step="0.01"
            value={Number.isFinite(price) ? price : 0}
            onChange={(e) => setPrice(parseFloat(e.target.value || '0'))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

/**
 * MaterialsPage — основной компонент страницы
 */
export default function MaterialsPage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  /** Начальная загрузка из localStorage с поддержкой нескольких ключей */
  const [items, setItems] = useState<Material[]>(() => {
    const raw = readArrayFromLS<any>(LS_READ_KEYS as unknown as string[], [])
    const normalized = raw.map(coerceMaterial).filter(Boolean) as Material[]
    return normalized
  })

  /** Отфильтрованный список материалов */
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return items
    return items.filter((m) => m.name.toLowerCase().includes(t) || m.article.toLowerCase().includes(t))
  }, [items, search])

  /** Сохранить текущее состояние в localStorage */
  const persist = useCallback(
    (next: Material[]) => {
      writeArrayToLS(LS_WRITE_KEY, next)
    },
    [],
  )

  /** Добавление нового материала */
  const addMaterial = useCallback(
    (payload: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => {
      const now = new Date().toISOString()
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36))
      const m: Material = {
        id,
        name: payload.name,
        article: payload.article,
        unit: payload.unit || 'шт',
        price: Number(payload.price) || 0,
        created_at: now,
        updated_at: now,
      }
      const next = [m, ...items]
      setItems(next)
      persist(next)
      setAdding(false)
      toast.success('Материал добавлен')
    },
    [items, persist],
  )

  /** Удаление материала */
  const removeMaterial = useCallback(
    (id: string) => {
      const target = items.find((x) => x.id === id)
      if (!target) return
      if (!window.confirm(`Удалить материал "${target.name}"?`)) return
      const next = items.filter((x) => x.id !== id)
      setItems(next)
      persist(next)
      toast.success('Материал удалён')
    },
    [items, persist],
  )

  /** Импорт CSV */
  const importCsv = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const imported = parseCsvToMaterials(text)
        if (imported.length === 0) {
          toast.warning('Не найдено валидных строк в CSV')
          return
        }
        // Мерж по артикулу: если есть совпадение — обновляем цену/единицу/название
        const mapByArticle = new Map(items.map((m) => [String(m.article || '').trim().toLowerCase(), m]))
        const merged: Material[] = [...items]
        let added = 0
        let updated = 0

        for (const it of imported) {
          const key = String(it.article || '').trim().toLowerCase()
          const existing = key ? mapByArticle.get(key) : undefined
          if (existing) {
            existing.name = it.name || existing.name
            existing.unit = it.unit || existing.unit
            existing.price = Number(it.price) || existing.price
            existing.updated_at = new Date().toISOString()
            updated += 1
          } else {
            const now = new Date().toISOString()
            merged.unshift({
              ...it,
              id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
              created_at: now,
              updated_at: now,
            })
            added += 1
          }
        }

        setItems(merged)
        persist(merged)
        toast.success(`Импорт завершён: добавлено ${added}, обновлено ${updated}`)
      } catch (e: any) {
        toast.error(`Ошибка импорта: ${e?.message || 'неизвестно'}`)
      }
    },
    [items, persist],
  )

  /** Экспорт CSV */
  const exportCsv = useCallback(() => {
    try {
      exportMaterialsCsv(items)
      toast.success('Экспортирован CSV-файл')
    } catch {
      toast.error('Не удалось экспортировать CSV')
    }
  }, [items])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Заголовок */}
      <PageHeader />

      {/* Панель действий */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <ActionsBar
          search={search}
          onSearch={setSearch}
          onImport={importCsv}
          onExport={exportCsv}
          onAdd={() => setAdding(true)}
        />
      </div>

      {/* Форма добавления */}
      {adding && (
        <AddMaterialForm
          onSubmit={addMaterial}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Список материалов */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-500">
            Материалы не найдены. Добавьте материал вручную или импортируйте CSV.
          </div>
        ) : (
          filtered.map((m) => <MaterialCard key={m.id} item={m} onDelete={removeMaterial} />)
        )}
      </div>
    </div>
  )
}
