/**
 * QuickPrefsDock — плавающая панель предпочтений (язык и тема)
 * Компактный виджет справа снизу, не требует правок AppShell.
 */

import React, { useMemo, useState } from 'react'
import i18n from '../../i18n'
import { setTheme, getTheme, type ThemeMode } from '../../theme'
import { Settings, Globe, Sun, Moon, Monitor } from 'lucide-react'

/** Элемент переключения */
function SegButton({
  active,
  children,
  onClick,
  title,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

/** Основной компонент док-панели */
export default function QuickPrefsDock(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState(i18n.language as 'ru' | 'ky' | 'en')
  const [mode, setMode] = useState<ThemeMode>(getTheme())

  /** Список языков */
  const langs = useMemo(
    () => ([
      { key: 'ru', label: 'RU' },
      { key: 'ky', label: 'KY' },
      { key: 'en', label: 'EN' },
    ] as const),
    [],
  )

  /** Переключить язык */
  const changeLanguage = async (lng: 'ru' | 'ky' | 'en') => {
    await i18n.changeLanguage(lng)
    try { localStorage.setItem('app_lang', lng) } catch {}
    setLang(lng)
  }

  /** Переключить тему */
  const changeTheme = (m: ThemeMode) => {
    setTheme(m)
    setMode(m)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Кнопка открытия */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur text-gray-800 dark:text-gray-100"
        title="Предпочтения"
      >
        <Settings size={16} />
        <span className="text-sm font-medium">Prefs</span>
      </button>

      {/* Панель */}
      {open && (
        <div className="mt-2 p-3 w-[280px] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/90 backdrop-blur space-y-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Globe size={14} /> Язык
          </div>
          <div className="flex items-center gap-1">
            {langs.map(l => (
              <SegButton
                key={l.key}
                active={lang.startsWith(l.key)}
                onClick={() => changeLanguage(l.key)}
                title={l.label}
              >
                {l.label}
              </SegButton>
            ))}
          </div>

          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mt-2">
            Тема
          </div>
          <div className="flex items-center gap-1">
            <SegButton active={mode === 'light'} onClick={() => changeTheme('light')} title="Светлая">
              <Sun size={12} />&nbsp;Light
            </SegButton>
            <SegButton active={mode === 'dark'} onClick={() => changeTheme('dark')} title="Тёмная">
              <Moon size={12} />&nbsp;Dark
            </SegButton>
            <SegButton active={mode === 'system'} onClick={() => changeTheme('system')} title="Системная">
              <Monitor size={12} />&nbsp;System
            </SegButton>
          </div>
        </div>
      )}
    </div>
  )
}
