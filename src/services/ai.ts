/**
 * AiService — фронтенд-обёртка для вызовов AI (Claude) с офлайн-fallback.
 * Если /api/ai/claude недоступен (403/404/Network), используется детерминированная локальная генерация.
 */

export interface MaterialsCatalogItem {
  /** Имя материала (для сопоставления по названию) */
  name: string
  /** Артикул (основной ключ сопоставления) */
  article?: string
  /** Единица измерения */
  unit?: string
  /** Цена (необязательно) */
  price?: number
}

/** Результат подсказки ТД (AI) */
export interface AiTechCardItem {
  /** Имя (может отличаться от каталога) */
  name: string
  /** Артикул (если известен) */
  article?: string
  /** Количество */
  quantity: number
  /** Единица измерения */
  unit?: string
}

/** Общий ответ API */
interface AiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * Вспомогательные утилиты для локального fallback
 */
const FallbackUtils = {
  /** Нормализация строки */
  low(s: unknown): string {
    return String(s || '').trim().toLowerCase()
  },

  /** Проверка наличия любого из ключевых слов */
  hasAny(text: string, keys: string[]): boolean {
    const t = this.low(text)
    return keys.some((k) => t.includes(this.low(k)))
  },

  /** Поиск позиции в каталоге по артикулу/названию (строгое либо вхождение по имени) */
  findInCatalog(
    catalog: MaterialsCatalogItem[],
    nameOrArticle: { name?: string; article?: string },
  ): MaterialsCatalogItem | undefined {
    const L = (x?: string) => this.low(x)
    const byArt = catalog.find((m) => L(m.article) === L(nameOrArticle.article))
    if (byArt) return byArt
    const byName = catalog.find((m) => L(m.name) === L(nameOrArticle.name))
    if (byName) return byName
    const byIncludes = catalog.find((m) => L(m.name).includes(L(nameOrArticle.name)))
    return byIncludes
  },

  /** Создать fallback-описание коллекции (2–3 предложения) */
  collectionDescription(name: string, group?: string, productNames: string[] = []): string {
    const n = name || 'Новая коллекция'
    const g = group ? ` (${group})` : ''
    const lineup =
      productNames && productNames.length
        ? `В линейку входят: ${productNames.slice(0, 4).join(', ')}${productNames.length > 4 ? ' и др.' : ''}. `
        : ''
    const pitch =
      'Коллекция сочетает функциональность и лаконичную эстетику, подойдёт для современных интерьеров.'
    return `${n}${g} — актуальная подборка изделий с продуманными размерами и материалами. ${lineup}${pitch}`
  },

  /**
   * Сформировать эвристический состав техкарты по краткому ТЗ/названию.
   * Поддерживает типовые сценарии: тумба, пенал, зеркало; размер 600/800/1000.
   * Артикулы подобраны под демо-данные: LDSP-18-W, EDGE-2-PVC, HINGE-CLIP.
   */
  techCardSuggest(input: {
    productName: string
    brief?: string
    materialsCatalog: MaterialsCatalogItem[]
  }): AiTechCardItem[] {
    const { productName, brief = '', materialsCatalog } = input
    const text = `${productName} ${brief}`

    const isTumba = this.hasAny(text, ['тумб', 'tumb', 'tb-'])
    const isPenal = this.hasAny(text, ['пенал', 'penal'])
    const isMirror = this.hasAny(text, ['зеркал', 'mirror', 'mir-'])

    // Размерные эвристики
    const is600 = this.hasAny(text, ['600'])
    const is800 = this.hasAny(text, ['800'])
    const is1000 = this.hasAny(text, ['1000', '1000мм', '1 000'])

    // Базовая комплектность
    let ldspQty = 1.8
    let edgeQty = 6
    let hingeQty = 2

    if (is600) {
      ldspQty = 1.5
      edgeQty = 4
      hingeQty = 2
    } else if (is800) {
      ldspQty = 2.2
      edgeQty = 7
      hingeQty = 2
    } else if (is1000) {
      ldspQty = 2.8
      edgeQty = 9
      hingeQty = 4
    }

    // Для пенала материалов больше
    if (isPenal) {
      ldspQty += 0.8
      edgeQty += 2
      hingeQty = 4
    }

    // Для зеркала другая логика
    if (isMirror) {
      // Для зеркал не нужны LDSP/петли по умолчанию
      const list: AiTechCardItem[] = []
      const glass = this.findInCatalog(materialsCatalog, { name: 'Стекло зеркальное' })
      list.push({
        name: glass?.name || 'Зеркало стеклянное',
        article: glass?.article,
        quantity: is600 ? 0.35 : is800 ? 0.5 : 0.6,
        unit: glass?.unit || 'м2',
      })
      const edge = this.findInCatalog(materialsCatalog, { name: 'Кромка ПВХ 2мм', article: 'EDGE-2-PVC' })
      list.push({
        name: edge?.name || 'Кромка ПВХ 2мм',
        article: edge?.article || 'EDGE-2-PVC',
        quantity: 2,
        unit: edge?.unit || 'пог.м',
      })
      return list
    }

    // Нормальные мебельные изделия (тумба/пенал/прочее)
    const items: AiTechCardItem[] = []

    const ldsp = this.findInCatalog(materialsCatalog, { name: 'ЛДСП 18мм Белый', article: 'LDSP-18-W' })
    items.push({
      name: ldsp?.name || 'ЛДСП 18мм Белый',
      article: ldsp?.article || 'LDSP-18-W',
      quantity: Number(ldspQty.toFixed(2)),
      unit: ldsp?.unit || 'м2',
    })

    const edge = this.findInCatalog(materialsCatalog, { name: 'Кромка ПВХ 2мм', article: 'EDGE-2-PVC' })
    items.push({
      name: edge?.name || 'Кромка ПВХ 2мм',
      article: edge?.article || 'EDGE-2-PVC',
      quantity: edgeQty,
      unit: edge?.unit || 'пог.м',
    })

    // Петли у тумб/пеналов с дверями
    if (isTumba || isPenal || this.hasAny(text, ['двер', 'петл', 'hinge'])) {
      const hinge = this.findInCatalog(materialsCatalog, { name: 'Петля clip-on', article: 'HINGE-CLIP' })
      items.push({
        name: hinge?.name || 'Петля clip-on',
        article: hinge?.article || 'HINGE-CLIP',
        quantity: hingeQty,
        unit: hinge?.unit || 'шт',
      })
    }

    // Ручки при необходимости
    if (this.hasAny(text, ['ручк', 'handle'])) {
      const handle = this.findInCatalog(materialsCatalog, { name: 'Ручка скоба' })
      items.push({
        name: handle?.name || 'Ручка скоба',
        article: handle?.article,
        quantity: is600 ? 2 : 2,
        unit: handle?.unit || 'шт',
      })
    }

    return items
  },
}

/**
 * AiService — общие методы для генерации описаний коллекций и подсказки ТД.
 * Порядок:
 * 1) Пытаемся обратиться к backend /api/ai/claude.
 * 2) При любой ошибке используем локальный fallback, возвращаем значения без исключений.
 */
export class AiService {
  /** Базовый путь до AI-эндпоинта */
  static endpoint = '/api/ai/claude'

  /** Вызов backend-эндпоинта с задачей и полезной нагрузкой */
  private static async post<T>(task: string, payload: Record<string, unknown>): Promise<AiResponse<T>> {
    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, payload }),
      })
      if (!resp.ok) {
        // Некоторые CDN возвращают HTML об ошибке (CloudFront 403) — считаем как not ok
        const txt = await resp.text().catch(() => '')
        return { ok: false, error: `HTTP ${resp.status}: ${txt || 'AI endpoint error'}` }
      }
      const data = (await resp.json()) as any
      if (data?.error) return { ok: false, error: String(data.error) }
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error' }
    }
  }

  /** Сгенерировать описание коллекции (2–3 предложения, без воды) */
  static async generateCollectionDescription(input: {
    name: string
    group?: string
    productNames: string[]
  }): Promise<string> {
    const remote = await this.post<{ description: string }>('collection_description', input)
    if (remote.ok) {
      const desc = String((remote.data as any)?.description || '').trim()
      if (desc) return desc
    } else {
      // Диагностика в консоль, но UI не ломаем
      console.warn('[AI fallback] collection_description:', remote.error)
    }
    // Fallback
    return FallbackUtils.collectionDescription(input.name, input.group, input.productNames)
  }

  /** Подсказать техкарту на основе краткого ТЗ и каталога материалов */
  static async suggestTechCard(input: {
    productName: string
    brief?: string
    typeName?: string
    finishName?: string
    materialsCatalog: MaterialsCatalogItem[]
  }): Promise<AiTechCardItem[]> {
    const remote = await this.post<{ items: AiTechCardItem[] }>('techcard_suggest', input)
    if (remote.ok) {
      const items = Array.isArray((remote.data as any)?.items) ? ((remote.data as any).items as AiTechCardItem[]) : []
      const cleaned = items.filter((x) => typeof x?.quantity === 'number' && x.quantity > 0)
      if (cleaned.length) return cleaned
    } else {
      console.warn('[AI fallback] techcard_suggest:', remote.error)
    }
    // Fallback эвристики
    return FallbackUtils.techCardSuggest({
      productName: input.productName,
      brief: input.brief,
      materialsCatalog: input.materialsCatalog || [],
    })
  }
}
