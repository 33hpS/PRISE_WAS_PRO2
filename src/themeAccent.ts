/**
 * Управление акцентными темами (цветовая схема и фон)
 * Применяется как класс на html: accent-blue | accent-night | accent-emerald | accent-violet
 * Внутри классов задаются CSS-переменные: --accent-50..700, --bg-from, --bg-to.
 */

export type AccentKey = 'blue' | 'night' | 'emerald' | 'violet'

const LS_KEY = 'app_accent'

/** Описание акцентной темы */
interface AccentTheme {
  /** Человекочитаемое имя (для UI) */
  label: string
  /** Цветовая палитра как CSS-переменные */
  vars: {
    accent50: string
    accent100: string
    accent200: string
    accent300: string
    accent400: string
    accent500: string
    accent600: string
    accent700: string
    bgFrom: string
    bgTo: string
  }
}

/** Набор тем с палитрами (близко к tailwind цветам) */
const THEMES: Record<AccentKey, AccentTheme> = {
  blue: {
    label: 'Светлая (Blue)',
    vars: {
      accent50: '#eff6ff',
      accent100: '#dbeafe',
      accent200: '#bfdbfe',
      accent300: '#93c5fd',
      accent400: '#60a5fa',
      accent500: '#3b82f6',
      accent600: '#2563eb',
      accent700: '#1d4ed8',
      bgFrom: '#f8fafc',
      bgTo: '#eff6ff'
    }
  },
  night: {
    label: 'Ночная',
    vars: {
      accent50: '#eef2ff',
      accent100: '#e0e7ff',
      accent200: '#c7d2fe',
      accent300: '#a5b4fc',
      accent400: '#818cf8',
      accent500: '#6366f1',
      accent600: '#4f46e5',
      accent700: '#4338ca',
      bgFrom: '#0b1020',
      bgTo: '#141a2d'
    }
  },
  emerald: {
    label: 'Изумруд',
    vars: {
      accent50: '#ecfdf5',
      accent100: '#d1fae5',
      accent200: '#a7f3d0',
      accent300: '#6ee7b7',
      accent400: '#34d399',
      accent500: '#10b981',
      accent600: '#059669',
      accent700: '#047857',
      bgFrom: '#f0fdf4',
      bgTo: '#ecfdf5'
    }
  },
  violet: {
    label: 'Аметист',
    vars: {
      accent50: '#faf5ff',
      accent100: '#f3e8ff',
      accent200: '#e9d5ff',
      accent300: '#d8b4fe',
      accent400: '#c084fc',
      accent500: '#a855f7',
      accent600: '#9333ea',
      accent700: '#7e22ce',
      bgFrom: '#faf5ff',
      bgTo: '#f3e8ff'
    }
  }
}

/** Гарантировано добавляем в head стили классов акцентных тем (один раз) */
function ensureStyleInjected(): void {
  const id = 'accent-theme-styles'
  if (document.getElementById(id)) return

  // Формируем CSS с классами на :root
  const css = Object.entries(THEMES)
    .map(([key, theme]) => {
      const v = theme.vars
      return `
:root.accent-${key} {
  --accent-50: ${v.accent50};
  --accent-100: ${v.accent100};
  --accent-200: ${v.accent200};
  --accent-300: ${v.accent300};
  --accent-400: ${v.accent400};
  --accent-500: ${v.accent500};
  --accent-600: ${v.accent600};
  --accent-700: ${v.accent700};
  --bg-from: ${v.bgFrom};
  --bg-to: ${v.bgTo};
}`
    })
    .join('\n')

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
}

/** Применить акцент: снять старые классы accent-*, добавить новый и записать в LS */
export function applyAccent(accent: AccentKey): void {
  ensureStyleInjected()
  const root = document.documentElement
  // Удаляем предыдущие классы
  ;['accent-blue','accent-night','accent-emerald','accent-violet'].forEach(c => root.classList.remove(c))
  // Добавляем новый
  root.classList.add(`accent-${accent}`)
  try {
    localStorage.setItem(LS_KEY, accent)
  } catch {}
}

/** Прочитать сохранённый акцент (fallback: blue) */
export function readAccent(): AccentKey {
  try {
    const v = localStorage.getItem(LS_KEY) as AccentKey | null
    if (v && v in THEMES) return v
  } catch {}
  return 'blue'
}

/** Получить список доступных тем для UI */
export function listAccents(): Array<{ key: AccentKey; label: string }> {
  return (Object.keys(THEMES) as AccentKey[]).map((k) => ({ key: k, label: THEMES[k].label }))
}
