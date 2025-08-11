/**
 * Технологическая карта (ТД) — редактор состава изделия
 * Функции: добавление материалов, изменение количества, удаление, импорт из Excel, расчет сумм
 * Обновлено:
 * - Формат валюты: KGS
 * - Тосты для импорта/ошибок вместо alert
 * - draft-ввод количества (без изменений логики)
 */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { Material, TechCardItem } from '../../types/models'
import Card from '../common/Card'
import Button from '../common/Button'
import NumericField from '../common/NumericField'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useLocaleFormat } from '../../hooks/useLocaleFormat'

/**
 * Пропсы TechCardManager
 */
export interface TechCardManagerProps {
  /** Доступные материалы */
  materials: Material[]
  /** Значение техкарты */
  value: TechCardItem[]
  /** Изменение техкарты */
  onChange: (next: TechCardItem[]) => void
}

/**
 * Создание локального ID строки
 */
function rid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Импорт из Excel (A: артикул, B: количество)
 */
async function parseTechCardExcel(buffer: ArrayBuffer, materials: Material[]): Promise<TechCardItem[]> {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
  if (!rows || rows.length === 0) return []

  const mapByArticle = new Map(materials.map((m) => [String(m.article || '').trim().toLowerCase(), m.id]))

  const result: TechCardItem[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    const article = String(row[0] ?? '').trim().toLowerCase()
    const qty = Number(row[1] ?? 0)
    if (!article || !qty || qty <= 0) continue
    const materialId = mapByArticle.get(article)
    if (!materialId) continue
    result.push({ materialId, quantity: qty, _techCardId: rid() })
  }
  return result
}

/**
 * TechCardManager — редактор техкарты
 */
const TechCardManager = memo(function TechCardManager({
  materials,
  value,
  onChange,
}: TechCardManagerProps): React.ReactElement {
  const [selected, setSelected] = useState<string>('')
  const [qty, setQty] = useState<number>(1)
  const [importing, setImporting] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /** Локальные драфты количеств */
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({})

  /** Мапа материалов для быстрого доступа */
  const matMap = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  /** Отсортированные материалы (по имени) */
  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [materials],
  )

  /** Форматтер валюты (база KGS) */
  const { formatCurrency } = useLocaleFormat('KGS')

  /** Состав с подробностями */
  const rows = useMemo(() => {
    return (value || [])
      .map((it) => {
        const m = matMap.get(it.materialId)
        if (!m) return null
        const total = (Number(it.quantity) || 0) * (m.price || 0)
        return {
          ...it,
          name: m.name,
          article: m.article,
          unit: m.unit,
          price: m.price,
          total,
        }
      })
      .filter(Boolean) as Array<
      TechCardItem & { name: string; article: string; unit: string; price: number; total: number }
    >
  }, [value, matMap])

  /** Общая стоимость материалов */
  const totalCost = useMemo(() => rows.reduce((s, r) => s + (r.total || 0), 0), [rows])

  /**
   * Добавление позиции
   */
  const addPosition = useCallback(() => {
    if (!selected || !qty || qty <= 0) {
      toast.error('Выберите материал и укажите количество > 0')
      return
    }
    const exists = (value || []).find((it) => it.materialId === selected)
    if (exists) {
      const next = (value || []).map((it) =>
        it.materialId === selected ? { ...it, quantity: Number(it.quantity) + Number(qty) } : it,
      )
      onChange(next)
    } else {
      const next = [{ materialId: selected, quantity: Number(qty), _techCardId: rid() }, ...(value || [])]
      onChange(next)
    }
    setSelected('')
    setQty(1)
    toast.success('Материал добавлен в ТД')
  }, [selected, qty, value, onChange])

  /**
   * Коммит изменения количества в модель (после ввода/очистки)
   */
  const commitQty = useCallback(
    (id: string | undefined, str: string) => {
      if (!id) return
      const raw = (str ?? '').trim()
      const normalized = raw.replace(',', '.')
      const q = raw === '' ? 0 : Number(normalized)
      if (Number.isNaN(q) || q < 0) {
        // Некорректный ввод — откат к текущему значению и очистка драфта
        setQtyDraft((prev) => {
          const { [id]: _omit, ...rest } = prev
          return rest
        })
        toast.error('Некорректное количество')
        return
      }
      const next = (value || []).map((it) => (it._techCardId === id ? { ...it, quantity: q } : it))
      onChange(next)
      setQtyDraft((prev) => {
        const { [id]: _omit, ...rest } = prev
        return rest
      })
    },
    [onChange, value],
  )

  /**
   * Удаление позиции
   */
  const removePosition = useCallback(
    (id?: string) => {
      const next = (value || []).filter((it) => it._techCardId !== id)
      onChange(next)
      if (id) {
        setQtyDraft((prev) => {
          const { [id]: _omit, ...rest } = prev
          return rest
        })
      }
      toast.success('Позиция удалена из ТД')
    },
    [value, onChange],
  )

  /**
   * Изменение количества (драфт)
   */
  const handleQtyChange = useCallback((id: string | undefined, input: string) => {
    if (!id) return
    setQtyDraft((prev) => ({ ...prev, [id]: input }))
  }, [])

  /**
   * Импорт техкарты из Excel
   */
  const doImport = useCallback(async (file: File | undefined | null) => {
    if (!file) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const items = await parseTechCardExcel(buffer, materials)
      if (items.length === 0) {
        toast.warning('В файле не найдено валидных строк (ожидаются: A — артикул, B — количество)')
        return
      }
      onChange([...(value || []), ...items])
      toast.success(`Импортировано позиций: ${items.length}`)
    } catch (e: any) {
      toast.error(`Ошибка импорта: ${e?.message || 'неизвестно'}`)
    } finally {
      setImporting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [materials, onChange, value])

  return (
    <Card className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 justify-between lg:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Материал</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Выберите материал —</option>
            {sortedMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.article}) — {formatCurrency(m.price, 'KGS')}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
          <NumericField
            value={qty}
            min={0}
            onValueChange={(n) => setQty(n ?? 0)}
            inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            ariaLabel="Количество"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={addPosition}>Добавить</Button>
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => inputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Импорт...' : 'Импорт Excel'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => doImport(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Артикул', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Техкарта пуста. Добавьте материал вручную или импортируйте из Excel.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._techCardId} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-sm font-mono">{r.article}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qtyDraft[r._techCardId!] ?? String(r.quantity)}
                        onChange={(e) => handleQtyChange(r._techCardId, e.target.value)}
                        onBlur={(e) => commitQty(r._techCardId, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitQty(r._techCardId, (e.currentTarget as HTMLInputElement).value)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setQtyDraft((prev) => {
                              const { [r._techCardId!]: _omit, ...rest } = prev
                              return rest
                            })
                          }
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                        aria-label="Количество"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(r.price, 'KGS')}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(r.total, 'KGS')}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="danger" size="sm" onClick={() => removePosition(r._techCardId!)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <div className="text-right">
          <div className="text-sm text-gray-600">Итого материалы</div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(totalCost, 'KGS')}</div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-800">
          Формат Excel для импорта: колонка A — артикул материала, колонка B — количество. Первая строка может быть заголовком.
        </div>
      </div>
    </Card>
  )
})

export default TechCardManager
