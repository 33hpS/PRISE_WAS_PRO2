/**
 * ThemeToggle — переключатель темы (Светлая / Темная / Системная).
 * Применение: добавляет/убирает класс "dark" у корня документа. Сохраняет выбор в localStorage (theme).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Moon, SunMedium, Monitor } from 'lucide-react'

/** Тип темы */
export type AppTheme = 'light' | 'dark' | 'system'

/**
 * Применить тему к documentElement
 */
function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark)
  root.classList.toggle('dark', isDark)
}

/**
 * Применить сохранённую тему при загрузке приложения (однократно)
 */
export function applyStoredTheme() {
  try {
    const saved = (localStorage.getItem('theme') as AppTheme | null) || 'system'
    applyTheme(saved)
  } catch {
    // ignore
  }
}

/**
 * ThemeToggle — кнопка цикла тем или мини-меню (здесь цикл).
 */
export default function ThemeToggle(): React.ReactElement {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      return (localStorage.getItem('theme') as AppTheme | null) || 'system'
    } catch {
      return 'system'
    }
  })

  /** Подписка на системную тему, если выбран режим "system" */
  useEffect(() => {
    const mm = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const handler = () => {
      const t = (localStorage.getItem('theme') as AppTheme | null) || 'system'
      if (t === 'system') applyTheme('system')
    }
    mm?.addEventListener?.('change', handler)
    return () => {
      mm?.removeEventListener?.('change', handler)
    }
  }, [])

  /** Применяем текущую тему */
  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  /** Следующая тема по кругу */
  const nextTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'))
  }, [])

  /** Иконка согласно теме */
  const Icon = useMemo(() => {
    return theme === 'light' ? SunMedium : theme === 'dark' ? Moon : Monitor
  }, [theme])

  /** Подсказка title */
  const title = useMemo(() => {
    return theme === 'light' ? 'Тема: Светлая' : theme === 'dark' ? 'Тема: Темная' : 'Тема: Системная'
  }, [theme])

  return (
    <button
      type="button"
      onClick={nextTheme}
      className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
      title={title}
      aria-label={title}
    >
      <Icon size={18} />
    </button>
  )
}
