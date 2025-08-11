/**
 * CollectionsFilters — панель фильтров для страницы "Коллекции"
 * Содержит поиск, выбор группы, переключатель "архивные" и чипы групп.
 */

import React from 'react'
import { Search } from 'lucide-react'

/**
 * Пропсы панели фильтров
 */
export interface CollectionsFiltersProps {
  /** Текущее значение поиска */
  search: string
  /** Обновление поиска */
  onSearchChange: (v: string) => void
  /** Список групп */
  groups: string[]
  /** Выбранная группа */
  groupFilter: string
  /** Изменение фильтра группы */
  onGroupChange: (v: string) => void
  /** Показ архивных */
  showArchived: boolean
  /** Изменение флага архивных */
  onToggleArchived: (v: boolean) => void
  /** Сброс всех фильтров */
  onReset: () => void
}

/**
 * Компонент панели фильтров
 */
export default function CollectionsFilters({
  search,
  onSearchChange,
  groups,
  groupFilter,
  onGroupChange,
  showArchived,
  onToggleArchived,
  onReset,
}: CollectionsFiltersProps): React.ReactElement {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Верхняя строка фильтров */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по коллекциям и изделиям..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          value={groupFilter}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="all">Все группы</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showArchived}
              onChange={(e) => onToggleArchived(e.target.checked)}
            />
            Показать архивные
          </label>
          <button
            className="px-3 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm"
            onClick={onReset}
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Чипы групп */}
      {groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {groups.slice(0, 12).map((g) => {
            const active = groupFilter === g
            return (
              <button
                key={g}
                className={`px-2.5 py-1 rounded-full border text-xs ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onGroupChange(active ? 'all' : g)}
                title={active ? 'Показать все группы' : `Показать только: ${g}`}
              >
                {g}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
