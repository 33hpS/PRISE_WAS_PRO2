/**
 * LanguageSwitcher — простой переключатель RU | KY | EN.
 * Сохраняет выбор в localStorage (app_lang), переключает i18next.
 */
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Поддерживаемые языки */
type Lang = 'ru' | 'ky' | 'en'

/** Карточка языка для рендера */
const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'ru', label: 'RU' },
  { code: 'ky', label: 'KY' },
  { code: 'en', label: 'EN' },
]

/**
 * LanguageSwitcher — компактный сегментный переключатель
 */
export default function LanguageSwitcher(): React.ReactElement {
  const { i18n } = useTranslation()
  const current = (i18n.language as Lang) || 'ru'

  /** Выбор языка */
  const choose = useCallback(
    (code: Lang) => {
      if (!code || code === current) return
      i18n.changeLanguage(code)
      try {
        localStorage.setItem('app_lang', code)
      } catch {
        // ignore
      }
    },
    [current, i18n],
  )

  /** ARIA-лейбл */
  const title = useMemo(() => 'Выбор языка: RU / KY / EN', [])

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-gray-300 bg-white" role="group" aria-label={title} title={title}>
      {LANGS.map((l) => {
        const active = l.code === current
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => choose(l.code)}
            className={`px-2.5 py-1 text-xs rounded-md ${active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            aria-pressed={active}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
