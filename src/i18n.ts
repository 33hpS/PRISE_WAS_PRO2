/**
 * i18n — инициализация локализации (RU / KY / EN)
 * Ресурсы: ключи для главной страницы и базовая терминология.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * Выбор начального языка:
 * - приоритет localStorage (app_lang)
 * - иначе язык браузера (ru/ky/en -> ru по умолчанию)
 */
function detectInitialLang(): 'ru' | 'ky' | 'en' {
  try {
    const saved = localStorage.getItem('app_lang') as 'ru' | 'ky' | 'en' | null
    if (saved === 'ru' || saved === 'ky' || saved === 'en') return saved
  } catch {}
  const nav = (navigator?.language || 'ru').toLowerCase()
  if (nav.startsWith('ky')) return 'ky'
  if (nav.startsWith('en')) return 'en'
  return 'ru'
}

/** Ресурсы переводов */
const resources = {
  ru: {
    translation: {
      home: {
        badge: 'Готово к работе',
        title: 'WASSER PRO — управление витриной и прайсом',
        subtitle: 'Материалы, изделия, коллекции и прайс-лист в одном месте. Импорт из Excel, расчёт себестоимости и экспорт PDF/Excel.',
        cta: {
          collections: 'Перейти к коллекциям',
          materials: 'Материалы',
        },
        cards: {
          collections: {
            title: 'Коллекции и витрина',
            desc: 'Группируйте и упорядочивайте изделия по сезонам.',
          },
          products: {
            title: 'Изделия и ТД',
            desc: 'Карточки изделий и технологические карты с расчётами.',
          },
          materials: {
            title: 'Материалы и импорт',
            desc: 'Каталог материалов с импортом/экспортом CSV/XLSX.',
          },
        },
      },
    },
  },
  ky: {
    translation: {
      home: {
        badge: 'Иштөөгө даяр',
        title: 'WASSER PRO — витрина жана прайс башкаруу',
        subtitle: 'Материалдар, буюмдар, коллекциялар жана прайс-лист бир жерде. Excel импорт, өздүк бааны эсептөө жана PDF/Excel экспорт.',
        cta: {
          collections: 'Коллекцияларга өтүү',
          materials: 'Материалдар',
        },
        cards: {
          collections: {
            title: 'Коллекциялар жана витрина',
            desc: 'Буюмдарды сезон боюнча топтоп, тартипке салыңыз.',
          },
          products: {
            title: 'Буюмдар жана ТК',
            desc: 'Буюм карталары жана технологиялык карталар эсептөөлөрү менен.',
          },
          materials: {
            title: 'Материалдар жана импорт',
            desc: 'Материалдар каталогу, CSV/XLSX импорт/экспорт.',
          },
        },
      },
    },
  },
  en: {
    translation: {
      home: {
        badge: 'Ready to work',
        title: 'WASSER PRO — showcase and price management',
        subtitle: 'Materials, products, collections and price list in one place. Excel import, cost calculation and PDF/Excel export.',
        cta: {
          collections: 'Open collections',
          materials: 'Materials',
        },
        cards: {
          collections: {
            title: 'Collections & showcase',
            desc: 'Group and arrange products by seasons.',
          },
          products: {
            title: 'Products & Tech Cards',
            desc: 'Product cards and tech cards with calculations.',
          },
          materials: {
            title: 'Materials & import',
            desc: 'Materials catalog with CSV/XLSX import/export.',
          },
        },
      },
    },
  },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectInitialLang(),
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  })

export default i18n
