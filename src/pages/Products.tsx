/**
 * Страница "Изделия"
 * Функционал: список изделий, создание/редактирование, вкладка "Технологическая карта" (ТД) с импортом Excel
 * Обновлено:
 * - Валюта: базовая KGS (сом)
 * - Мультивалютный вывод через PriceMulti
 * - Тосты для сохранений и действий с ТД
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Modal from '../components/common/Modal'
import TechCardManager from '../components/techcard/TechCardManager'
import PriceMulti from '../components/common/PriceMulti'
import { toast } from 'sonner'
import type { Material, PriceSettings, Product, TechCardItem } from '../types/models'

/**
 * Ключи localStorage для демо-режима
 */
const LS_KEYS = {
  products: 'wasser_products_data',
  materials: 'wasser_materials_data',
  price: 'wasser_price_settings_data',
}

/**
 * Утилита: безопасно читать JSON из LS
 */
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    const data = raw ? (JSON.parse(raw) as T) : fallback
    return data
  } catch {
    return fallback
  }
}

/**
 * Утилита: запись в LS
 */
function writeLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* noop */
  }
}

/**
 * Генерация ID
 */
function rid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Значения по умолчанию (материалы)
 */
function seedMaterials(): Material[] {
  const now = new Date().toISOString()
  return [
    { id: rid(), name: 'ЛДСП 18мм Белый', article: 'LDSP-18-W', unit: 'м2', price: 850, created_at: now, updated_at: now },
    { id: rid(), name: 'Кромка ПВХ 2мм', article: 'EDGE-2-PVC', unit: 'пог.м', price: 35, created_at: now, updated_at: now },
    { id: rid(), name: 'Петля clip-on', article: 'HINGE-CLIP', unit: 'шт', price: 120, created_at: now, updated_at: now },
  ]
}

/**
 * Значения по умолчанию (настройки цен)
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
 * Расчет цены изделия по техкарте и настройкам
 */
function calcPrice(product: Product, materials: Material[], settings: PriceSettings) {
  const matMap = new Map(materials.map((m) => [m.id, m]))
  const materialCost = (product.tech_card || []).reduce((sum, it) => {
    const m = matMap.get(it.materialId)
    return sum + (Number(it.quantity) || 0) * (m?.price || 0)
  }, 0)
  const pt = settings.productTypes.find((t) => t.id === product.product_type_id)
  const workCost = pt?.workCost || 0
  const base = materialCost + workCost
  const afterType = base * (1 + (pt?.markup || 0) / 100)
  const ft = settings.finishTypes.find((t) => t.id === product.finish_type_id)
  const final = afterType * (1 + (ft?.markup || 0) / 100)
  return { materialCost, workCost, basePrice: base, finalPrice: final }
}

/**
 * Компонент страницы "Изделия"
 */
export default function ProductsPage(): React.ReactElement {
  // Данные
  const [materials, setMaterials] = useState<Material[]>(() => readLS(LS_KEYS.materials, seedMaterials()))
  const [products, setProducts] = useState<Product[]>(() => readLS(LS_KEYS.products, [] as Product[]))
  const [price, setPrice] = useState<PriceSettings>(() => readLS(LS_KEYS.price, seedPrice()))

  useEffect(() => writeLS(LS_KEYS.materials, materials), [materials])
  useEffect(() => writeLS(LS_KEYS.products, products), [products])
  useEffect(() => writeLS(LS_KEYS.price, price), [price])

  // Состояния UI
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [tab, setTab] = useState<'info' | 'tc'>('info')

  // Фильтрация
  const view = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return products
    return products.filter((p) => p.name.toLowerCase().includes(t) || p.article.toLowerCase().includes(t))
  }, [products, search])

  /**
   * Создать изделие
   */
  const createProduct = useCallback(() => {
    const now = new Date().toISOString()
    const p: Product = {
      id: rid(),
      name: 'Новое изделие',
      article: `PROD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      tech_card: [],
      product_type_id: '',
      finish_type_id: '',
      image_url: '',
      created_at: now,
      updated_at: now,
    }
    setProducts((prev) => [p, ...prev])
    setEditing(p)
    setTab('info')
    // Тост при создании черновика
    toast.info('Создано новое изделие')
  }, [])

  /**
   * Сохранить изделие
   */
  const saveProduct = useCallback(
    (patch: Partial<Product>) => {
      if (!editing) return
      const next: Product = { ...editing, ...patch, updated_at: new Date().toISOString() }
      setProducts((prev) => prev.map((x) => (x.id === next.id ? next : x)))
      setEditing(next)
      toast.success('Изделие сохранено')
    },
    [editing],
  )

  /**
   * Удалить изделие
   */
  const deleteProduct = useCallback(
    (id: string) => {
      const p = products.find((x) => x.id === id)
      if (!p) return
      if (!confirm(`Удалить изделие "${p.name}"?`)) return
      setProducts((prev) => prev.filter((x) => x.id !== id))
      if (editing?.id === id) setEditing(null)
      toast.success('Изделие удалено')
    },
    [products, editing],
  )

  /**
   * Обновить техкарту у редактируемого изделия
   */
  const updateTechCard = useCallback(
    (tc: TechCardItem[]) => {
      if (!editing) return
      setEditing({ ...editing, tech_card: tc })
    },
    [editing],
  )

  /**
   * Применить изменения из формы "Инфо"
   */
  const applyInfo = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!editing) return
      const form = new FormData(e.currentTarget)
      const name = String(form.get('name') || '').trim()
      const article = String(form.get('article') || '').trim()
      const pt = String(form.get('product_type_id') || '')
      const ft = String(form.get('finish_type_id') || '')
      if (!name) {
        toast.error('Укажите наименование')
        return
      }
      if (!article) {
        toast.error('Укажите артикул')
        return
      }
      saveProduct({ name, article, product_type_id: pt || null, finish_type_id: ft || null })
    },
    [editing, saveProduct],
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Изделия</h1>
          <p className="text-gray-600 mt-1">Редактируйте карточку изделия и его ТД (техкарту). Импортируйте состав из Excel.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent" onClick={createProduct}>
            Добавить изделие
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Поиск по названию или артикулу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {view.length === 0 ? (
        <Card>
          <div className="text-gray-600">Изделия не найдены. Создайте первое изделие.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {view.map((p) => {
            const pr = calcPrice(p, materials, price)
            return (
              <Card key={p.id} className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 font-mono">{p.article}</div>
                  <div className="text-base font-semibold text-gray-900">{p.name}</div>
                </div>
                <div className="text-sm text-gray-600">
                  Материалов в ТД: <span className="font-medium text-gray-900">{p.tech_card?.length || 0}</span>
                </div>

                {/* Вывод стоимости в базовой валюте (KGS) + дубли в выбранных валютах */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">Себестоимость:</div>
                    <PriceMulti amountBase={pr.basePrice} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">Цена:</div>
                    <PriceMulti amountBase={pr.finalPrice} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="bg-transparent" onClick={() => { setEditing(p); setTab('info') }}>
                    Редактировать
                  </Button>
                  <Button variant="danger" onClick={() => deleteProduct(p.id)}>
                    Удалить
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Модалка редактирования изделия */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Редактирование: ${editing.name}` : 'Изделие'}>
        {!editing ? null : (
          <div className="space-y-6">
            {/* Табы */}
            <div className="flex border-b border-gray-200">
              <button
                className={`px-4 py-2 -mb-px border-b-2 ${tab === 'info' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600'}`}
                onClick={() => setTab('info')}
              >
                Основная информация
              </button>
              <button
                className={`px-4 py-2 -mb-px border-b-2 ${tab === 'tc' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600'}`}
                onClick={() => setTab('tc')}
              >
                Технологическая карта
              </button>
            </div>

            {tab === 'info' ? (
              <form className="space-y-4" onSubmit={applyInfo}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
                    <input
                      name="article"
                      type="text"
                      defaultValue={editing.article}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="PROD-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тип изделия</label>
                    <select
                      name="product_type_id"
                      defaultValue={editing.product_type_id || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Не выбран —</option>
                      {price.productTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (+{t.markup}% / {t.workCost} KGS)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Наименование</label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={editing.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Тумба 600 Белая"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тип отделки</label>
                    <select
                      name="finish_type_id"
                      defaultValue={editing.finish_type_id || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Не выбран —</option>
                      {price.finishTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (+{t.markup}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL изображения (опционально)</label>
                    <input
                      name="image_url"
                      type="url"
                      defaultValue={editing.image_url || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="bg-transparent" onClick={() => setEditing(null)}>
                    Отмена
                  </Button>
                  <Button type="submit">Сохранить</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <TechCardManager
                  materials={materials}
                  value={editing.tech_card || []}
                  onChange={(tc) => updateTechCard(tc)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    onClick={() => {
                      if (!editing) return
                      saveProduct({ tech_card: editing.tech_card })
                      toast.success('Техкарта сохранена')
                    }}
                  >
                    Сохранить ТД
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
