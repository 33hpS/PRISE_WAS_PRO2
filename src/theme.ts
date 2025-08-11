/**
 * theme — управление темой (light / dark / system)
 * Автоинициализация при импорте, сохранение в localStorage, реакция на смену системной темы.
 */

export type ThemeMode = 'light' | 'dark' | 'system'
const THEME_KEY = 'app_theme'

let currentMode: ThemeMode = 'system'
let media: MediaQueryList | null = null

/** Применить класс темы к html */
function apply(mode: ThemeMode) {
  currentMode = mode
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {}

  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    : false

  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', isDark)

  // Слежение за системной темой только в режиме system
  if (media) {
    media.removeEventListener?.('change', onSystemChange)
    media = null
  }
  if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', onSystemChange)
  }
}

/** Обработчик изменения системной темы */
function onSystemChange() {
  apply(currentMode)
}

/** Получить режим из localStorage */
function readSaved(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {}
  return 'system'
}

/** Публичные API */
export function setTheme(mode: ThemeMode) {
  apply(mode)
}
export function getTheme(): ThemeMode {
  return currentMode
}

/** Автоинициализация */
(function initTheme() {
  const initial = readSaved()
  apply(initial)
})()
