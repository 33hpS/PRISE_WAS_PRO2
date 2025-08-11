/**
 * Supabase client и конфигурация.
 * Хранит и читает настройки из localStorage, создаёт клиент по запросу.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Конфигурация Supabase */
export interface SupabaseConfig {
  /** URL проекта (https://xxx.supabase.co) */
  url: string
  /** anon ключ */
  anonKey: string
  /** Включена ли синхронизация */
  enabled: boolean
}

/** Ключ хранения настроек */
const LS_KEY = 'wasser_supabase_cfg'

/** Прочитать конфигурацию из localStorage */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const cfg = raw ? (JSON.parse(raw) as SupabaseConfig) : null
    return cfg || { url: '', anonKey: '', enabled: false }
  } catch {
    return { url: '', anonKey: '', enabled: false }
  }
}

/** Сохранить конфигурацию в localStorage */
export function setSupabaseConfig(cfg: SupabaseConfig): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  } catch {
    /* noop */
  }
}

/** Включена ли синхронизация */
export function isSupabaseEnabled(): boolean {
  const cfg = getSupabaseConfig()
  return Boolean(cfg.enabled && cfg.url && cfg.anonKey)
}

/** Создать клиент Supabase (или вернуть null, если не настроено) */
export function getSupabase(): SupabaseClient | null {
  const cfg = getSupabaseConfig()
  if (!cfg.enabled || !cfg.url || !cfg.anonKey) return null
  return createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input as any, { ...init, cache: 'no-store' }) },
  })
}

/** Проба соединения: простой select count из указанной таблицы */
export async function testSupabaseConnection(table = 'materials'): Promise<boolean> {
  const client = getSupabase()
  if (!client) return false
  const { error } = await client.from(table).select('*', { count: 'exact', head: true }).limit(1)
  return !error
}