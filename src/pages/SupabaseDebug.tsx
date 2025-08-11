/**
 * Панель отладки Supabase
 * Предназначение:
 * - Настройка URL/anonKey и включение синхронизации
 * - Проверка соединения и доступности view
 * - Операции с материалами: Pull (из БД) / Push (в БД) / Realtime-подписка
 * - Копирование единого SQL-артефакта в буфер обмена (устойчивые фолбэки)
 * - Управление видимостью пункта Dev в боковом меню
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cloud, Link as LinkIcon, ShieldCheck, Database, Download, Upload,
  Bell, Unplug, Clipboard, Check, AlertTriangle, SatelliteDish, PlugZap, Eye, EyeOff, ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getSupabaseConfig,
  setSupabaseConfig,
  isSupabaseEnabled,
  getSupabase,
  testSupabaseConnection,
  type SupabaseConfig,
} from '../services/supabase'
import {
  pullMaterialsToLocal,
  readLocalMaterials,
  upsertMaterialsBatch,
  subscribeMaterialsChanges,
} from '../services/materialsSync'

/**
 * Badge — компактный индикатор состояния
 */
function Badge({ ok, label }: { ok: boolean; label: string }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
        ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`}
    >
      {ok ? <Check size={12} /> : <AlertTriangle size={12} />}
      {label}
    </span>
  )
}

/**
 * Маскировка ключа (кроме последних 4 символов)
 */
function maskKey(k: string): string {
  if (!k) return ''
  const keep = 4
  if (k.length <= keep) return '•'.repeat(Math.max(0, k.length - 1)) + (k.slice(-1) || '')
  const hidden = '•'.repeat(k.length - keep)
  return hidden + k.slice(-keep)
}

/**
 * Устойчивое копирование текста в буфер обмена.
 * 1) navigator.clipboard.writeText
 * 2) document.execCommand('copy') через скрытый textarea
 */
async function resilientCopy(text: string): Promise<boolean> {
  // 1) Современный способ
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // переходим к фолбэку
  }
  // 2) Фолбэк: скрытый textarea + execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    ta.setAttribute('readonly', 'true')
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Попытка получить текст SQL-артефакта с наборами кандидатных путей.
 * Избегаем cache: 'no-store' (CloudFront может не принимать не-кэшируемые запросы).
 */
async function fetchArtifactText(): Promise<string> {
  const candidates = [
    '/supabase/artifact_unified.sql',
    'supabase/artifact_unified.sql',
  ]
  let lastError: any = null
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { method: 'GET', mode: 'same-origin', credentials: 'same-origin' })
      if (resp.ok) {
        return await resp.text()
      } else {
        lastError = new Error(`HTTP ${resp.status}`)
      }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Не удалось загрузить artifact_unified.sql')
}

/**
 * SupabaseDebugPage — основная панель отладки
 */
export default function SupabaseDebugPage(): React.ReactElement {
  // Состояние формы конфигурации
  const [form, setForm] = useState<SupabaseConfig>({ url: '', anonKey: '', enabled: false })

  // Диагностика
  const [connOk, setConnOk] = useState<boolean | null>(null)
  const [viewOk, setViewOk] = useState<boolean | null>(null)
  const [subActive, setSubActive] = useState(false)
  const unsubRef = useRef<() => void>(() => {})
  const [localCount, setLocalCount] = useState<number>(0)
  const supaEnabled = useMemo(() => isSupabaseEnabled(), [form])

  // Флаг видимости Dev-пункта в меню
  const [devMenuVisible, setDevMenuVisible] = useState<boolean>(false)

  /**
   * Инициализация: загрузка конфигурации и начальные данные
   */
  useEffect(() => {
    const cfg = getSupabaseConfig()
    setForm(cfg)
    setLocalCount(readLocalMaterials().length)
    try {
      setDevMenuVisible(localStorage.getItem('wasser_devtools') === '1')
    } catch {
      setDevMenuVisible(false)
    }
  }, [])

  /**
   * Обновление поля формы
   */
  const updateField = useCallback(<K extends keyof SupabaseConfig>(k: K, v: SupabaseConfig[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
  }, [])

  /**
   * Сохранение конфигурации в localStorage
   */
  const saveConfig = useCallback(() => {
    setSupabaseConfig(form)
    toast.success('Конфигурация сохранена')
  }, [form])

  /**
   * Проверка соединения (быстрый head select)
   */
  const checkConnection = useCallback(async () => {
    try {
      setConnOk(null)
      const ok = await testSupabaseConnection('materials')
      setConnOk(ok)
      toast[ok ? 'success' : 'error'](ok ? 'Подключение успешно' : 'Подключение не удалось')
    } catch (e: any) {
      setConnOk(false)
      toast.error(`Ошибка соединения: ${e?.message || 'неизвестно'}`)
    }
  }, [])

  /**
   * Проверка доступности view v_products_export
   */
  const checkView = useCallback(async () => {
    try {
      setViewOk(null)
      const c = getSupabase()
      if (!c) {
        setViewOk(false)
        toast.error('Supabase не настроен')
        return
      }
      const { error } = await c.from('v_products_export').select('*', { head: true, count: 'exact' }).limit(1)
      const ok = !error
      setViewOk(ok)
      toast[ok ? 'success' : 'error'](ok ? 'View доступна' : `View недоступна: ${error?.message || 'ошибка'}`)
    } catch (e: any) {
      setViewOk(false)
      toast.error(`Ошибка проверки view: ${e?.message || 'неизвестно'}`)
    }
  }, [])

  /**
   * Pull материалов: из БД в localStorage
   */
  const pullMaterials = useCallback(async () => {
    try {
      const n = await pullMaterialsToLocal()
      setLocalCount(readLocalMaterials().length)
      toast.success(`Импортировано из БД: ${n}`)
    } catch (e: any) {
      toast.error(`Ошибка Pull: ${e?.message || 'неизвестно'}`)
    }
  }, [])

  /**
   * Push материалов: из localStorage в БД (upsert batch)
   */
  const pushMaterials = useCallback(async () => {
    try {
      const list = readLocalMaterials()
      if (list.length === 0) {
        toast.info('Локальная база материалов пуста')
        return
      }
      await upsertMaterialsBatch(list)
      toast.success(`Выгружено в БД: ${list.length}`)
    } catch (e: any) {
      toast.error(`Ошибка Push: ${e?.message || 'неизвестно'}`)
    }
  }, [])

  /**
   * Включить realtime-подписку: на любое изменение делаем Pull
   */
  const subscribeRealtime = useCallback(() => {
    if (subActive) return
    const unsub = subscribeMaterialsChanges(async () => {
      try {
        await pullMaterialsToLocal()
        setLocalCount(readLocalMaterials().length)
        toast.success('Realtime: обновлены материалы')
      } catch {
        toast.error('Realtime: ошибка при обновлении')
      }
    })
    unsubRef.current = unsub
    setSubActive(true)
    toast.success('Realtime-подписка включена')
  }, [subActive])

  /**
   * Отключить realtime-подписку
   */
  const unsubscribeRealtime = useCallback(() => {
    try {
      unsubRef.current && unsubRef.current()
    } catch {
      // ignore
    }
    setSubActive(false)
    toast.info('Realtime-подписка отключена')
  }, [])

  /**
   * Скопировать SQL-артефакт в буфер обмена с устойчивыми фолбэками
   */
  const copyArtifact = useCallback(async () => {
    try {
      // 1) Получаем текст из нескольких кандидатных путей
      const text = await fetchArtifactText()

      // 2) Пытаемся скопировать (clipboard API -> textarea fallback)
      const copied = await resilientCopy(text)
      if (copied) {
        toast.success('SQL-артефакт скопирован в буфер обмена')
        return
      }

      // 3) Если копирование недоступно — скачиваем файл
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'artifact_unified.sql'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Скачан artifact_unified.sql (clipboard недоступен)')
    } catch (e: any) {
      toast.error(`Не удалось получить/скопировать артефакт: ${e?.message || 'неизвестно'}`)
    }
  }, [])

  /**
   * Переключить флаг отображения Dev-пункта в меню (localStorage + синтетическое событие storage)
   */
  const toggleDevMenu = useCallback(() => {
    try {
      const next = !devMenuVisible
      const oldValue = localStorage.getItem('wasser_devtools')
      if (next) {
        localStorage.setItem('wasser_devtools', '1')
      } else {
        localStorage.removeItem('wasser_devtools')
      }
      setDevMenuVisible(next)
      try {
        const evt = new StorageEvent('storage', {
          key: 'wasser_devtools',
          oldValue,
          newValue: next ? '1' : null,
          storageArea: localStorage,
        })
        window.dispatchEvent(evt)
      } catch {
        /* noop */
      }
      toast.success(next ? 'Пункт Dev будет показан в боковом меню' : 'Пункт Dev скрыт в боковом меню')
    } catch {
      toast.error('Не удалось изменить флаг отображения Dev-пункта')
    }
  }, [devMenuVisible])

  /**
   * Скопировать прямую ссылку на /dev (HashRouter)
   */
  const copyDevLink = useCallback(async () => {
    try {
      const url = `${location.origin}${location.pathname}#/dev`
      const ok = await resilientCopy(url)
      if (ok) {
        toast.success('Ссылка на /#/dev скопирована')
      } else {
        // Фолбэк: просто открываем новую вкладку с этой ссылкой
        window.open(url, '_blank', 'noopener,noreferrer')
        toast.success('Открыта новая вкладка /#/dev (clipboard недоступен)')
      }
    } catch {
      toast.error('Не удалось скопировать ссылку')
    }
  }, [])

  // Видимость статусов
  const statusConn = connOk === null ? '—' : connOk ? 'OK' : 'Ошибка'
  const statusView = viewOk === null ? '—' : viewOk ? 'OK' : 'Ошибка'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Cloud size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Supabase Debug</h1>
            <div className="text-sm text-gray-600">Настройка подключения, диагностика, синхронизация материалов</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge ok={supaEnabled} label={supaEnabled ? 'Включено' : 'Отключено'} />
          <span className="text-xs text-gray-500">Локальных материалов: {localCount}</span>
        </div>
      </div>

      {/* Конфигурация */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <LinkIcon size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Конфигурация подключения</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Supabase URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => updateField('url', e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Синхронизация</label>
            <button
              type="button"
              onClick={() => updateField('enabled', !form.enabled)}
              className={`w-full px-3 py-2 rounded-lg border ${
                form.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {form.enabled ? 'Включена' : 'Выключена'}
            </button>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Anon Key</label>
            <input
              type="text"
              value={form.anonKey}
              onChange={(e) => updateField('anonKey', e.target.value)}
              placeholder={maskKey(form.anonKey) || 'eyJhbGciOi...'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveConfig}
              className="w-full px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>

      {/* Диагностика */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Диагностика</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-gray-900">Подключение</div>
              <div className="text-xs text-gray-500">HEAD select к таблице materials</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Статус: {statusConn}</div>
              <button
                type="button"
                onClick={checkConnection}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              >
                <PlugZap size={16} />
                Проверить
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-gray-900">View v_products_export</div>
              <div className="text-xs text-gray-500">HEAD select наличия</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Статус: {statusView}</div>
              <button
                type="button"
                onClick={checkView}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              >
                <SatelliteDish size={16} />
                Проверить
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-gray-900">SQL-артефакт</div>
              <div className="text-xs text-gray-500">Скопировать/скачать artifact_unified.sql</div>
            </div>
            <div className="text-right flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={copyArtifact}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                title="Скопировать текст SQL в буфер"
              >
                <Clipboard size={16} />
                Скопировать
              </button>
              <a
                href="/supabase/artifact_unified.sql"
                download
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                title="Скачать файл artifact_unified.sql"
              >
                <Download size={16} />
                Скачать файл
              </a>
              <a
                href="/supabase/artifact_unified.sql"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                title="Открыть файл в новой вкладке"
              >
                <ExternalLink size={16} />
                Открыть
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Видимость Dev-пункта в меню */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SatelliteDish size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Отображение пункта “Dev” в боковом меню</h2>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              Сейчас: {devMenuVisible || supaEnabled ? 'Показывается' : 'Скрыт'}
            </div>
            <div className="text-xs text-gray-500">
              Пункт Dev автоматически показывается при активной конфигурации Supabase или по флагу localStorage.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {devMenuVisible ? (
              <button
                type="button"
                onClick={toggleDevMenu}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                title="Скрыть пункт Dev в меню"
              >
                <EyeOff size={16} />
                Скрыть в меню
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleDevMenu}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
                title="Показать пункт Dev в меню"
              >
                <Eye size={16} />
                Показать в меню
              </button>
            )}

            <a
              href="#/dev"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              title="Открыть страницу /#/dev"
            >
              <LinkIcon size={16} />
              Открыть /#/dev
            </a>

            <button
              type="button"
              onClick={copyDevLink}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              title="Скопировать ссылку /#/dev"
            >
              <Clipboard size={16} />
              Скопировать ссылку
            </button>
          </div>
        </div>
      </div>

      {/* Синхронизация материалов */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Материалы — синхронизация</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Pull из БД</div>
            <button
              type="button"
              onClick={pullMaterials}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Download size={16} />
              Импортировать (Pull)
            </button>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Push в БД</div>
            <button
              type="button"
              onClick={pushMaterials}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Upload size={16} />
              Выгрузить (Push)
            </button>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Realtime</div>
            {subActive ? (
              <button
                type="button"
                onClick={unsubscribeRealtime}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              >
                <Unplug size={16} />
                Отключить подписку
              </button>
            ) : (
              <button
                type="button"
                onClick={subscribeRealtime}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Bell size={16} />
                Включить подписку
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
