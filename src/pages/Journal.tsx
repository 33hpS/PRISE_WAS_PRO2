/**
 * Страница "Журнал изменений"
 * Чтение событий из localStorage (wasser_change_log). Если нет событий — показываем подсказку.
 */
import React, { useMemo } from 'react'

/**
 * Тип события журнала
 */
interface AuditEvent {
  id: string
  at: number
  action: string
  entity: 'material' | 'product' | 'collection' | 'system' | string
  entityId?: string
  details?: any
  version?: string
}

/**
 * Безопасное чтение журнала из localStorage
 */
function readLog(): AuditEvent[] {
  try {
    const raw = localStorage.getItem('wasser_change_log')
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * JournalPage — страница журнала изменений
 */
export default function JournalPage(): React.ReactElement {
  const events = useMemo(() => readLog(), [])
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Журнал изменений</h1>
      {events.length === 0 ? (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 text-gray-600">
          Журнал пуст. Операции (создание/редактирование/архив/перетаскивание) будут фиксироваться здесь.
        </div>
      ) : (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-0 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Время</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Сущность</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Действие</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Детали</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(e.at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.entity}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(e.details ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
