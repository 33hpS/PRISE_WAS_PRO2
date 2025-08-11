/**
 * Адаптер синхронизации материалов с Supabase.
 * Содержит pull (из БД в localStorage), upsert/delete (в БД), realtime-подписку.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseEnabled } from './supabase'

/** Ключ localStorage, совместимый со страницей Materials и прайс-листом */
export const MATERIALS_LS_KEY = 'wasser_materials'

/** Тип строки в БД (минимально необходимый) */
export interface MaterialRow {
  id: string
  name: string
  article: string
  category: string | null
  unit: string | null
  price: number | null
  supplier?: string | null
  description?: string | null
  tags?: string[] | string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  version?: number | null
}

/** Локальная модель в UI страницы Materials (расширенная) */
export interface MaterialLocal {
  id: string
  name: string
  article: string
  category: string
  unit: string
  price: number
  supplier?: string
  description?: string
  tags: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  version: number
}

/** Прочитать локальные материалы */
export function readLocalMaterials(): MaterialLocal[] {
  try {
    const raw = localStorage.getItem(MATERIALS_LS_KEY)
    const val = raw ? JSON.parse(raw) : []
    return Array.isArray(val) ? val : val && typeof val === 'object' ? Object.values(val) : []
  } catch {
    return []
  }
}

/** Сохранить локальные материалы */
export function writeLocalMaterials(items: MaterialLocal[]): void {
  try {
    localStorage.setItem(MATERIALS_LS_KEY, JSON.stringify(items))
  } catch {
    /* noop */
  }
}

/** Row -> Local */
function rowToLocal(r: MaterialRow): MaterialLocal {
  const now = new Date().toISOString()
  const tags =
    Array.isArray(r.tags) ? (r.tags as string[]).filter(Boolean)
      : typeof r.tags === 'string' ? r.tags.split(/[,;]\s*/).filter(Boolean)
      : []
  return {
    id: String(r.id),
    name: r.name || '',
    article: r.article || '',
    category: r.category || '',
    unit: r.unit || 'шт',
    price: Number(r.price || 0),
    supplier: r.supplier || undefined,
    description: r.description || undefined,
    tags,
    isActive: r.is_active !== false,
    createdAt: r.created_at || now,
    updatedAt: r.updated_at || now,
    version: r.version || 1,
  }
}

/** Local -> Row */
function localToRow(m: MaterialLocal): MaterialRow {
  return {
    id: m.id,
    name: m.name,
    article: m.article,
    category: m.category,
    unit: m.unit,
    price: m.price,
    supplier: m.supplier ?? null,
    description: m.description ?? null,
    tags: m.tags,
    is_active: m.isActive,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    version: m.version,
  }
}

/** Получить клиент (гарантированно либо SupabaseClient, либо null) */
function client(): SupabaseClient | null {
  return getSupabase()
}

/** Забрать материалы из Supabase в localStorage. Возвращает количество записей. */
export async function pullMaterialsToLocal(): Promise<number> {
  if (!isSupabaseEnabled()) return 0
  const c = client()
  if (!c) return 0
  const { data, error } = await c.from('materials').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  const list = (data || []).map(rowToLocal)
  writeLocalMaterials(list)
  return list.length
}

/** Upsert одного материала в Supabase */
export async function upsertMaterial(item: MaterialLocal): Promise<void> {
  if (!isSupabaseEnabled()) return
  const c = client()
  if (!c) return
  const row = localToRow({ ...item, updatedAt: new Date().toISOString(), version: (item.version || 1) + 1 })
  const { error } = await c.from('materials').upsert([row], { onConflict: 'id' })
  if (error) throw error
}

/** Пакетный upsert материалов */
export async function upsertMaterialsBatch(items: MaterialLocal[]): Promise<void> {
  if (!isSupabaseEnabled() || items.length === 0) return
  const c = client()
  if (!c) return
  const rows = items.map((m) => localToRow({ ...m, updatedAt: new Date().toISOString(), version: (m.version || 1) + 1 }))
  const { error } = await c.from('materials').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

/** Удалить материал в Supabase */
export async function deleteMaterial(id: string): Promise<void> {
  if (!isSupabaseEnabled()) return
  const c = client()
  if (!c) return
  const { error } = await c.from('materials').delete().eq('id', id)
  if (error) throw error
}

/** Подписка на realtime-изменения таблицы materials. Возвращает функцию отписки. */
export function subscribeMaterialsChanges(onChange: () => void): () => void {
  const c = client()
  if (!isSupabaseEnabled() || !c) return () => {}
  // Канал Postgres Changes
  const channel = c
    .channel('public:materials')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
      // Любое изменение — перетянем данные локально
      onChange()
    })
    .subscribe()
  return () => {
    try {
      c.removeChannel(channel)
    } catch {
      /* noop */
    }
  }
}