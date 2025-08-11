/**
 * Страница "Прайс-лист" — генерация PDF и печать HTML с 3 шаблонами под A4.
 * Функции:
 * - Фото-миниатюры в PDF (префетч + отрисовка в ячейке)
 * - Итоги по группе (PDF foot / HTML tfoot)
 * - Разрыв между группами (PDF)
 * - Диагностика PDF окружения (jsPDF, autoTable, шрифт) + тестовый PDF
 * - Общий итог по всем товарам (PDF/HTML)
 * - Логотип в футере каждой PDF-страницы
 * - Миниатюры в HTML печати
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ensureJsPdf, getJsPdfCtor } from '../lib/pdf/loader'
import { generateNordicSamplePdf } from '../lib/pdf/examples/nordicExample'

/**
 * Интерфейсы данных (моки из localStorage)
 */
interface Material {
  id: string
  name: string
  article: string
  unit: string
  price: number
  created_at: string
  updated_at: string
}
interface TechCardItem {
  materialId: string
  quantity: number
  _techCardId: string
}
interface Product {
  id: string
  name: string
  article: string
  tech_card: TechCardItem[]
  collection_id?: string | null
  product_type_id?: string
  finish_type_id?: string
  image_url?: string | null
  created_at: string
  updated_at: string
}
interface PriceType {
  id: string
  name: string
  markup: number
  workCost: number
}
interface FinishType {
  id: string
  name: string
  markup: number
  workCost?: number
}
interface PriceSettings {
  productTypes: PriceType[]
  finishTypes: FinishType[]
}

/**
 * Утилиты форматирования
 */
const formatCurrency = (amount: number, currency = 'KGS', locale = 'ru-RU') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0)

const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(d))

/**
 * Получить значения из localStorage с безопасным парсингом
 */
function getLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`wasser_${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Расчет цен изделия по текущим настройкам
 */
function calcPrice(product: Product, materials: Material[], settings: PriceSettings) {
  const tcRaw: any = (product as any)?.tech_card
  const techCardArr: any[] = Array.isArray(tcRaw)
    ? tcRaw
    : tcRaw && typeof tcRaw === 'object'
      ? Object.values(tcRaw)
      : []

  if (techCardArr.length === 0) {
    return { materialCost: 0, workCost: 0, basePrice: 0, finalPrice: 0 }
  }

  const materialCost = techCardArr.reduce((sum: number, it: any) => {
    const m = materials.find((mm) => mm.id === it.materialId)
    return sum + (Number(it.quantity) || 0) * (m?.price || 0)
  }, 0)
  const pt = settings.productTypes.find((p) => p.id === product.product_type_id)
  const workCost = pt?.workCost || 0
  const basePrice = materialCost + workCost
  const afterType = basePrice * (1 + (pt?.markup || 0) / 100)
  const ft = settings.finishTypes.find((f) => f.id === product.finish_type_id)
  const finalPrice = afterType * (1 + (ft?.markup || 0) / 100)
  return { materialCost, workCost, basePrice, finalPrice }
}

/**
 * Типы настроек страницы прайс-листа
 */
type Orientation = 'portrait' | 'landscape'
type GroupBy = 'none' | 'productType' | 'collection'
type ThemeKey = 'gradientModern' | 'minimalNordic' | 'executiveBlue'
type Density = 'normal' | 'compact'

/**
 * Опции прайс-листа
 */
interface PriceListOptions {
  brandName: string
  brandColor: string
  brandSub: string
  logoUrl: string
  includeCover: boolean
  orientation: Orientation
  margin: number
  columns: {
    image: boolean
    article: boolean
    name: boolean
    productType: boolean
    finishType: boolean
    basePrice: boolean
    finalPrice: boolean
  }
  groupBy: GroupBy
  currency: string
  locale: string
  fontUrl: string
  fontName: string
  /** Локально загруженный TTF как бинарная строка (офлайн) */
  fontBinary: string | null
  /** Имя локального файла (для отображения пользователю) */
  fontFileName: string | null
  showFooter: boolean
  /** Стиль шаблона PDF/печати */
  styleKey: ThemeKey
  /** Плотность строк таблицы */
  density: Density
  /** Итоги по группе */
  showGroupTotals: boolean
  /** Разрыв страниц между группами (PDF) */
  pageBreakBetweenGroups: boolean
  /** Общий итог по всем товарам (PDF/HTML) */
  showGrandTotal: boolean
}

/**
 * Предустановленные шрифты (URL) — применяются для HTML-печати/превью
 */
const PRESET_FONTS: Array<{ label: string; url: string }> = [
  {
    label: 'Noto Sans (Cyrillic)',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Regular.ttf',
  },
  {
    label: 'PT Sans (Cyrillic)',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/ptsans/PTSans-Regular.ttf',
  },
  {
    label: 'Roboto (Cyrillic)',
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
  },
]

/**
 * Тема PDF/печати: цвета и оформление (для HTML-print)
 */
interface PdfTheme {
  key: ThemeKey
  label: string
  description: string
  colors: {
    primary: string
    text: string
    headerText: string
    table: {
      headBg: string | number[]
      headText: string | number[]
      rowStripe?: string | number[]
      border?: string | number[]
    }
  }
  header: {
    topBand: boolean
    bandHeight: number
    underline: boolean
  }
  tableTheme: 'striped' | 'grid' | 'plain'
}

/**
 * Набор тем: 3 новые профессиональные шаблоны
 */
const THEMES: Record<ThemeKey, PdfTheme> = {
  gradientModern: {
    key: 'gradientModern',
    label: 'Gradient Modern',
    description: 'Современный акцент с верхней полосой и мягкой полосатой таблицей',
    colors: {
      primary: '#2563eb',
      text: '#111111',
      headerText: '#ffffff',
      table: {
        headBg: '#2563eb',
        headText: [255, 255, 255],
        rowStripe: '#f1f5f9',
        border: '#e5e7eb',
      },
    },
    header: {
      topBand: true,
      bandHeight: 24,
      underline: false,
    },
    tableTheme: 'striped',
  },
  minimalNordic: {
    key: 'minimalNordic',
    label: 'Minimal Nordic',
    description: 'Воздух и тонкие линии, без заливки заголовка',
    colors: {
      primary: '#0f172a',
      text: '#111111',
      headerText: '#111111',
      table: {
        headBg: '#ffffff',
        headText: [17, 17, 17],
        rowStripe: '#fafafa',
        border: '#e5e7eb',
      },
    },
    header: {
      topBand: false,
      bandHeight: 0,
      underline: true,
    },
    tableTheme: 'plain',
  },
  executiveBlue: {
    key: 'executiveBlue',
    label: 'Executive Blue',
    description: 'Строгая корпоративная сетка с четкими линиями',
    colors: {
      primary: '#1d4ed8',
      text: '#111111',
      headerText: '#ffffff',
      table: {
        headBg: '#1d4ed8',
        headText: [255, 255, 255],
        rowStripe: '#eef2ff',
        border: '#c7d2fe',
      },
    },
    header: {
      topBand: false,
      bandHeight: 0,
      underline: true,
    },
    tableTheme: 'grid',
  },
}

/**
 * Кэш подключенных шрифтов (для PDF)
 */
const loadedFonts = new Set<string>()

/**
 * Утилита: ArrayBuffer -> бинарная строка (chunk-ами)
 */
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, Array.from(sub) as any)
  }
  return binary
}

/**
 * ArrayBuffer -> base64
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
 * Цветовые утилиты
 */
type RGB = [number, number, number]
function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}
function toRGB(color: string | number[] | undefined, fallback: RGB = [0, 0, 0]): RGB {
  if (!color) return fallback
  if (Array.isArray(color) && color.length >= 3) {
    return [Number(color[0]) || 0, Number(color[1]) || 0, Number(color[2]) || 0]
  }
  if (typeof color === 'string') {
    return hexToRgb(color)
  }
  return fallback
}

/**
 * Построить список колонок из опций (общая функция для PDF и печати)
 */
function buildColumns(options: PriceListOptions): Array<{ header: string; key: string }> {
  const cols: { header: string; key: string }[] = []
  if (options.columns.image) cols.push({ header: 'Фото', key: 'image' })
  if (options.columns.article) cols.push({ header: 'Артикул', key: 'article' })
  if (options.columns.name) cols.push({ header: 'Наименование', key: 'name' })
  if (options.columns.productType) cols.push({ header: 'Тип', key: 'productType' })
  if (options.columns.finishType) cols.push({ header: 'Отделка', key: 'finishType' })
  if (options.columns.basePrice) cols.push({ header: 'Себестоимость', key: 'basePrice' })
  if (options.columns.finalPrice) cols.push({ header: 'Цена', key: 'finalPrice' })
  return cols
}

/**
 * Компонент страницы прайс-листа
 */
export default function PriceListPage(): React.ReactElement {
  // Нормализация структур из localStorage
  const normalizeArr = (v: any) =>
    Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []

  // Данные из localStorage
  const rawMaterials = getLS<any>('materials', [])
  const rawProducts = getLS<any>('products', [])
  const rawPS = getLS<any>('price_settings', { productTypes: [], finishTypes: [] })

  const materials: Material[] = normalizeArr(rawMaterials)
  const products: Product[] = normalizeArr(rawProducts)
  const priceSettings: PriceSettings = {
    productTypes: normalizeArr(rawPS.productTypes),
    finishTypes: normalizeArr(rawPS.finishTypes),
  }

  const [options, setOptions] = useState<PriceListOptions>({
    brandName: 'WASSER PRO',
    brandSub: 'Прайс-лист на продукцию',
    brandColor: '#2563eb',
    logoUrl: '',
    includeCover: true,
    orientation: 'portrait',
    margin: 16,
    columns: {
      image: false,
      article: true,
      name: true,
      productType: true,
      finishType: true,
      basePrice: false,
      finalPrice: true,
    },
    groupBy: 'productType',
    currency: 'KGS',
    locale: 'ru-RU',
    fontUrl: PRESET_FONTS[0].url,
    fontName: 'CustomFont',
    fontBinary: null,
    fontFileName: null,
    showFooter: true,
    styleKey: 'gradientModern',
    density: 'normal',
    showGroupTotals: true,
    pageBreakBetweenGroups: false,
    showGrandTotal: true,
  })

  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingNordicDemo, setLoadingNordicDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontWarning, setFontWarning] = useState<string | null>(null)
  const [fontInfo, setFontInfo] = useState<string | null>(null)

  /**
   * Состояние диагностики PDF окружения
   */
  const [pdfDiag, setPdfDiag] = useState<{
    jsPdf: boolean
    autoTable: boolean
    fontReady: boolean | null
    lastError: string | null
    testUrl: string | null
  }>({ jsPdf: false, autoTable: false, fontReady: null, lastError: null, testUrl: null })

  // Предпросчет данных таблицы
  const computed = useMemo(() => {
    const rows = products.map((p) => {
      const prices = calcPrice(p, materials, priceSettings)
      const typeName = priceSettings.productTypes.find((t) => t.id === p.product_type_id)?.name || ''
      const finishName = priceSettings.finishTypes.find((t) => t.id === p.finish_type_id)?.name || ''
      return {
        id: p.id,
        name: p.name,
        article: p.article,
        productType: typeName,
        finishType: finishName,
        basePrice: prices.basePrice,
        finalPrice: prices.finalPrice,
        imageUrl: p.image_url || '',
        collectionId: p.collection_id || null,
      }
    })
    return rows
  }, [products, materials, priceSettings])

  // Группы
  const groups = useMemo(() => {
    if (options.groupBy === 'none') {
      return [{ key: 'Все товары', items: computed }]
    }
    if (options.groupBy === 'productType') {
      const map = new Map<string, any[]>()
      for (const row of computed) {
        const key = row.productType || 'Без типа'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(row)
      }
      return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
    }
    if (options.groupBy === 'collection') {
      const map = new Map<string, any[]>()
      for (const row of computed) {
        const key = row.collectionId || 'Без коллекции'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(row)
      }
      return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
    }
    return [{ key: 'Все товары', items: computed }]
  }, [computed, options.groupBy])

  /** Ленивая загрузка jsPDF UMD */
  useEffect(() => {
    ensureJsPdf().catch(() => {
      // отложим до клика
    })
  }, [])

  /** Обновить часть опций */
  const updateOption = useCallback((patch: Partial<PriceListOptions>) => setOptions((prev) => ({ ...prev, ...patch })), [])

  /** Список колонок под текущие опции */
  const colsForPrint = useMemo(() => buildColumns(options), [options])

  /**
   * Получить активную тему PDF/печати (ЕДИНСТВЕННАЯ РЕАЛИЗАЦИЯ)
   */
  const getActiveTheme = useCallback(
    (overridePrimary?: string): PdfTheme & { colors: PdfTheme['colors'] } => {
      const base = THEMES[options.styleKey]
      const primary = overridePrimary || options.brandColor || base.colors.primary
      return {
        ...base,
        colors: {
          ...base.colors,
          primary,
          table: {
            ...base.colors.table,
            headBg: base.key === 'minimalNordic' ? '#ffffff' : base.colors.table.headBg,
          },
        },
      }
    },
    [options.styleKey, options.brandColor],
  )

  /**
   * Рисование шапки и футера на каждой странице PDF
   * Дополнено: компактный логотип в футере справа (если задан и showFooter=true)
   */
  const drawHeaderFooter = useCallback(
    (
      doc: any,
      pageNumber: number,
      pageCount: number,
      theme: PdfTheme,
      margin: number,
      logo?: { dataUrl: string; imgType: 'PNG' | 'JPEG' } | null,
    ) => {
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()

      if (theme.header.topBand) {
        const bandRGB = toRGB(theme.colors.primary, [37, 99, 235])
        doc.setFillColor(bandRGB[0], bandRGB[1], bandRGB[2])
        doc.rect(0, 0, w, theme.header.bandHeight, 'F')
      }
      if (theme.header.underline) {
        const lineRGB = toRGB(theme.colors.primary, [37, 99, 235])
        doc.setDrawColor(lineRGB[0], lineRGB[1], lineRGB[2])
        doc.setLineWidth(theme.key === 'minimalNordic' ? 0.5 : 0.8)
        doc.line(margin, margin - 4, w - margin, margin - 4)
      }

      if (theme.header.topBand) {
        doc.setTextColor(255, 255, 255)
      } else {
        const brandRGB = toRGB(theme.colors.primary, [37, 99, 235])
        doc.setTextColor(brandRGB[0], brandRGB[1], brandRGB[2])
      }
      doc.setFontSize(12)
      const brandY = theme.header.topBand ? Math.max(14, theme.header.bandHeight - 6) : margin
      doc.text(options.brandName, margin, brandY)

      // Подзаголовок
      const subRGB = toRGB('#111111', [17, 17, 17])
      doc.setTextColor(subRGB[0], subRGB[1], subRGB[2])
      doc.setFontSize(9)
      doc.text(options.brandSub, margin, brandY + 8)

      // Футер (нумерация + логотип)
      if (options.showFooter) {
        doc.setFontSize(9)
        const footRGB = toRGB('#6b7280', [107, 114, 128])
        doc.setTextColor(footRGB[0], footRGB[1], footRGB[2])
        // Текст справа
        doc.text(`Стр. ${pageNumber} из ${pageCount}`, w - margin, h - 10, {
          align: 'right',
        })
        // Маленький логотип внизу слева (если есть)
        if (logo?.dataUrl) {
          try {
            // 18x10 pt иконка, чтобы не перегружать футер
            const imgW = 36
            const imgH = 18
            doc.addImage(logo.dataUrl, logo.imgType, margin, h - imgH - 14, imgW, imgH)
          } catch {
            // игнорируем
          }
        }
      }
    },
    [options],
  )

  /**
   * Обработчик: загрузка локального TTF (информативно для HTML-печати)
   */
  const handleFontFile = useCallback(async (file: File | null) => {
    setFontWarning(null)
    setFontInfo(null)
    if (!file) {
      setOptions((prev) => ({
        ...prev,
        fontBinary: null,
        fontFileName: null,
        fontName: 'CustomFont',
      }))
      return
    }
    try {
      const buf = await file.arrayBuffer()
      const binary = arrayBufferToBinaryString(buf)
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]+/g, '_') || 'LocalFont'
      const uniqueName = `${base}_${Date.now()}`
      setOptions((prev) => ({
        ...prev,
        fontBinary: binary,
        fontFileName: file.name,
        fontName: uniqueName,
      }))
      setFontInfo(`Локальный шрифт загружен: ${file.name}`)
    } catch (e: any) {
      setFontWarning(`Не удалось прочитать файл шрифта: ${e?.message || 'ошибка файла'}`)
    }
  }, [])

  /**
   * Помощник: загрузить URL изображения в dataURL (для PDF addImage)
   */
  async function imageUrlToDataUrl(url: string): Promise<{ dataUrl: string; imgType: 'PNG' | 'JPEG' } | null> {
    try {
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) return null
      const blob = await resp.blob()
      const buffer = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(buffer)
      const mime = blob.type || 'image/png'
      const isPng = /png/i.test(mime)
      const isJpg = /jpe?g/i.test(mime)
      const imgType: 'PNG' | 'JPEG' = isPng ? 'PNG' : isJpg ? 'JPEG' : 'PNG'
      const dataUrl = `data:${mime};base64,${base64}`
      return { dataUrl, imgType }
    } catch {
      return null
    }
  }

  /**
   * Регистрация шрифта для PDF
   */
  const registerFont = useCallback(
    async (doc: any, url: string, fontName: string): Promise<boolean> => {
      if (options.fontBinary) {
        try {
          if (!loadedFonts.has(fontName)) {
            doc.addFileToVFS(`${fontName}.ttf`, options.fontBinary)
            doc.addFont(`${fontName}.ttf`, fontName, 'normal')
            loadedFonts.add(fontName)
          }
          doc.setFont(fontName, 'normal')
          setFontInfo(`Используется локальный шрифт${options.fontFileName ? `: ${options.fontFileName}` : ''}.`)
          return true
        } catch {
          // перейдём к сетевому
        }
      }

      const candidates = [
        url?.trim(),
        'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
        'https://raw.githubusercontent.com/google/fonts/main/ofl/ptsans/PTSans-Regular.ttf',
        'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Regular.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PTSans-Regular.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
      ].filter(Boolean) as string[]

      for (const candidate of candidates) {
        try {
          const resp = await fetch(candidate, { cache: 'no-store', mode: 'cors' as RequestMode })
          if (!resp.ok) continue
          const buffer = await resp.arrayBuffer()
          const binary = arrayBufferToBinaryString(buffer)

          if (!loadedFonts.has(fontName)) {
            doc.addFileToVFS(`${fontName}.ttf`, binary)
            doc.addFont(`${fontName}.ttf`, fontName, 'normal')
            loadedFonts.add(fontName)
          }
          doc.setFont(fontName, 'normal')
          setFontInfo(`Загружен шрифт по сети: ${candidate}`)
          return true
        } catch {
          // пробуем следующий
        }
      }
      return false
    },
    [options.fontBinary, options.fontFileName],
  )

  /**
   * Генерация PDF с миниатюрами, итогами и межгрупповым разрывом
   * Дополнено: общий итог в конце; логотип в футере
   */
  const handleGeneratePdf = useCallback(async () => {
    setError(null)
    setFontWarning(null)
    setFontInfo(null)
    setLoadingPdf(true)
    try {
      await ensureJsPdf()
      const JsPdfCtor = getJsPdfCtor()
      if (!JsPdfCtor) throw new Error('jsPDF не доступен')

      const theme = getActiveTheme()
      const doc = new JsPdfCtor({
        orientation: options.orientation,
        unit: 'pt',
        format: 'a4',
        compress: true,
      })

      // Подключаем кириллицу (если не удалось — Helvetica)
      const fontOK = await registerFont(doc, options.fontUrl, options.fontName)
      if (!fontOK) {
        setFontWarning('Не удалось загрузить кириллический шрифт. Используем Helvetica — кириллица может отображаться некорректно.')
        doc.setFont('helvetica', 'normal')
      } else {
        doc.setFont(options.fontName, 'normal')
      }

      const baseFontSize = options.density === 'compact' ? 9 : 10
      doc.setFontSize(baseFontSize)

      // Лого для футера (предзагрузка)
      let footerLogo: { dataUrl: string; imgType: 'PNG' | 'JPEG' } | null = null
      if (options.logoUrl) {
        try {
          const fetched = await imageUrlToDataUrl(options.logoUrl)
          if (fetched) footerLogo = fetched
        } catch {
          // ignore
        }
      }

      // Обложка (опционально)
      if (options.includeCover) {
        const w = doc.internal.pageSize.getWidth()
        const bandRGB = toRGB(theme.colors.primary, [37, 99, 235])
        doc.setFillColor(bandRGB[0], bandRGB[1], bandRGB[2])
        const bandHeight = theme.header.topBand ? Math.max(120, theme.header.bandHeight * 6) : 160
        doc.rect(0, 0, w, bandHeight, 'F')
        doc.setTextColor(255, 255, 255)

        doc.setFontSize(26)
        doc.text(options.brandName, 40, 70)
        doc.setFontSize(14)
        doc.text(options.brandSub, 40, 100)

        // Лого на обложке
        if (options.logoUrl) {
          try {
            const fetched = footerLogo || (await imageUrlToDataUrl(options.logoUrl))
            if (fetched) {
              doc.addImage(fetched.dataUrl, fetched.imgType, w - 180, 40, 120, 60)
            }
          } catch {
            // игнорируем
          }
        }

        const dateRGB = toRGB('#111111', [17, 17, 17])
        doc.setTextColor(dateRGB[0], dateRGB[1], dateRGB[2])
        doc.setFontSize(10)
        doc.text(`Дата: ${formatDate(new Date())}`, 40, 200)
        doc.addPage()
      }

      // autoTable
      const autoTable = (doc as any).autoTable?.bind(doc)
      if (!autoTable) throw new Error('autoTable не подключен')

      // Цвета для таблицы
      const tableHeadBg = toRGB(theme.colors.table.headBg as any, hexToRgb('#ffffff'))
      const tableHeadText = toRGB(theme.colors.table.headText as any, hexToRgb('#111111'))
      const tableBorder = toRGB(theme.colors.table.border as any, hexToRgb('#e5e7eb'))
      const tableRowStripe = theme.colors.table.rowStripe ? toRGB(theme.colors.table.rowStripe as any, hexToRgb('#f1f5f9')) : null
      const textRGB = toRGB(theme.colors.text, hexToRgb('#111111'))
      const primaryRGB = toRGB(theme.colors.primary, hexToRgb('#2563eb'))

      // Колонки
      const cols = buildColumns(options)
      const priceColIdx = cols.findIndex((c) => c.key === 'finalPrice')

      // Предзагрузка изображений для столбца "Фото"
      const imageCache = new Map<string, { dataUrl: string; imgType: 'PNG' | 'JPEG' }>()
      if (cols.some((c) => c.key === 'image')) {
        const urls = new Set<string>()
        for (const g of groups) {
          for (const row of g.items) {
            if (row.imageUrl) urls.add(row.imageUrl)
          }
        }
        for (const url of urls) {
          try {
            const fetched = await imageUrlToDataUrl(url)
            if (fetched) imageCache.set(url, fetched)
          } catch {
            // игнорируем ошибки отдельных картинок
          }
        }
      }

      // Базовый старт Y
      const firstStartY = options.includeCover ? 60 : 40
      let nextStartY: number | undefined = firstStartY

      // Рендер групп
      groups.forEach((group, idx) => {
        // Заголовок группы
        const headerY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 24 : nextStartY
        doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2])
        doc.setFontSize(14)
        doc.text(group.key, options.margin, headerY - 8)
        doc.setFontSize(baseFontSize)
        doc.setTextColor(textRGB[0], textRGB[1], textRGB[2])

        // Данные строк
        const rowsForPdf = group.items.map((row: any) => {
          const res: Record<string, any> = {}
          for (const c of cols) {
            if (c.key === 'image') {
              res[c.key] = row.imageUrl || ''
            } else if (c.key === 'basePrice' || c.key === 'finalPrice') {
              res[c.key] = formatCurrency(c.key === 'basePrice' ? row.basePrice : row.finalPrice, options.currency, options.locale)
            } else {
              res[c.key] = (row as any)[c.key] ?? ''
            }
          }
          return res
        })

        // Итоги по группе
        const groupTotal = group.items.reduce((sum: number, r: any) => sum + (Number(r.finalPrice) || 0), 0)
        const footRow =
          options.showGroupTotals && priceColIdx >= 0
            ? cols.map((_c, i) => {
                if (i === Math.max(0, priceColIdx - 1)) return 'Итого группы'
                if (i === priceColIdx) return formatCurrency(groupTotal, options.currency, options.locale)
                return ''
              })
            : undefined

        // Плотность
        const cellPadding = options.density === 'compact' ? 4 : 6

        // columnStyles — задаём только если колонка 0 = image
        const columnStyles: Record<number, any> = {}
        if (cols[0]?.key === 'image') columnStyles[0] = { cellWidth: 60 }

        autoTable({
          startY: headerY,
          head: [cols.map((c) => c.header)],
          body: rowsForPdf.map((r) => cols.map((c) => r[c.key])),
          ...(footRow ? { foot: [footRow] } : {}),
          margin: options.margin,
          theme: theme.tableTheme,
          styles: {
            font: (doc.getFont && doc.getFont().fontName) || undefined,
            fontStyle: 'normal',
            fontSize: options.density === 'compact' ? baseFontSize - 1 : baseFontSize,
            cellPadding,
            textColor: textRGB,
            lineColor: tableBorder,
            lineWidth: theme.key === 'minimalNordic' ? 0 : 0.2,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: theme.key === 'minimalNordic' ? [255, 255, 255] : tableHeadBg,
            textColor: tableHeadText,
            halign: 'left',
            lineColor: tableBorder,
            lineWidth: theme.key === 'minimalNordic' ? 0 : 0.2,
            fontStyle: theme.key === 'minimalNordic' ? 'bold' : 'normal',
          },
          footStyles: {
            fillColor: theme.key === 'minimalNordic' ? [255, 255, 255] : [245, 245, 245],
            textColor: [17, 17, 17],
            fontStyle: 'bold',
          },
          alternateRowStyles:
            theme.tableTheme !== 'plain' && tableRowStripe
              ? {
                  fillColor: tableRowStripe,
                }
              : undefined,
          didDrawPage: () => {
            const pageNumber = doc.internal.getCurrentPageInfo
              ? doc.internal.getCurrentPageInfo().pageNumber
              : doc.internal.getNumberOfPages()
            const pageCount = doc.internal.getNumberOfPages()
            drawHeaderFooter(doc, pageNumber, pageCount, theme, options.margin, footerLogo)
          },
          didParseCell: (data: any) => {
            if (data.section === 'head') return
            const colIdx = data.column.index
            const key = cols[colIdx]?.key
            if (key === 'image') {
              data.cell.styles.halign = 'center'
              data.cell.minCellHeight = Math.max(28, (data.cell.minCellHeight as number) || 0)
            }
            if (data.section === 'foot') {
              // Выровнять сумму вправо
              if (colIdx === priceColIdx) {
                data.cell.styles.halign = 'right'
              }
            }
          },
          didDrawCell: (data: any) => {
            // Отрисовка миниатюр в ячейке "Фото"
            if (data.section === 'body') {
              const colIdx = data.column.index
              const key = cols[colIdx]?.key
              if (key === 'image') {
                const url = data.cell.raw as string
                if (url && imageCache.has(url)) {
                  const { dataUrl, imgType } = imageCache.get(url)!
                  const padding = 2
                  const x = data.cell.x + padding
                  const y = data.cell.y + padding
                  const w = Math.max(16, data.cell.width - padding * 2)
                  const h = Math.max(16, data.cell.height - padding * 2)
                  const targetW = Math.min(56, w)
                  const targetH = Math.min(40, h)
                  doc.addImage(dataUrl, imgType, x + (w - targetW) / 2, y + (h - targetH) / 2, targetW, targetH)
                  data.cell.text = []
                }
              }
            }
          },
          ...(Object.keys(columnStyles).length ? { columnStyles } : {}),
        } as any)

        // Межгрупповой разрыв (опционально)
        if (options.pageBreakBetweenGroups && idx < groups.length - 1) {
          doc.addPage()
          nextStartY = options.margin + (theme.header.topBand ? theme.header.bandHeight + 18 : 40)
        }
      })

      // Общий итог по всем товарам (PDF)
      if (options.showGrandTotal && cols.length > 0 && priceColIdx >= 0) {
        const grandTotal = computed.reduce((sum, r: any) => sum + (Number(r.finalPrice) || 0), 0)
        const lastY = (doc as any).lastAutoTable?.finalY
        const startY = lastY ? lastY + 24 : (options.includeCover ? 60 : 40)

        const summaryRow = cols.map((_c, i) => {
          if (i === Math.max(0, priceColIdx - 1)) return 'Итого по всем товарам'
          if (i === priceColIdx) return formatCurrency(grandTotal, options.currency, options.locale)
          return ''
        })

        autoTable({
          startY,
          head: undefined,
          body: [summaryRow],
          margin: options.margin,
          theme: 'plain',
          styles: {
            font: (doc.getFont && doc.getFont().fontName) || undefined,
            fontStyle: 'bold',
            fontSize: baseFontSize,
            cellPadding: 6,
            textColor: textRGB,
            lineColor: tableBorder,
          },
          didDrawPage: () => {
            const pageNumber = doc.internal.getCurrentPageInfo
              ? doc.internal.getCurrentPageInfo().pageNumber
              : doc.internal.getNumberOfPages()
            const pageCount = doc.internal.getNumberOfPages()
            drawHeaderFooter(doc, pageNumber, pageCount, theme, options.margin, footerLogo)
          },
          didParseCell: (data: any) => {
            if (data.column.index === priceColIdx) data.cell.styles.halign = 'right'
          },
        } as any)
      }

      // Итоговый файл
      const filename = `PriceList_${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(filename)
    } catch (e: any) {
      setError(e?.message || 'Не удалось сформировать PDF')
    } finally {
      setLoadingPdf(false)
    }
  }, [groups, computed, options, registerFont, drawHeaderFooter, getActiveTheme])

  /**
   * HTML печать: открыть окно печати с особыми стилями
   */
  const handlePrintHtml = useCallback(() => {
    window.print()
  }, [])

  /**
   * Демо: генерация Nordic PDF из готового примера
   */
  const handleNordicDemo = useCallback(async (): Promise<void> => {
    setError(null)
    setLoadingNordicDemo(true)
    try {
      await generateNordicSamplePdf()
    } catch (e: any) {
      setError(e?.message || 'Не удалось сгенерировать демо PDF')
    } finally {
      setLoadingNordicDemo(false)
    }
  }, [])

  const themeForPrint = useMemo(() => getActiveTheme(), [getActiveTheme])

  /**
   * Освободить blob URL тестового PDF
   */
  const revokeTestUrl = useCallback(() => {
    if (pdfDiag.testUrl) {
      try {
        URL.revokeObjectURL(pdfDiag.testUrl)
      } catch {
        // ignore
      }
    }
  }, [pdfDiag.testUrl])

  /**
   * Проверка окружения PDF + генерация тестового PDF в память
   */
  const handleCheckPdf = useCallback(async () => {
    setError(null)
    setFontWarning(null)
    setFontInfo(null)
    // Чистим предыдущий тестовый URL
    revokeTestUrl()
    setPdfDiag({ jsPdf: false, autoTable: false, fontReady: null, lastError: null, testUrl: null })
    try {
      await ensureJsPdf()
      const JsPdfCtor = getJsPdfCtor()
      if (!JsPdfCtor) throw new Error('jsPDF не доступен')

      // Флаг jsPDF
      let jsPdfOk = true
      // Создаём документ
      const doc = new JsPdfCtor({ unit: 'pt', format: 'a4', orientation: 'portrait' })
      // Проверяем autoTable
      const autoTableFn = (doc as any).autoTable?.bind(doc)
      const autoTableOk = Boolean(autoTableFn)
      if (!autoTableOk) throw new Error('Плагин autoTable не найден')

      // Пробуем шрифт
      const fontOk = await registerFont(doc, options.fontUrl, options.fontName).catch(() => false)

      // Рисуем простую тестовую таблицу
      doc.setFontSize(12)
      doc.text('Тестовый PDF (проверка окружения)', 40, 40)
      autoTableFn({
        startY: 60,
        head: [['Колонка A', 'Колонка B']],
        body: [['Значение 1', 'Значение 2']],
        margin: 36,
        theme: 'grid',
        styles: { font: (doc.getFont && doc.getFont().fontName) || undefined, fontSize: 10 },
      })

      // Генерируем blob
      const blob: Blob = doc.output('blob')
      const url = URL.createObjectURL(blob)

      setPdfDiag({
        jsPdf: jsPdfOk,
        autoTable: autoTableOk,
        fontReady: fontOk as boolean,
        lastError: null,
        testUrl: url,
      })
    } catch (e: any) {
      setPdfDiag({
        jsPdf: false,
        autoTable: false,
        fontReady: null,
        lastError: e?.message || 'Не удалось выполнить проверку PDF',
        testUrl: null,
      })
    }
  }, [options.fontUrl, options.fontName, registerFont, revokeTestUrl])

  // Чистим testUrl при размонтировании
  useEffect(() => {
    return () => {
      revokeTestUrl()
    }
  }, [revokeTestUrl])

  return (
    <div className="space-y-6">
      {/* Печатные стили (внедряются единожды) */}
      <PrintStyles
        orientation={options.orientation}
        theme={themeForPrint}
      />

      <div className="flex flex-col xl:flex-row gap-6 no-print">
        {/* Панель настроек */}
        <div className="w-full xl:w-96">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            {/* Стартовый блок */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-base font-semibold text-blue-800">Начните отсюда</h3>
              <p className="text-sm text-blue-700 mt-1">
                Если у вас пустой прайс-лист, загрузите демонстрационные данные, чтобы увидеть все функции в действии.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const demo = {
                        materials: [
                          { id: 'm1', name: 'ЛДСП Белый', article: 'LDSP-W', unit: 'м²', price: 850, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                          { id: 'm2', name: 'Кромка ПВХ 2мм', article: 'PVH-2', unit: 'м.п.', price: 45, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                        ],
                        products: [
                          {
                            id: 'p1',
                            name: 'Тумба подвесная 600 Белая',
                            article: 'TUB-POD-WHITE-600',
                            tech_card: [
                              { materialId: 'm1', quantity: 1.5, _techCardId: 'tc1-1' },
                              { materialId: 'm2', quantity: 4, _techCardId: 'tc1-2' },
                            ],
                            collection_id: 'col1',
                            product_type_id: 'pt1',
                            finish_type_id: 'ft1',
                            image_url: 'https://placehold.co/400x300/e2e8f0/64748b?text=Тумба',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          },
                        ],
                        price_settings: {
                          productTypes: [{ id: 'pt1', name: 'Тумбы', markup: 30, workCost: 1500 }],
                          finishTypes: [{ id: 'ft1', name: 'Стандарт', markup: 0 }],
                        },
                      }
                      localStorage.setItem('wasser_materials', JSON.stringify(demo.materials))
                      localStorage.setItem('wasser_products', JSON.stringify(demo.products))
                      localStorage.setItem('wasser_price_settings', JSON.stringify(demo.price_settings))
                      const toast = document.createElement('div')
                      toast.style.cssText =
                        'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #16a34a; color: white; padding: 10px 14px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 14px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; font-size: 14px;'
                      toast.textContent = 'Демо-данные загружены. Обновите таблицу/настройки.'
                      document.body.appendChild(toast)
                      setTimeout(() => document.body.removeChild(toast), 2600)
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  Загрузить демо-данные
                </button>

                <button
                  type="button"
                  onClick={handleNordicDemo}
                  disabled={loadingNordicDemo}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white ${loadingNordicDemo ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
                  title="Скачать демонстрационный PDF в стиле Nordic"
                  aria-label="Скачать Nordic PDF демо"
                >
                  {loadingNordicDemo ? 'Генерация…' : 'Скачать Nordic PDF (демо)'}
                </button>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900">Настройки прайс-листа</h2>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Бренд</label>
                <input
                  type="text"
                  value={options.brandName}
                  onChange={(e) => updateOption({ brandName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="WASSER PRO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Подзаголовок</label>
                <input
                  type="text"
                  value={options.brandSub}
                  onChange={(e) => updateOption({ brandSub: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Прайс-лист на продукцию"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цвет бренда</label>
                  <input
                    type="text"
                    value={options.brandColor}
                    onChange={(e) => updateOption({ brandColor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="#2563eb"
                  />
                </div>
                <input
                  type="color"
                  value={options.brandColor}
                  onChange={(e) => updateOption({ brandColor: e.target.value })}
                  className="h-10 w-12 border border-gray-300 rounded"
                  title="Выбрать цвет"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логотип (URL)</label>
                <input
                  type="url"
                  value={options.logoUrl}
                  onChange={(e) => updateOption({ logoUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ориентация</label>
                  <select
                    value={options.orientation}
                    onChange={(e) => updateOption({ orientation: e.target.value as Orientation })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="portrait">Книжная</option>
                    <option value="landscape">Альбомная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Поля (pt)</label>
                  <input
                    type="number"
                    min={10}
                    max={40}
                    value={options.margin}
                    onChange={(e) => updateOption({ margin: parseInt(e.target.value || '16', 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Стиль шаблона */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Стиль шаблона</label>
                  <select
                    value={options.styleKey}
                    onChange={(e) => updateOption({ styleKey: e.target.value as ThemeKey })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="gradientModern">Gradient Modern</option>
                    <option value="minimalNordic">Minimal Nordic</option>
                    <option value="executiveBlue">Executive Blue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Плотность таблицы</label>
                  <select
                    value={options.density}
                    onChange={(e) => updateOption({ density: e.target.value as Density })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="normal">Обычная</option>
                    <option value="compact">Компактная</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Группировка</label>
                <select
                  value={options.groupBy}
                  onChange={(e) => updateOption({ groupBy: e.target.value as GroupBy })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="none">Без группировки</option>
                  <option value="productType">По типу изделия</option>
                  <option value="collection">По коллекции</option>
                </select>
              </div>

              {/* ВЫБОР КОЛОНОК */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['image', 'Фото'],
                  ['article', 'Артикул'],
                  ['name', 'Наименование'],
                  ['productType', 'Тип'],
                  ['finishType', 'Отделка'],
                  ['basePrice', 'Себестоимость'],
                  ['finalPrice', 'Цена'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={(options.columns as any)[key]}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          columns: { ...prev.columns, [key]: e.target.checked },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* ВАЛЮТА/ЛОКАЛЬ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                  <input
                    type="text"
                    value={options.currency}
                    onChange={(e) => updateOption({ currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="KGS"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Локаль</label>
                  <input
                    type="text"
                    value={options.locale}
                    onChange={(e) => updateOption({ locale: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="ru-RU"
                  />
                </div>
              </div>

              {/* ПРЕДУСТАНОВЛЕННЫЕ ШРИФТЫ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Предустановленный шрифт (URL)</label>
                <select
                  value={options.fontUrl}
                  onChange={(e) => updateOption({ fontUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {PRESET_FONTS.map((f) => (
                    <option key={f.url} value={f.url}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  В PDF применяются встроенные шрифты темы; эти настройки актуальны для HTML-печати.
                </p>
              </div>

              {/* ПРОИЗВОЛЬНЫЙ URL ШРИФТА */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Шрифт (TTF, URL)</label>
                <input
                  type="url"
                  value={options.fontUrl}
                  onChange={(e) => updateOption({ fontUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Regular.ttf"
                />
              </div>

              {/* ЛОКАЛЬНЫЙ ФАЙЛ ШРИФТА */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Загрузить TTF-файл (офлайн)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".ttf"
                    onChange={(e) => handleFontFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-300 file:bg-white hover:file:bg-gray-50"
                  />
                  {options.fontBinary && (
                    <button
                      type="button"
                      onClick={() => handleFontFile(null)}
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                      title="Сбросить локальный шрифт"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Для PDF шрифты шаблонов подгружаются автоматически; локальные шрифты полезны для HTML-печати.
                </p>
                {options.fontFileName && <p className="text-xs text-green-700 mt-1">Загружен: {options.fontFileName}</p>}
              </div>

              {/* ПРОЧЕЕ */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={options.includeCover} onChange={(e) => updateOption({ includeCover: e.target.checked })} />
                  Обложка (PDF)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={options.showFooter} onChange={(e) => updateOption({ showFooter: e.target.checked })} />
                  Нумерация (PDF)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={options.pageBreakBetweenGroups} onChange={(e) => updateOption({ pageBreakBetweenGroups: e.target.checked })} />
                  Разрыв между группами (PDF)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={options.showGroupTotals} onChange={(e) => updateOption({ showGroupTotals: e.target.checked })} />
                  Итоги по группе
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={options.showGrandTotal} onChange={(e) => updateOption({ showGrandTotal: e.target.checked })} />
                  Общий итог
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={loadingPdf}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white ${
                    loadingPdf ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loadingPdf ? 'Формирование…' : 'Скачать PDF'}
                </button>

                <button
                  type="button"
                  onClick={handlePrintHtml}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                  title="Печать HTML-версии с особыми стилями печати"
                >
                  Печать (HTML)
                </button>
              </div>

              {/* Сообщения/предупреждения */}
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
              {fontWarning && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{fontWarning}</div>}
              {fontInfo && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{fontInfo}</div>}

              {/* Диагностика PDF */}
              <div className="mt-2 border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Проверка PDF</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${pdfDiag.jsPdf ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      jsPDF {pdfDiag.jsPdf ? 'OK' : '—'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${pdfDiag.autoTable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      autoTable {pdfDiag.autoTable ? 'OK' : '—'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      pdfDiag.fontReady === true ? 'bg-green-100 text-green-700' :
                      pdfDiag.fontReady === false ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      Шрифт {pdfDiag.fontReady === null ? '—' : pdfDiag.fontReady ? 'OK' : 'fallback'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCheckPdf}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                  >
                    Проверить PDF
                  </button>
                  {pdfDiag.testUrl && (
                    <a
                      href={pdfDiag.testUrl}
                      download="PriceList_Test.pdf"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                    >
                      Скачать тестовый PDF
                    </a>
                  )}
                </div>

                {pdfDiag.lastError && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    {pdfDiag.lastError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Превью сведений */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Предпросмотр данных</h3>
            <div className="text-sm text-gray-600 mb-3">
              Товаров: <span className="font-medium text-gray-900">{computed.length}</span> • Групп:{' '}
              <span className="font-medium text-gray-900">{groups.length}</span> • Колонок:{' '}
              <span className="font-medium text-gray-900">{Object.values(options.columns).filter(Boolean).length}</span>
            </div>

            {/* Маленькая превью-лента стиля */}
            <StylePreviewBar styleKey={options.styleKey} brandColor={options.brandColor} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
              {groups.slice(0, 3).map((g) => (
                <div key={g.key} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-2">{g.key}</div>
                  <ul className="space-y-1 text-sm text-gray-700 max-h-48 overflow-auto">
                    {g.items.slice(0, 6).map((it: any) => (
                      <li key={it.id} className="flex items-center justify-between">
                        <span className="truncate mr-2">{it.name}</span>
                        <span className="font-mono text-xs text-gray-500">{it.article}</span>
                      </li>
                    ))}
                    {g.items.length > 6 && <li className="text-xs text-gray-400">… и ещё {g.items.length - 6}</li>}
                  </ul>
                </div>
              ))}
            </div>
            {groups.length === 0 && <div className="text-sm text-gray-500">Нет данных для отображения</div>}
          </div>
        </div>
      </div>

      {/* ПЕЧАТНАЯ ОБЛАСТЬ — ВИДНА ТОЛЬКО ПРИ ПЕЧАТИ */}
      <div id="price-print-root" className="print-only">
        <PrintPreviewHtml
          brandName={options.brandName}
          brandSub={options.brandSub}
          brandColor={options.brandColor}
          groups={groups}
          columns={colsForPrint}
          currency={options.currency}
          locale={options.locale}
          theme={themeForPrint}
          logoUrl={options.logoUrl}
          showGroupTotals={options.showGroupTotals}
          showGrandTotal={options.showGrandTotal}
        />
      </div>
    </div>
  )
}

/**
 * Полоска-превью стиля темы (экран)
 */
function StylePreviewBar({ styleKey, brandColor }: { styleKey: ThemeKey; brandColor: string }) {
  /** Возврат inline превью по теме */
  const getPreview = (key: ThemeKey) => {
    const c = brandColor || (THEMES[key].colors.primary as string)
    if (key === 'gradientModern') {
      return (
        <div className="mt-1">
          <div className="h-2 rounded-full" style={{ background: c }} />
          <div className="mt-2 grid grid-cols-12 gap-[1px] bg-blue-100 p-[1px] rounded">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`h-2 ${i % 2 ? 'bg-white/70' : 'bg-white'}`} />
            ))}
          </div>
        </div>
      )
    }
    if (key === 'minimalNordic') {
      return (
        <div className="mt-1">
          <div className="h-[2px] rounded-full bg-gray-300" />
          <div className="mt-2 grid grid-cols-12 gap-[1px] p-[1px] rounded">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`h-2 ${i % 2 ? 'bg-gray-100' : 'bg-white'}`} />
            ))}
          </div>
        </div>
      )
    }
    // executiveBlue
    return (
      <div className="mt-1">
        <div className="h-[2px] rounded-full" style={{ background: c }} />
        <div className="mt-2 grid grid-cols-12 gap-[1px] bg-indigo-100 p-[1px] rounded">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`h-2 ${i % 2 ? 'bg-indigo-50' : 'bg-white'}`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">Предпросмотр стиля</div>
      {getPreview(styleKey)}
    </div>
  )
}

/**
 * Компонент: стили печати. Инжектит @media print, @page, цветовые переменные.
 * Дополнено: стили для миниатюр .thumb
 */
function PrintStyles({ orientation, theme }: { orientation: Orientation; theme: PdfTheme }) {
  // Нормализуем цвета в rgb(r,g,b)
  const brand = toRGB(theme.colors.primary, [37, 99, 235])
  const headBg = toRGB(theme.colors.table.headBg as any, [255, 255, 255])
  const headText = toRGB(theme.colors.table.headText as any, [17, 17, 17])
  const rowStripe = theme.colors.table.rowStripe ? toRGB(theme.colors.table.rowStripe as any, [241, 245, 249]) : null
  const border = toRGB(theme.colors.table.border as any, [229, 231, 235])
  const text = toRGB(theme.colors.text as any, [17, 17, 17])

  const css = `
    @media screen {
      .print-only { display: none !important; }
      .no-print { display: block !important; }
    }
    @media print {
      @page {
        size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'};
        margin: 12mm;
      }
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
    }
    #price-print-root {
      --brand: rgb(${brand[0]}, ${brand[1]}, ${brand[2]});
      --text: rgb(${text[0]}, ${text[1]}, ${text[2]});
      --head-bg: rgb(${headBg[0]}, ${headBg[1]}, ${headBg[2]});
      --head-text: rgb(${headText[0]}, ${headText[1]}, ${headText[2]});
      --row-stripe: ${rowStripe ? `rgb(${rowStripe[0]}, ${rowStripe[1]}, ${rowStripe[2]})` : 'transparent'};
      --border: rgb(${border[0]}, ${border[1]}, ${border[2]});
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Noto Sans', Arial, sans-serif;
      color: var(--text);
    }
    #price-print-root .brand-band {
      height: ${theme.header.topBand ? '18mm' : '0'};
      background: var(--brand);
      color: white;
    }
    #price-print-root .brand-title {
      font-size: 16pt;
      font-weight: 700;
    }
    #price-print-root .brand-sub {
      font-size: 10pt;
      opacity: 0.95;
    }
    #price-print-root .group-title {
      color: var(--brand);
      font-weight: 700;
      font-size: 12pt;
      margin: 8mm 0 3mm 0;
    }
    #price-print-root table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      page-break-inside: auto;
    }
    #price-print-root thead {
      background: ${theme.key === 'minimalNordic' ? 'transparent' : 'var(--head-bg)'};
      color: var(--head-text);
    }
    #price-print-root th, #price-print-root td {
      border: ${theme.tableTheme === 'grid' ? '0.4pt solid var(--border)' : theme.tableTheme === 'plain' ? '0.4pt solid transparent' : '0.4pt solid var(--border)'};
      padding: ${theme.key === 'executiveBlue' ? '6pt 6pt' : '6pt 8pt'};
      vertical-align: top;
      word-break: break-word;
    }
    #price-print-root th {
      text-align: left;
      font-weight: ${theme.key === 'minimalNordic' ? 700 : 600};
    }
    #price-print-root tbody tr:nth-child(even) {
      background: ${theme.tableTheme !== 'plain' && rowStripe ? 'var(--row-stripe)' : 'transparent'};
    }
    #price-print-root .price {
      font-weight: 700;
      color: var(--brand);
      white-space: nowrap;
    }
    #price-print-root tfoot td {
      font-weight: 700;
      background: #f5f5f5;
    }
    #price-print-root .footer {
      margin-top: 6mm;
      font-size: 9pt;
      color: #6b7280;
      text-align: right;
    }
    #price-print-root .group {
      page-break-inside: avoid;
      margin-bottom: 6mm;
    }
    #price-print-root td .thumb {
      width: 24mm;
      height: 16mm;
      object-fit: cover;
      border-radius: 2mm;
      border: 0.3pt solid var(--border);
      display: block;
    }
  `
  return <style data-print-styles dangerouslySetInnerHTML={{ __html: css }} />
}

/**
 * Компонент печати HTML: формирует разметку из групп и колонок под активную тему
 * Дополнено: миниатюры для image; общий итог
 */
function PrintPreviewHtml(props: {
  brandName: string
  brandSub: string
  brandColor: string
  groups: Array<{ key: string; items: any[] }>
  columns: Array<{ header: string; key: string }>
  currency: string
  locale: string
  theme: PdfTheme
  logoUrl?: string
  showGroupTotals?: boolean
  showGrandTotal?: boolean
}) {
  const { brandName, brandSub, groups, columns, currency, locale, theme, logoUrl, showGroupTotals, showGrandTotal } = props

  /** Форматирование ячеек печати */
  const renderCell = (row: any, key: string) => {
    if (key === 'image') {
      return row.imageUrl ? (
        <img
          src={row.imageUrl}
          className="thumb object-cover"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement
            img.style.display = 'none'
          }}
        />
      ) : ''
    }
    if (key === 'basePrice') {
      return formatCurrency(row.basePrice, currency, locale)
    }
    if (key === 'finalPrice') {
      return <span className="price">{formatCurrency(row.finalPrice, currency, locale)}</span>
    }
    return (row as any)[key] ?? ''
  }

  const priceIdx = columns.findIndex((c) => c.key === 'finalPrice')

  // Общий итог (HTML)
  const grandTotal = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.items.reduce((s, r: any) => s + (Number(r.finalPrice) || 0), 0), 0)
  }, [groups])

  return (
    <div>
      {/* Верхняя полоса (если у темы есть) */}
      {theme.header.topBand && <div className="brand-band" />}

      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8mm', margin: '6mm 0 4mm 0' }}>
        <div style={{ flex: 1 }}>
          <div className="brand-title">{brandName}</div>
          <div className="brand-sub">{brandSub}</div>
          <div style={{ fontSize: '8.5pt', color: '#6b7280', marginTop: '1.5mm' }}>
            Дата: {formatDate(new Date())}
          </div>
        </div>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ width: '28mm', height: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
            }}
          />
        ) : null}
      </div>

      {/* Разделительная линия (для тем с underline) */}
      {theme.header.underline && (
        <div style={{ height: '1pt', background: 'var(--brand)', opacity: 0.9, marginBottom: '4mm' }} />
      )}

      {/* Группы */}
      {groups.map((g) => {
        const groupTotal = g.items.reduce((sum, r: any) => sum + (Number(r.finalPrice) || 0), 0)
        return (
          <div className="group" key={g.key}>
            <div className="group-title">{g.key}</div>
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.items.map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={c.key}>{renderCell(row, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {showGroupTotals && priceIdx >= 0 && (
                <tfoot>
                  <tr>
                    {columns.map((c, i) => {
                      if (i === Math.max(0, priceIdx - 1)) return <td key={c.key}>Итого группы</td>
                      if (i === priceIdx) return <td key={c.key} style={{ textAlign: 'right' }}>{formatCurrency(groupTotal, currency, locale)}</td>
                      return <td key={c.key}></td>
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )
      })}

      {/* Общий итог по всем товарам */}
      {showGrandTotal && priceIdx >= 0 && (
        <div style={{ marginTop: '6mm', fontSize: '10pt' }}>
          <table>
            <tbody>
              <tr>
                {columns.map((c, i) => {
                  if (i === Math.max(0, priceIdx - 1)) return <td key={c.key} style={{ fontWeight: 700 }}>Итого по всем товарам</td>
                  if (i === priceIdx) return <td key={c.key} style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(grandTotal, currency, locale)}</td>
                  return <td key={c.key}></td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Низ */}
      <div className="footer">Сформировано: {formatDate(new Date())}</div>
    </div>
  )
}
