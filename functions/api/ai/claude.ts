/**
 * Cloudflare Pages Function: /api/ai/claude
 * Назначение: шлюз к Claude (Anthropic) для генерации описаний и подсказок техкарты.
 * Особенности:
 * - Работает без сторонних зависимостей (fetch).
 * - Безопасный CORS (OPTIONS), строгий JSON-ответ.
 * - Таймаут запросов к Anthropic (AbortController).
 * - Детальные комментарии и валидация входных данных.
 */

export interface Env {
  /** Секрет с ключом Anthropic API (добавьте в Settings -> Environment variables) */
  ANTHROPIC_API_KEY?: string
}

/** Тип общего запроса от фронтенда */
interface AiRequestBody {
  /** Имя задачи */
  task: 'collection_description' | 'techcard_suggest'
  /** Полезная нагрузка конкретной задачи */
  payload: Record<string, unknown>
}

/** Ответ API в едином формате */
interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

/** Тип результата для collection_description */
interface CollectionDescResult {
  description: string
}

/** Элемент каталога материалов для подсказки техкарты */
interface MaterialsCatalogItem {
  name: string
  article?: string
  unit?: string
  price?: number
}

/** Тип результата для techcard_suggest */
interface TechCardAiItem {
  name: string
  article?: string
  quantity: number
  unit?: string
}

/** Заголовки CORS (разрешаем тот же origin и дев) */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Утилита: JSON-ответ */
function jsonResponse<T>(data: ApiResponse<T>, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    ...init,
  })
}

/** Утилита: безопасное чтение тела JSON */
async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/** Утилита: извлечь JSON из текста (на случай, если модель вернула JSON внутри код-блока) */
function extractJsonArrayOrObject(text: string): any {
  // Пытаемся найти первый JSON-блок
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenceMatch ? fenceMatch[1] : text
  try {
    return JSON.parse(raw)
  } catch {
    // Последняя попытка: найти первое '[' или '{'
    const idxArr = raw.indexOf('[')
    const idxObj = raw.indexOf('{')
    const idx = idxArr >= 0 && (idxArr < idxObj || idxObj < 0) ? idxArr : idxObj
    if (idx >= 0) {
      try {
        return JSON.parse(raw.slice(idx))
      } catch {
        return null
      }
    }
    return null
  }
}

/** Запрос к Anthropic Claude v1/messages */
async function callClaude(env: Env, messages: Array<{ role: 'system' | 'user'; content: string }>, opts?: {
  /** Максимальное число токенов */
  maxTokens?: number
  /** Температура */
  temperature?: number
  /** Таймаут, мс */
  timeoutMs?: number
}): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(5_000, opts?.timeoutMs ?? 20_000))

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: opts?.maxTokens ?? 400,
        temperature: opts?.temperature ?? 0.2,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`Claude HTTP ${resp.status}: ${txt?.slice(0, 500) || 'unknown error'}`)
    }

    const data = await resp.json() as any
    // Ответ Anthropic: content: [{ type: 'text', text: '...' }]
    const text: string = data?.content?.[0]?.text ?? ''
    return String(text || '').trim()
  } finally {
    clearTimeout(timeout)
  }
}

/** Построение системного промпта для описания коллекции */
function buildCollectionSystemPrompt(): string {
  return [
    'Вы — продуктовый копирайтер мебельной фабрики.',
    'Задача: написать сжатое описание коллекции (2–3 предложения), на русском.',
    'Требования: без воды, без маркетинговых штампов, естественный стиль, уникальность, 350–450 знаков.',
  ].join('\n')
}

/** Построение пользовательского промпта для описания коллекции */
function buildCollectionUserPrompt(input: { name?: string; group?: string; productNames?: string[] }): string {
  const name = (input.name || 'Коллекция').trim()
  const group = (input.group || '').trim()
  const list = Array.isArray(input.productNames) ? input.productNames.filter(Boolean) : []
  return [
    `Название: ${name}`,
    group ? `Группа: ${group}` : '',
    list.length ? `Изделия: ${list.slice(0, 8).join(', ')}` : '',
    '',
    'Верни только чистый текст описания без преамбул.',
  ].filter(Boolean).join('\n')
}

/** Построение системного промпта для подсказки техкарты */
function buildTechCardSystemPrompt(): string {
  return [
    'Вы — технолог мебельного производства.',
    'По краткому ТЗ изделия и каталогу материалов предложите список позиций с количеством.',
    'Строгий формат ответа — ТОЛЬКО JSON-массив объектов { "name": string, "article"?: string, "quantity": number, "unit"?: string }.',
    'Если артикул из каталога найден — обязательно заполните поле "article".',
    'Количество — положительное число; не включайте нули и отрицательные значения.',
    'Без комментариев, без Markdown, без дополнительного текста.',
  ].join('\n')
}

/** Построение пользовательского промпта для подсказки техкарты */
function buildTechCardUserPrompt(input: {
  productName?: string
  brief?: string
  typeName?: string
  finishName?: string
  materialsCatalog?: MaterialsCatalogItem[]
}): string {
  const lines: string[] = []
  lines.push(`Изделие: ${input.productName || ''}`)
  if (input.typeName) lines.push(`Тип: ${input.typeName}`)
  if (input.finishName) lines.push(`Отделка: ${input.finishName}`)
  if (input.brief) lines.push(`ТЗ: ${input.brief}`)
  lines.push('')
  lines.push('Каталог материалов (JSON):')
  lines.push(JSON.stringify(input.materialsCatalog || [], null, 2))
  lines.push('')
  lines.push('Верни только JSON-массив без Markdown.')
  return lines.join('\n')
}

/** Обработчик OPTIONS (CORS preflight) */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/** Обработчик GET — можно использовать как health-check */
export const onRequestGet: PagesFunction<Env> = async () => {
  return jsonResponse<{ health: string }>({ ok: true, data: { health: 'ok' } })
}

/** Обработчик POST — основная логика AI */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Чтение и валидация тела
  const body = await readJson<AiRequestBody>(request)
  if (!body || !body.task || typeof body.payload !== 'object') {
    return jsonResponse<never>({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  try {
    switch (body.task) {
      case 'collection_description': {
        const payload = body.payload as { name?: string; group?: string; productNames?: string[] }
        // Пробуем вызвать Claude
        if (!env.ANTHROPIC_API_KEY) {
          // Нет ключа: сообщаем об этом. Фронтенд использует fallback.
          return jsonResponse<CollectionDescResult>({ ok: false, error: 'Claude API key is not configured' }, { status: 501 })
        }
        const text = await callClaude(
          env,
          [
            { role: 'system', content: buildCollectionSystemPrompt() },
            { role: 'user', content: buildCollectionUserPrompt(payload) },
          ],
          { maxTokens: 500, temperature: 0.2 },
        )
        const description = text.replace(/\s+/g, ' ').trim()
        return jsonResponse<CollectionDescResult>({ ok: true, data: { description } })
      }

      case 'techcard_suggest': {
        const payload = body.payload as {
          productName?: string
          brief?: string
          typeName?: string
          finishName?: string
          materialsCatalog?: MaterialsCatalogItem[]
        }

        if (!env.ANTHROPIC_API_KEY) {
          return jsonResponse<{ items: TechCardAiItem[] }>({ ok: false, error: 'Claude API key is not configured' }, { status: 501 })
        }

        const text = await callClaude(
          env,
          [
            { role: 'system', content: buildTechCardSystemPrompt() },
            { role: 'user', content: buildTechCardUserPrompt(payload) },
          ],
          { maxTokens: 700, temperature: 0.1 },
        )

        // Пытаемся разобрать JSON
        let parsed = extractJsonArrayOrObject(text)
        if (!Array.isArray(parsed)) {
          // Если вдруг вернулся объект — пробуем взять поле items
          parsed = parsed?.items
        }
        const items = Array.isArray(parsed) ? parsed : []

        // Финальная очистка
        const cleaned: TechCardAiItem[] = items
          .map((x: any) => ({
            name: String(x?.name || '').trim(),
            article: typeof x?.article === 'string' ? String(x.article).trim() : undefined,
            quantity: Number(x?.quantity) || 0,
            unit: typeof x?.unit === 'string' ? String(x.unit).trim() : undefined,
          }))
          .filter((x: TechCardAiItem) => x.name && x.quantity > 0)

        return jsonResponse<{ items: TechCardAiItem[] }>({ ok: true, data: { items: cleaned } })
      }

      default:
        return jsonResponse<never>({ ok: false, error: 'Unknown task' }, { status: 400 })
    }
  } catch (e: any) {
    // Единая обработка ошибок
    const msg = e?.message || 'AI processing error'
    return jsonResponse<never>({ ok: false, error: msg }, { status: 500 })
  }
}
