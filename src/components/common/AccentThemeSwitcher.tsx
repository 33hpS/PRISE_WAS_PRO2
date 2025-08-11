/**
 * AccentThemeSwitcher — компактный переключатель акцентных цветовых тем.
 * Варианты: Светлая (blue), Ночная, Изумруд, Аметист.
 * Показывает кнопку с палитрой и выпадающее меню с мини-превью цвета.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Palette } from 'lucide-react'
import { applyAccent, listAccents, readAccent, type AccentKey } from '../../themeAccent'

/** Элемент превью темы (кружок с градиентом/цветом) */
function Swatch({ color }: { color: string }): React.ReactElement {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full ring-1 ring-black/10"
      style={{ background: color }}
      aria-hidden="true"
    />
  )
}

/** AccentThemeSwitcher — основной компонент */
export default function AccentThemeSwitcher(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<AccentKey>('blue')
  const items = useMemo(() => listAccents(), [])

  /** Применяем сохранённое значение при монтировании */
  useEffect(() => {
    const a = readAccent()
    setCurrent(a)
    applyAccent(a)
  }, [])

  /** Выбор темы */
  const onPick = (key: AccentKey) => {
    setCurrent(key)
    applyAccent(key)
    setOpen(false)
  }

  /** Для превью цвета используем переменные (примерная палитра) */
  const previewFor = (key: AccentKey) => {
    switch (key) {
      case 'blue': return 'linear-gradient(135deg, #dbeafe, #93c5fd)'
      case 'night': return 'linear-gradient(135deg, #0b1020, #141a2d)'
      case 'emerald': return 'linear-gradient(135deg, #d1fae5, #6ee7b7)'
      case 'violet': return 'linear-gradient(135deg, #f3e8ff, #d8b4fe)'
      default: return '#e5e7eb'
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Сменить акцентную тему"
      >
        <Palette size={16} />
        <span className="text-xs font-medium">Тема</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-50 p-2"
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => onPick(it.key)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-50 ${
                current === it.key ? 'ring-1 ring-gray-300' : ''
              }`}
              role="menuitem"
            >
              <div className="flex items-center gap-2">
                <Swatch color={previewFor(it.key)} />
                <span className="text-sm text-gray-800">{it.label}</span>
              </div>
              {current === it.key && <span className="text-xs text-gray-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
