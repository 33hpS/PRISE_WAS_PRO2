/**
 * PDF price list generator
 * Генератор прайс-листов PDF с поддержкой кириллицы и гибких настроек
 */

import { jsPDF } from 'jspdf'
import autoTable, { RowInput } from 'jspdf-autotable'

/**
 * Интерфейс опций генерации прайса
 */
export interface PriceListOptions {
  companyName: string
  subtitle?: string
  footerNote?: string
  logoUrl?: string
  fontUrl?: string
  brandColor?: string
  pageOrientation?: 'p' | 'l'
  includeCover?: boolean
  groupBy?: 'none' | 'collection' | 'type'
  columns: {
    article: boolean
    name: boolean
    collection: boolean
    type: boolean
    finish: boolean
    materialCost: boolean
    workCost: boolean
    price: boolean
    markup: boolean
  }
  currency: string
  decimals: number
}

/**
 * Интерфейсы данных
 */
export interface Material {
  id: string
  name: string
  article: string
  unit: string
  price: number
  created_at: string
  updated_at: string
}

export interface TechCardItem {
  materialId: string
  quantity: number
  _techCardId?: string
}

export interface Product {
  id: string
  name: string
  article: string
  tech_card: TechCardItem[]
  collection_id?: string | null
  product_type_id?: string | null
  finish_type_id?: string | null
  image_url?: string | null
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  product_order?: string[]
  created_at: string
  updated_at: string
}

export interface PriceSettings {
  productTypes: { id: string; name: string; markup: number; workCost: number }[]
  finishTypes: { id: string; name: string; markup: number; workCost: number }[]
}

/**
 * Загружаем TTF шрифт и регистрируем в jsPDF (кириллица поддерживается)
 */
async function registerCyrillicFont(doc: jsPDF, fontUrl?: string, fontName = 'WasserSans'): Promise<void> {
  // По умолчанию используем Roboto Regular из репозитория Google Fonts (CORS-friendly)
  const url =
    fontUrl?.trim() ||
    'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf'

  const res = await fetch(url)
  if (!res.ok) throw new Error('Не удалось загрузить шрифт для PDF')
  const buffer = await res.arrayBuffer()
  // Преобразуем в base64
  const base64 = arrayBufferToBase64(buffer)

  // Регистрируем в jsPDF
  doc.addFileToVFS(`${fontName}.ttf`, base64)
  doc.addFont(`${fontName}.ttf`, fontName, 'normal')
  doc.setFont(fontName, 'normal')
}

/**
 * Конвертация ArrayBuffer -> base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(sub) as any)
  }
  return btoa(binary)
}

/**
 * Формат валюты
 */
function formatCurrency(amount: number, currency: string, decimals: number) {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0)
  } catch {
    // На случай нестандартного кода валюты — простой форматтер
    return `${amount.toFixed(decimals)} ${currency}`
  }
}

/**
 * Расчет цены изделия согласно текущим настройкам
 */
function calculateProductPrice(
  product: Product,
  materials: Material[],
  priceSettings: PriceSettings,
) {
  // Нормализация техкарты к массиву
  const tcRaw: any = (product as any)?.tech_card
  const techCardArr: any[] = Array.isArray(tcRaw)
    ? tcRaw
    : tcRaw && typeof tcRaw === 'object'
      ? Object.values(tcRaw)
      : []

  if (techCardArr.length === 0) {
    return { materialCost: 0, workCost: 0, basePrice: 0, finalPrice: 0, markup: 0 }
  }

  const materialCost = techCardArr.reduce((sum: number, it: any) => {
    const mat = materials.find((m) => m.id === it.materialId)
    return sum + (Number(it.quantity) || 0) * (mat?.price || 0)
  }, 0)

  const pt = priceSettings.productTypes.find((p) => p.id === product.product_type_id)
  const workCost = pt?.workCost || 0
  const basePrice = materialCost + workCost
  const priceWithType = basePrice * (1 + (pt?.markup || 0) / 100)
  const ft = priceSettings.finishTypes.find((f) => f.id === product.finish_type_id)
  const finalPrice = priceWithType * (1 + (ft?.markup || 0) / 100)
  const markup = basePrice > 0 ? ((finalPrice - basePrice) / basePrice) * 100 : 0

  return { materialCost, workCost, basePrice, finalPrice, markup }
}

/**
 * Генерация PDF прайс-листа
 */
export async function generatePriceListPDF(params: {
  products: Product[]
  materials: Material[]
  collections: Collection[]
  priceSettings: PriceSettings
  options: PriceListOptions
}): Promise<void> {
  const { products, materials, collections, priceSettings, options } = params
  const brand = options.brandColor || '#2563eb'
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: options.pageOrientation || 'p' })

  // Подключаем кириллицу
  await registerCyrillicFont(doc, options.fontUrl)

  // Цвета
  const brandRGB = hexToRgb(brand) || { r: 37, g: 99, b: 235 }
  const grayText = '#475569'

  // Номера страниц, футер
  const footer = (data?: any) => {
    const str = `Стр. ${doc.getCurrentPageInfo().pageNumber} из ${doc.getNumberOfPages()}`
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(str, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  // Обложка (опционально)
  if (options.includeCover) {
    // Верхний цветной блок
    doc.setFillColor(brandRGB.r, brandRGB.g, brandRGB.b)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 120, 'F')

    doc.setTextColor(255)
    doc.setFontSize(18)
    doc.text(options.companyName || 'Прайс‑лист', 40, 60)

    doc.setFontSize(12)
    doc.text(options.subtitle || 'Актуальные цены на изделия', 40, 90)

    // Дата
    doc.setTextColor(255)
    doc.setFontSize(10)
    doc.text(new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date()), 40, 110)

    // Лого (если задано)
    if (options.logoUrl) {
      try {
        const imgData = await imageUrlToDataUrl(options.logoUrl)
        if (imgData) {
          const w = 120
          const h = 40
          doc.addImage(imgData, 'PNG', doc.internal.pageSize.getWidth() - w - 40, 40, w, h)
        }
      } catch {
        // игнорируем
      }
    }

    footer()
    doc.addPage()
  }

  // Header каждой страницы (company + линия)
  const header = () => {
    doc.setFillColor(brandRGB.r, brandRGB.g, brandRGB.b)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F')
    doc.setTextColor(brand)
    doc.setFontSize(12)
    doc.text(options.companyName || 'Прайс‑лист', 40, 28)
    doc.setTextColor(grayText)
    doc.setFontSize(10)
    doc.text(options.subtitle || 'Актуальные цены', 40, 44)
  }

  // Данные для таблицы
  const collectionMap = new Map(collections.map((c) => [c.id, c.name]))
  const productTypeMap = new Map(priceSettings.productTypes.map((t) => [t.id, t.name]))
  const finishMap = new Map(priceSettings.finishTypes.map((t) => [t.id, t.name]))

  // Группировка
  const groups: Record<string, Product[]> = {}
  const groupKey = (p: Product) => {
    switch (options.groupBy) {
      case 'collection':
        return p.collection_id ? `Коллекция: ${collectionMap.get(p.collection_id) || 'Без коллекции'}` : 'Коллекция: Без коллекции'
      case 'type':
        return p.product_type_id ? `Тип: ${productTypeMap.get(p.product_type_id) || 'Без типа'}` : 'Тип: Без типа'
      default:
        return 'Все изделия'
    }
  }
  products.forEach((p) => {
    const key = groupKey(p)
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  })

  // Заголовок таблицы согласно выбранным колонкам
  const headRow: string[] = []
  if (options.columns.article) headRow.push('Артикул')
  if (options.columns.name) headRow.push('Наименование')
  if (options.columns.collection) headRow.push('Коллекция')
  if (options.columns.type) headRow.push('Тип')
  if (options.columns.finish) headRow.push('Отделка')
  if (options.columns.materialCost) headRow.push('Материалы')
  if (options.columns.workCost) headRow.push('Работа')
  if (options.columns.price) headRow.push('Цена')
  if (options.columns.markup) headRow.push('Наценка')

  // Рендер групп
  const groupNames = Object.keys(groups)
  groupNames.forEach((gName, idx) => {
    const rows: RowInput[] = []
    const list = groups[gName]

    list.forEach((p) => {
      const pricing = calculateProductPrice(p, materials, priceSettings)
      const row: (string | number)[] = []

      if (options.columns.article) row.push(p.article)
      if (options.columns.name) row.push(p.name)
      if (options.columns.collection) row.push(p.collection_id ? collectionMap.get(p.collection_id) || '—' : '—')
      if (options.columns.type) row.push(p.product_type_id ? productTypeMap.get(p.product_type_id) || '—' : '—')
      if (options.columns.finish) row.push(p.finish_type_id ? finishMap.get(p.finish_type_id) || '—' : '—')
      if (options.columns.materialCost) row.push(formatCurrency(pricing.materialCost, options.currency, options.decimals))
      if (options.columns.workCost) row.push(formatCurrency(pricing.workCost, options.currency, options.decimals))
      if (options.columns.price) row.push(formatCurrency(pricing.finalPrice, options.currency, options.decimals))
      if (options.columns.markup) row.push(`${pricing.markup.toFixed(1)}%`)

      rows.push(row as RowInput)
    })

    // Заголовок группы
    doc.setFontSize(13)
    doc.setTextColor(brand)
    doc.text(gName, 40, 72)
    doc.setTextColor(0)

    autoTable(doc, {
      head: [headRow],
      body: rows,
      startY: 82,
      styles: {
        font: doc.getFont().fontName,
        fontStyle: 'normal',
        fontSize: 10,
        textColor: 30,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: brandRGB,
        textColor: 255,
        fontSize: 10.5,
      },
      alternateRowStyles: {
        fillColor: [247, 249, 252],
      },
      didDrawPage: () => {
        header()
        footer()
      },
      margin: { left: 40, right: 40, top: 60, bottom: 40 },
      theme: 'striped',
      columnStyles: {
        // Чуть уже артикул/наценка/работа, шире имя
        0: { cellWidth: headRow[0] === 'Артикул' ? 90 : 'auto' },
      } as any,
    })

    // Пробел между группами
    if (idx < groupNames.length - 1) {
      doc.addPage()
    }
  })

  // Примечание внизу последней страницы
  if (options.footerNote) {
    const lastPage = doc.getCurrentPageInfo().pageNumber
    doc.setPage(lastPage)
    doc.setFontSize(9)
    doc.setTextColor(100)
    const text = options.footerNote
    const pageWidth = doc.internal.pageSize.getWidth()
    const y = doc.internal.pageSize.getHeight() - 28
    doc.text(text, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - 120 })
  }

  doc.save(`PriceList_${new Date().toISOString().slice(0, 10)}.pdf`)
}

/**
 * Преобразуем URL изображения в dataURL (для логотипа)
 */
async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * HEX -> RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null
}
