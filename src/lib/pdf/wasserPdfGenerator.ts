/**
 * WasserPDFGenerator — генератор PDF прайс‑листов с 3 шаблонами (modern, nordic, executive).
 * Обновления:
 * - Жирные заголовки таблиц
 * - Подсветка бренд-цветом колонки "Цена"
 * - Лого в футере каждой страницы (если задано)
 * - Итоги по серии (опционально)
 * - Общий итог по всем сериям (опционально)
 * - Примечание внизу последней страницы (footerNote)
 */

import { ensureJsPdf, getJsPdfCtor } from './loader'

/**
 * Тип шаблона PDF
 */
export type PdfTemplate = 'modern' | 'nordic' | 'executive'

/**
 * Данные компании для шапки/обложки
 */
export interface CompanyData {
  /** Название компании */
  name: string
  /** Теглайн/описание */
  tagline?: string
  /** Адрес */
  address?: string
  /** Телефон */
  phone?: string
  /** Email */
  email?: string
  /** Сайт */
  website?: string
  /** Ответственный менеджер */
  manager?: {
    name?: string
    phone?: string
    email?: string
  }
  /** URL логотипа (опционально) */
  logoUrl?: string
}

/**
 * Данные документа (метаданные и поведенческие флаги)
 */
export interface DocumentData {
  /** Заголовок документа */
  title: string
  /** Версия документа */
  version?: string
  /** Дата (строка) */
  date?: string
  /** Спецпредложение / плашка */
  specialOffer?: string
  /** Валюта для сумм */
  currency?: string
  /** Локаль форматирования */
  locale?: string
  /** Ориентация */
  orientation?: 'portrait' | 'landscape'
  /** Включать ли обложку */
  includeCover?: boolean
  /** Переопределение бренд-цвета темы */
  brandColor?: string
  /** Показать итог по каждой серии (табличный foot) */
  showGroupTotals?: boolean
  /** Показать общий итог по всем сериям */
  showGrandTotal?: boolean
  /** Текст‑примечание внизу последней страницы */
  footerNote?: string
}

/**
 * Позиция прайс-листа (строка таблицы)
 */
export interface SeriesItem {
  article: string
  name: string
  type?: string
  dimensions?: string
  material?: string
  color?: string
  price: number
  imageUrl?: string
}

/**
 * Серия (группа товаров)
 */
export interface ProductSeries {
  series: string
  seriesDesc?: string
  items: SeriesItem[]
}

/**
 * Входные данные генератора
 */
export interface GenerateInput {
  companyData: CompanyData
  documentData: DocumentData
  products: ProductSeries[]
}

/**
 * Внутренняя палитра темы
 */
interface Theme {
  key: PdfTemplate
  brand: string
  text: string
  headerText: string
  table: {
    headBg: string | number[]
    headText: string | number[]
    rowStripe?: string | number[]
    border?: string | number[]
  }
  header: {
    topBand: boolean
    bandHeight: number
    underline: boolean
  }
  tableTheme: 'striped' | 'grid' | 'plain'
  /** Размеры шрифтов */
  fontSizes: {
    brand: number
    sub: number
    base: number
    hGroup: number
  }
  /** Рекомендуемый URL шрифта (TTF) */
  fontUrl: string
  /** Имя шрифта в jsPDF */
  fontName: string
}

/**
 * Набор тем (точное соответствие трем шаблонам)
 */
const THEMES: Record<PdfTemplate, Theme> = {
  modern: {
    key: 'modern',
    brand: '#2563eb',
    text: '#111111',
    headerText: '#ffffff',
    table: {
      headBg: '#2563eb',
      headText: [255, 255, 255],
      rowStripe: '#f1f5f9',
      border: '#e5e7eb',
    },
    header: {
      topBand: true,
      bandHeight: 24,
      underline: false,
    },
    tableTheme: 'striped',
    fontSizes: { brand: 12, sub: 9, base: 10, hGroup: 14 },
    fontUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk-Regular.ttf',
    fontName: 'SpaceGrotesk',
  },
  nordic: {
    key: 'nordic',
    brand: '#0f172a',
    text: '#111111',
    headerText: '#111111',
    table: {
      headBg: '#ffffff',
      headText: [17, 17, 17],
      rowStripe: '#fafafa',
      border: '#e5e7eb',
    },
    header: {
      topBand: false,
      bandHeight: 0,
      underline: true,
    },
    tableTheme: 'plain',
    fontSizes: { brand: 12, sub: 9, base: 10, hGroup: 14 },
    fontUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bwght%5D.ttf',
    fontName: 'Inter',
  },
  executive: {
    key: 'executive',
    brand: '#1d4ed8',
    text: '#111111',
    headerText: '#ffffff',
    table: {
      headBg: '#1d4ed8',
      headText: [255, 255, 255],
      rowStripe: '#eef2ff',
      border: '#c7d2fe',
    },
    header: {
      topBand: false,
      bandHeight: 0,
      underline: true,
    },
    tableTheme: 'grid',
    fontSizes: { brand: 12, sub: 9, base: 10, hGroup: 14 },
    fontUrl: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
    fontName: 'Roboto',
  },
}

/** Кэш подключенных шрифтов */
const loadedFonts = new Set<string>()

/**
 * Преобразование HEX (#rrggbb) в [r,g,b]
 */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
  if (!m) return [0, 0, 0]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/**
 * Любой цвет -> [r,g,b]
 */
function toRGB(color: string | number[] | undefined, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (!color) return fallback
  if (Array.isArray(color) && color.length >= 3) {
    return [Number(color[0]) || 0, Number(color[1]) || 0, Number(color[2]) || 0]
  }
  if (typeof color === 'string') return hexToRgb(color)
  return fallback
}

/**
 * ArrayBuffer -> бинарная строка (для addFileToVFS)
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
 * Формат валюты
 */
function formatCurrency(amount: number, currency = 'KGS', locale = 'ru-RU'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount || 0)
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`
  }
}

/**
 * Загрузка и регистрация TTF-шрифта в jsPDF
 */
async function registerFont(doc: any, url: string, fontName: string): Promise<boolean> {
  try {
    if (!loadedFonts.has(fontName)) {
      const resp = await fetch(url, { cache: 'no-store', mode: 'cors' as RequestMode })
      if (!resp.ok) throw new Error('font fetch failed')
      const buffer = await resp.arrayBuffer()
      const binary = arrayBufferToBinaryString(buffer)
      doc.addFileToVFS(`${fontName}.ttf`, binary)
      doc.addFont(`${fontName}.ttf`, fontName, 'normal')
      loadedFonts.add(fontName)
    }
    doc.setFont(fontName, 'normal')
    return true
  } catch {
    // fallback на встроенный Helvetica
    doc.setFont('helvetica', 'normal')
    return false
  }
}

/**
 * Тип для кэшированного изображения (логотип)
 */
type CachedImage = { dataUrl: string; imgType: 'PNG' | 'JPEG' }

/**
 * WasserPDFGenerator — основной класс генерации
 */
export class WasserPDFGenerator {
  /**
   * Сгенерировать и сохранить PDF (скачивание)
   */
  async generateAndSave(input: GenerateInput, template: PdfTemplate, filename?: string): Promise<void> {
    const doc = await this.generateDoc(input, template)
    const name = filename || `PriceList_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(name)
  }

  /**
   * Сгенерировать PDF и вернуть Blob
   */
  async generateBlob(input: GenerateInput, template: PdfTemplate): Promise<Blob> {
    const doc = await this.generateDoc(input, template)
    return doc.output('blob')
  }

  /**
   * Внутренний метод: формирование jsPDF документа
   * Логика:
   * - выбор темы и шрифта
   * - опциональная обложка
   * - таблицы по сериям с итогами
   * - общий итог (опционально)
   * - footerNote на последней странице (опционально)
   */
  private async generateDoc(input: GenerateInput, template: PdfTemplate): Promise<any> {
    await ensureJsPdf()
    const JsPdfCtor = getJsPdfCtor()
    if (!JsPdfCtor) throw new Error('jsPDF не доступен')

    // Базовая тема и возможные переопределения
    const base = THEMES[template]
    const overrideBrand = input.documentData.brandColor?.trim()
    const theme: Theme = overrideBrand ? { ...base, brand: overrideBrand } : base

    const currency = input.documentData.currency || 'KGS'
    const locale = input.documentData.locale || 'ru-RU'
    const orientation = input.documentData.orientation || 'portrait'

    const doc = new JsPdfCtor({
      unit: 'pt',
      format: 'a4',
      orientation,
      compress: true,
    })

    // Шрифт
    await registerFont(doc, theme.fontUrl, theme.fontName)

    // Предзагрузка логотипа (для футера/обложки)
    const footerLogo: CachedImage | null =
      input.companyData.logoUrl ? await this.fetchImageToDataUrl(input.companyData.logoUrl) : null

    // Обложка — по флагу includeCover (по умолчанию вкл)
    if (input.documentData.includeCover !== false) {
      await this.drawCover(doc, theme, input, footerLogo)
    }

    // Таблицы по сериям
    const margin = 36
    const autoTable = (doc as any).autoTable?.bind(doc)
    if (!autoTable) throw new Error('jspdf-autotable не подключен')

    // Параметры цветов таблицы
    const headBg = toRGB(theme.table.headBg as any, [255, 255, 255])
    const headText = toRGB(theme.table.headText as any, [17, 17, 17])
    const border = toRGB(theme.table.border as any, [229, 231, 235])
    const rowStripe = theme.table.rowStripe ? toRGB(theme.table.rowStripe as any, [241, 245, 249]) : null
    const text = toRGB(theme.text, [17, 17, 17])
    const brand = toRGB(theme.brand, [37, 99, 235])

    const cols = ['Артикул', 'Наименование', 'Вид', 'Габариты', 'Материал', 'Цвет', `Цена (${currency})`]
    const priceColIdx = cols.length - 1

    // Начальная позиция
    let nextStartY = 60

    // Итог для всех серий
    let grandTotal = 0

    input.products.forEach((series, _seriesIdx) => {
      // Заголовок группы
      const lastY = (doc as any).lastAutoTable?.finalY
      const headerY = lastY ? lastY + 24 : nextStartY

      // Название серии и описание
      doc.setTextColor(brand[0], brand[1], brand[2])
      doc.setFontSize(theme.fontSizes.hGroup)
      doc.text(series.series || 'Серия', margin, headerY - 8)
      doc.setFontSize(theme.fontSizes.base)
      doc.setTextColor(text[0], text[1], text[2])
      if (series.seriesDesc) {
        doc.setFontSize(9.5)
        doc.setTextColor(120)
        doc.text(series.seriesDesc, margin, headerY + 4)
      }
      doc.setFontSize(theme.fontSizes.base)
      doc.setTextColor(text[0], text[1], text[2])

      // Данные таблицы
      const body = series.items.map((it) => [
        it.article || '',
        it.name || '',
        it.type || '',
        it.dimensions || '',
        it.material || '',
        it.color || '',
        formatCurrency(it.price, currency, locale),
      ])

      // Подсчет итогов серии и накопление общего итога
      const seriesTotal = series.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0)
      grandTotal += seriesTotal

      // Плотность и стили
      const cellPadding = 6

      // Итоговая строка для серии (опционально)
      const footRow =
        input.documentData.showGroupTotals
          ? cols.map((_c, i) => {
              if (i === Math.max(0, priceColIdx - 1)) return 'Итого серии'
              if (i === priceColIdx) return formatCurrency(seriesTotal, currency, locale)
              return ''
            })
          : undefined

      autoTable({
        startY: headerY + (series.seriesDesc ? 12 : 0),
        head: [cols],
        body,
        ...(footRow ? { foot: [footRow] } : {}),
        margin,
        theme: theme.tableTheme,
        styles: {
          font: (doc.getFont && doc.getFont().fontName) || undefined,
          fontStyle: 'normal',
          fontSize: theme.fontSizes.base,
          cellPadding,
          textColor: text,
          lineColor: border,
          lineWidth: theme.key === 'nordic' ? 0 : 0.2,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: theme.key === 'nordic' ? [255, 255, 255] : headBg,
          textColor: headText,
          halign: 'left',
          lineColor: border,
          lineWidth: theme.key === 'nordic' ? 0 : 0.2,
          // Шапка всегда жирная
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: theme.key === 'nordic' ? [255, 255, 255] : [245, 245, 245],
          textColor: [17, 17, 17],
          fontStyle: 'bold',
        },
        alternateRowStyles:
          theme.tableTheme !== 'plain' && rowStripe
            ? {
                fillColor: rowStripe,
              }
            : undefined,
        didDrawPage: () => {
          const pageNumber = doc.internal.getCurrentPageInfo
            ? doc.internal.getCurrentPageInfo().pageNumber
            : doc.internal.getNumberOfPages()
          const pageCount = doc.internal.getNumberOfPages()
          drawHeaderFooter(doc, pageNumber, pageCount, theme, margin, input.companyData, input.documentData, footerLogo)
        },
        didParseCell: (data: any) => {
          // Подсветка колонки "Цена" (тело)
          if (data.section === 'body' && data.column.index === priceColIdx) {
            data.cell.styles.textColor = brand
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.halign = 'right'
          }
          // Выравнивание итогов серии
          if (data.section === 'foot' && data.column.index === priceColIdx) {
            data.cell.styles.halign = 'right'
            data.cell.styles.textColor = brand
          }
        },
      } as any)

      // Между группами — отступ (autotable сам переносит при необходимости)
      nextStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : nextStartY
    })

    // Общий итог по всем сериям (опционально)
    if (input.documentData.showGrandTotal && input.products.length > 0) {
      const autoTable = (doc as any).autoTable?.bind(doc)
      const lastY = (doc as any).lastAutoTable?.finalY
      const startY = lastY ? lastY + 24 : 60

      const summaryRow = cols.map((_c, i) => {
        if (i === Math.max(0, priceColIdx - 1)) return 'Итого по всем сериям'
        if (i === priceColIdx) return formatCurrency(grandTotal, currency, locale)
        return ''
      })

      autoTable({
        startY,
        head: undefined,
        body: [summaryRow],
        margin,
        theme: 'plain',
        styles: {
          font: (doc.getFont && doc.getFont().fontName) || undefined,
          fontStyle: 'bold',
          fontSize: theme.fontSizes.base,
          cellPadding: 6,
          textColor: text,
          lineColor: border,
        },
        didDrawPage: () => {
          const pageNumber = doc.internal.getCurrentPageInfo
            ? doc.internal.getCurrentPageInfo().pageNumber
            : doc.internal.getNumberOfPages()
          const pageCount = doc.internal.getNumberOfPages()
          drawHeaderFooter(doc, pageNumber, pageCount, theme, margin, input.companyData, input.documentData, footerLogo)
        },
        didParseCell: (data: any) => {
          if (data.column.index === priceColIdx) data.cell.styles.halign = 'right'
          // Подсветка суммы в общем итоге
          if (data.column.index === priceColIdx) data.cell.styles.textColor = brand
        },
      } as any)
    }

    // Footer note на последней странице (если задан)
    if (input.documentData.footerNote) {
      const pageCount = doc.internal.getNumberOfPages()
      doc.setPage(pageCount)
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(9)
      doc.setTextColor(100)
      const text = input.documentData.footerNote
      doc.text(text, w / 2, h - 26, { align: 'center', maxWidth: w - 120 })
    }

    return doc
  }

  /**
   * Рисование обложки с учетом темы
   * Используется общий helper для загрузки логотипа
   */
  private async drawCover(doc: any, theme: Theme, input: GenerateInput, cachedLogo: CachedImage | null): Promise<void> {
    const w = doc.internal.pageSize.getWidth()
    const brand = toRGB(theme.brand, [37, 99, 235])

    // Цветная верхняя область у modern, у остальных — тонкая линия и чистая обложка
    if (theme.key === 'modern') {
      const bandHeight = Math.max(120, theme.header.bandHeight * 6)
      doc.setFillColor(brand[0], brand[1], brand[2])
      doc.rect(0, 0, w, bandHeight, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(26)
      doc.text(input.companyData.name || 'WASSER', 40, 70)
      doc.setFontSize(14)
      doc.text(input.documentData.title || 'ПРАЙС-ЛИСТ', 40, 100)
    } else {
      // Строго/минимально
      doc.setDrawColor(brand[0], brand[1], brand[2])
      doc.setLineWidth(1.2)
      doc.line(40, 48, w - 40, 48)
      doc.setTextColor(brand[0], brand[1], brand[2])
      doc.setFontSize(22)
      doc.text(input.companyData.name || 'WASSER', 40, 36)
      doc.setTextColor(17, 17, 17)
      doc.setFontSize(14)
      doc.text(input.documentData.title || 'ПРАЙС-ЛИСТ', 40, 72)
    }

    // Метаданные/дата/версия/плашка
    const subY = theme.key === 'modern' ? 130 : 96
    doc.setTextColor(17, 17, 17)
    doc.setFontSize(10)
    if (input.documentData.version) {
      doc.text(`Версия: ${input.documentData.version}`, 40, subY)
    }
    if (input.documentData.date) {
      doc.text(`Действителен с: ${input.documentData.date}`, 40, subY + 16)
    }
    if (input.documentData.specialOffer) {
      const y = subY + 36
      const pill = [241, 245, 249] as [number, number, number]
      doc.setFillColor(pill[0], pill[1], pill[2])
      const pillWidth = Math.min(420, (input.documentData.specialOffer.length * 6) + 24)
      doc.roundedRect(40, y - 12, pillWidth, 24, 6, 6, 'F')
      doc.setTextColor(brand[0], brand[1], brand[2])
      doc.setFontSize(11)
      doc.text(input.documentData.specialOffer, 52, y + 3)
    }

    // Контакты справа
    const rightX = w - 200
    let line = subY
    const c = input.companyData
    doc.setTextColor(107, 114, 128)
    doc.setFontSize(10)
    if (c.address) {
      doc.text(c.address, rightX, line); line += 14
    }
    if (c.phone) {
      doc.text(c.phone, rightX, line); line += 14
    }
    if (c.email) {
      doc.text(c.email, rightX, line); line += 14
    }
    if (c.website) {
      doc.text(c.website, rightX, line); line += 14
    }

    // Лого (если есть)
    const logo = cachedLogo || (c.logoUrl ? await this.fetchImageToDataUrl(c.logoUrl) : null)
    if (logo) {
      try {
        doc.addImage(logo.dataUrl, logo.imgType, w - 180, 40, 120, 60)
      } catch {
        // игнорируем
      }
    }

    // Менеджер
    if (c.manager?.name || c.manager?.phone || c.manager?.email) {
      const y = subY + 72
      doc.setTextColor(17, 17, 17)
      doc.setFontSize(11)
      doc.text('Менеджер по работе с клиентами', 40, y)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(12)
      if (c.manager?.name) doc.text(c.manager.name, 40, y + 18)
      doc.setTextColor(107, 114, 128)
      doc.setFontSize(10)
      if (c.manager?.phone) doc.text(c.manager.phone, 40, y + 34)
      if (c.manager?.email) doc.text(c.manager.email, 40, y + 48)
    }

    // Конец обложки -> новая страница
    doc.addPage()
  }

  /**
   * Загрузить изображение по URL и вернуть dataURL + тип
   */
  private async fetchImageToDataUrl(url: string): Promise<CachedImage | null> {
    try {
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) return null
      const blob = await resp.blob()
      const buf = await blob.arrayBuffer()
      const uint8 = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)
      const dataUrl = `data:${blob.type};base64,${base64}`
      const isPng = /png/i.test(blob.type)
      const isJpg = /jpe?g/i.test(blob.type)
      const imgType: 'PNG' | 'JPEG' = isPng ? 'PNG' : isJpg ? 'JPEG' : 'PNG'
      return { dataUrl, imgType }
    } catch {
      return null
    }
  }
}

/**
 * Рисование шапки/футера на странице
 * Обновлено: мини-логотип в футере (слева), нумерация справа.
 */
function drawHeaderFooter(
  doc: any,
  pageNumber: number,
  pageCount: number,
  theme: Theme,
  margin: number,
  company: CompanyData,
  documentData: DocumentData,
  footerLogo?: CachedImage | null,
) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  // Верхняя полоса (modern)
  if (theme.header.topBand) {
    const band = toRGB(theme.brand, [37, 99, 235])
    doc.setFillColor(band[0], band[1], band[2])
    doc.rect(0, 0, w, theme.header.bandHeight, 'F')
  }
  // Подчеркивание (nordic/executive)
  if (theme.header.underline) {
    const brand = toRGB(theme.brand, [37, 99, 235])
    doc.setDrawColor(brand[0], brand[1], brand[2])
    doc.setLineWidth(theme.key === 'nordic' ? 0.5 : 0.8)
    doc.line(margin, margin - 4, w - margin, margin - 4)
  }

  // Бренд
  const brandRGB = toRGB(theme.brand, [37, 99, 235])
  if (theme.header.topBand) {
    doc.setTextColor(255, 255, 255)
  } else {
    doc.setTextColor(brandRGB[0], brandRGB[1], brandRGB[2])
  }
  doc.setFontSize(theme.fontSizes.brand)
  const brandY = theme.header.topBand ? Math.max(14, theme.header.bandHeight - 6) : margin
  doc.text(company.name || 'WASSER', margin, brandY)

  // Подзаголовок
  const subRGB: [number, number, number] = [17, 17, 17]
  doc.setTextColor(subRGB[0], subRGB[1], subRGB[2])
  doc.setFontSize(theme.fontSizes.sub)
  const subtitle = documentData.title || company.tagline || ''
  if (subtitle) doc.text(subtitle, margin, brandY + 8)

  // Футер: мини-лого + нумерация
  if (footerLogo?.dataUrl) {
    try {
      const imgW = 36
      const imgH = 18
      doc.addImage(footerLogo.dataUrl, footerLogo.imgType, margin, h - imgH - 14, imgW, imgH)
    } catch {
      // ignore
    }
  }
  doc.setFontSize(9)
  const foot: [number, number, number] = [107, 114, 128]
  doc.setTextColor(foot[0], foot[1], foot[2])
  doc.text(`Стр. ${pageNumber} из ${pageCount}`, w - margin, h - 10, { align: 'right' })
}
