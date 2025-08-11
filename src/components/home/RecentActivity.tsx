/**
 * RecentActivity — последние изменения из журнала
 * Берёт данные из localStorage (ключ: wasser_change_log) и показывает список событий.
 */

import React, { memo, useMemo } from 'react'
import { Archive, ArchiveRestore, Edit2, Plus, Layers, Package, Grid2X2, GripVertical, Trash2, Clock, BookOpenCheck } from 'lucide-react'

/**
 * AuditEvent — тип записи журнала
 */
export interface AuditEvent {
  id: string
  at: number
  action: string
  entity: 'collection' | 'product' | 'system' | string
  entityId?: string
  details?: any
  version?: string
}

/**
 * Пропсы RecentActivity
 */
export interface RecentActivityProps {
  /** Сколько записей показать */
  limit?: number
}

/**
 * Безопасное чтение из localStorage
 */
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Форматирование даты-времени
 */
function shortDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

/**
 * Получить иконку по типу события
 */
function getIcon(ev: AuditEvent): React.ReactNode {
  if (ev.entity === 'product') {
    if (ev.action === 'create') return <Plus size={14} />
    if (ev.action === 'delete') return <Trash2 size={14} />
    if (ev.action === 'update') return <Edit2 size={14} />
    return <Package size={14} />
  }
  if (ev.entity === 'collection') {
    if (ev.action === 'archive') return <Archive size={14} />
    if (ev.action === 'unarchive') return <ArchiveRestore size={14} />
    if (ev.action === 'reorder') return <GripVertical size={14} />
    if (ev.action === 'create') return <Plus size={14} />
    if (ev.action === 'update') return <Edit2 size={14} />
    if (ev.action === 'add_product') return <Plus size={14} />
    if (ev.action === 'delete') return <Trash2 size={14} />
    return <Grid2X2 size={14} />
  }
  return <BookOpenCheck size={14} />
}

/**
 * RecentActivity — список последних событий
 */
const RecentActivity = memo(function RecentActivity({ limit = 6 }: RecentActivityProps): React.ReactElement {
  const items = useMemo(() => {
    const list = readLS<AuditEvent[]>('wasser_change_log', [])
    return list.slice(0, limit)
  }, [limit])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">Последние изменения</div>
        <div className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Clock size={12} />
          <span>Обновлено: {shortDateTime(Date.now())}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">
          Пока нет записей. Действия на страницах «Коллекции» и «Изделия» появятся здесь.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((ev) => (
            <li key={ev.id} className="py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
                {getIcon(ev)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 truncate">
                  <span className="font-medium">{ev.entity}</span> — {ev.action}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {ev.details?.name ? ev.details.name : ev.entityId || '—'} • {shortDateTime(ev.at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default RecentActivity
