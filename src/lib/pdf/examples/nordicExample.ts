/**
 * Пример использования WasserPDFGenerator с шаблоном 'nordic'
 * Даёт быстрый способ сгенерировать минималистичный PDF.
 */

import { WasserPDFGenerator, type PdfTemplate } from '../wasserPdfGenerator'

/**
 * Сгенерировать демо PDF в стиле Nordic
 * Вызов: import { generateNordicSamplePdf } from 'src/lib/pdf/examples/nordicExample'
 *        await generateNordicSamplePdf()
 */
export async function generateNordicSamplePdf(): Promise<void> {
  // 1) Данные компании и документа (обложка/метаданные)
  const companyData = {
    name: 'WASSER PRO',
    tagline: 'Мебельная фабрика',
    address: 'Кыргызстан, г. Бишкек, ул. Промышленная, 1',
    phone: '+996 (312) 555-123',
    email: 'sales@wasser.kg',
    website: 'www.wasser.kg',
    manager: {
      name: 'Асанов Руслан',
      phone: '+996 (555) 998-877',
      email: 'r.asanov@wasser.kg',
    },
    // logoUrl: 'https://.../logo.png' // по желанию, PNG/JPEG с доступом по CORS
  }

  const documentData = {
    title: 'ПРАЙС-ЛИСТ',
    version: 'Demo',
    date: new Date().toLocaleDateString('ru-RU'),
    specialOffer: 'Специальные условия для оптовых клиентов',
    orientation: 'portrait' as const,
    includeCover: true,
    brandColor: '#0f172a', // фирменный цвет темы Nordic
  }

  // 2) Демо‑серии и позиции (минимально необходимые поля)
  const products = [
    {
      series: 'BERLIN',
      seriesDesc: 'Современный минимализм, влагостойкие материалы',
      items: [
        { article: 'BL-V60', name: 'Тумба подвесная "Berlin 60"', type: 'TB', dimensions: '600×550×450', material: 'ЛДСП/МДФ', color: 'Белый глянец', price: 18500 },
        { article: 'BL-MC60', name: 'Шкаф зеркальный "Berlin 60"', type: 'ШЗ', dimensions: '600×700×150', material: 'ЛДСП',        color: 'Белый глянец', price: 14800 },
      ],
    },
    {
      series: 'VIENNA',
      seriesDesc: 'Классический стиль, фрезерованные фасады',
      items: [
        { article: 'VN-V75', name: 'Тумба с раковиной "Vienna 75"', type: 'ТР', dimensions: '750×850×480', material: 'МДФ',          color: 'Слоновая кость', price: 31000 },
        { article: 'VN-M90', name: 'Зеркало "Vienna 90"',            type: 'ЗР', dimensions: '900×800×40',  material: 'МДФ',          color: 'Слоновая кость', price: 19200 },
      ],
    },
    {
      series: 'LOFT',
      seriesDesc: 'Индустриальный дизайн, металлические элементы',
      items: [
        { article: 'LF-V100', name: 'Тумба "Loft 100"',   type: 'ТМ', dimensions: '1000×600×500', material: 'ЛДСП/Металл', color: 'Дуб крафт/Черный', price: 21000 },
        { article: 'LF-SH40', name: 'Стеллаж "Loft"',     type: 'СТ', dimensions: '400×1600×350', material: 'ЛДСП/Металл', color: 'Дуб крафт/Черный', price: 18900 },
      ],
    },
  ]

  // 3) Генерация
  const generator = new WasserPDFGenerator()
  await generator.generateAndSave(
    {
      companyData,
      documentData,
      products,
    },
    'nordic' as PdfTemplate,
    'Nordic_PriceList_Demo.pdf',
  )
}

/**
 * Подсказка по внедрению в UI:
 * 
 * import React from 'react'
 * import { generateNordicSamplePdf } from '@/lib/pdf/examples/nordicExample'
 * 
 * export function ButtonNordicDemo() {
 *   return (
 *     <button
 *       onClick={() => generateNordicSamplePdf().catch(console.error)}
 *       className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
 *     >
 *       Скачать Nordic PDF (демо)
 *     </button>
 *   )
 * }
 */