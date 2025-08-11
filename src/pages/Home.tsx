/**
 * Главная страница WASSER PRO — enterprise-реализация
 * Архитектура: модульная композиция, строгая типизация, производительная оптимизация и A11y.
 * Источники данных: useSystemData (коллекции, товары, аудит, метрики), внешние виджеты (курсы, погода).
 */

import React, { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Grid2X2, Package, Layers, Clock } from 'lucide-react'

import Card from '../components/common/Card'
import SystemMetricsPanel from '../components/home/SystemMetricsPanel'
import QuickActionsPanel from '../components/home/QuickActionsPanel'
import PinnedCollectionsPanel from '../components/home/PinnedCollectionsPanel'
import EmptyStateSection from '../components/home/EmptyStateSection'
import RecentActivity from '../components/home/RecentActivity'
import CurrencyRatesCard from '../components/home/CurrencyRatesCard'
import WeatherCard from '../components/home/WeatherCard'
import { useSystemData } from '../hooks/useSystemData'

/**
 * AccentVariant — тип акцентного оформления карточек быстрых действий
 */
type AccentVariant = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose'

/**
 * NavigationRoute — строго типизированные маршруты
 */
type NavigationRoute = '/collections' | '/products' | '/materials' | '/pricelist' | '/settings' | '/journal'

/**
 * QuickActionItemCfg — конфигурация пункта «быстрые действия»
 */
interface QuickActionItemCfg {
  /** ID записи для ключей в списке */
  readonly id: string
  /** Заголовок */
  readonly label: string
  /** Подзаголовок */
  readonly description: string
  /** Иконка */
  readonly icon: React.ComponentType<{ size?: number }>
  /** Путь перехода */
  readonly route: NavigationRoute
  /** Классы акцента внешнего вида (Tailwind) */
  readonly accentClass: string
  /** Приоритет визуального акцента */
  readonly priority: 'high' | 'medium' | 'low'
}

/**
 * HeroConfiguration — данные приветственного блока
 */
interface HeroConfiguration {
  /** Заголовок бейджа слева */
  readonly badgePrimary: string
  /** Подзаголовок бейджа справа */
  readonly badgeSecondary: string
  /** Заголовок hero */
  readonly title: string
  /** Описание hero */
  readonly description: string
  /** Иллюстрация hero */
  readonly imageUrl: string
  /** Alt для иллюстрации */
  readonly imageAlt: string
}

/**
 * UIConfiguration — статическая конфигурация для hero и быстрых действий
 */
class UIConfiguration {
  /** Конфигурация hero-блока */
  static readonly HERO: HeroConfiguration = {
    badgePrimary: 'WASSER PRO',
    badgeSecondary: 'Управление витриной и прайсом',
    title: 'Добро пожаловать в WASSER PRO',
    description:
      'Управляйте материалами, изделиями и коллекциями. Импорт Excel, расчёт цен, генерация PDF/Excel прайс-листов.',
    imageUrl:
      'https://pub-cdn.sider.ai/u/U07GHKZAW71/web-coder/688992697fa204756a0aa9b7/resource/81bf018d-f940-4ff5-bc9c-79aebb95ed87.jpg',
    imageAlt: 'WASSER PRO Interface Preview',
  } as const

  /** Карточки быстрых действий */
  static readonly QUICK_ACTIONS: readonly QuickActionItemCfg[] = [
    {
      id: 'collections',
      label: 'Коллекции',
      description: 'Витрина изделий',
      icon: Grid2X2,
      route: '/collections',
      accentClass: 'border-blue-200 bg-blue-50 text-blue-700',
      priority: 'high',
    },
    {
      id: 'products',
      label: 'Изделия',
      description: 'Каталог продукции',
      icon: Package,
      route: '/products',
      accentClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      priority: 'high',
    },
    {
      id: 'materials',
      label: 'Материалы',
      description: 'Реестр компонентов',
      icon: Layers,
      route: '/materials',
      accentClass: 'border-amber-200 bg-amber-50 text-amber-700',
      priority: 'medium',
    },
  ] as const
}

/**
 * DateTimeService — форматирование даты/времени для UI
 */
class DateTimeService {
  /** Получить строку текущей даты/времени (локаль ru-RU как пример) */
  static nowLabel(): string {
    try {
      return new Date().toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return new Date().toLocaleString()
    }
  }
}

/**
 * HeroSection — приветственный модуль с иллюстрацией
 */
const HeroSection = memo(function HeroSection(): React.ReactElement {
  const { t } = useTranslation()
  const hero = useMemo(
    () => ({
      badge: t('home.badge', 'Готово к работе'),
      title: t('home.title', UIConfiguration.HERO.title),
      description: t('home.subtitle', UIConfiguration.HERO.description),
      imgUrl: UIConfiguration.HERO.imageUrl,
      imgAlt: UIConfiguration.HERO.imageAlt,
      time: DateTimeService.nowLabel(),
      ctaPrimary: t('home.cta.collections', 'Перейти к коллекциям'),
      ctaSecondary: t('home.cta.materials', 'Материалы'),
    }),
    [t],
  )

  const navigate = useNavigate()
  const goCollections = useCallback(() => navigate('/collections'), [navigate])
  const goMaterials = useCallback(() => navigate('/materials'), [navigate])

  return (
    <Card className="p-0 overflow-hidden bg-white/90 border border-gray-200 shadow-sm">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch" role="banner" aria-label="Hero">
        <div className="p-6 lg:p-8">
          {/* Бейдж статуса */}
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200 mb-4"
            aria-label={hero.badge}
            title={hero.badge}
          >
            <span className="font-semibold">{UIConfiguration.HERO.badgePrimary}</span>
            <span className="text-blue-500">•</span>
            <span>{UIConfiguration.HERO.badgeSecondary}</span>
          </div>

          {/* Заголовок */}
          <h1 id="hero-title" className="text-2xl lg:text-3xl font-extrabold text-gray-900 mb-3">
            {hero.title}
          </h1>

          {/* Описание */}
          <p className="text-gray-600 leading-relaxed mb-6">{hero.description}</p>

          {/* Метки состояния системы */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {t('home.badge', 'Готово к работе')}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Clock size={14} />
              {hero.time}
            </div>
          </div>

          {/* CTA как ссылки из навигации AppShell (минимум кода) */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goCollections}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              aria-label={hero.ctaPrimary}
              title={hero.ctaPrimary}
            >
              {hero.ctaPrimary}
            </button>
            <button
              type="button"
              onClick={goMaterials}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
              aria-label={hero.ctaSecondary}
              title={hero.ctaSecondary}
            >
              {hero.ctaSecondary}
            </button>
          </div>
        </div>

        {/* Иллюстрация */}
        <div className="h-48 lg:h-auto bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
          <img
            src={hero.imgUrl}
            alt={hero.imgAlt}
            className="object-cover w-full h-full transition-transform duration-300 hover:scale-105"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
        </div>
      </section>
    </Card>
  )
})

/**
 * InformationPanel — внешние данные (курсы, погода)
 */
const InformationPanel = memo(function InformationPanel(): React.ReactElement {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Информация: курсы и погода">
      <CurrencyRatesCard />
      <WeatherCard />
    </section>
  )
})

/**
 * HomePage — страница-дешборд
 */
const HomePage = memo(function HomePage(): React.ReactElement {
  const navigate = useNavigate()
  const { products, collections, metrics, pinnedCollections, seed } = useSystemData()

  /** Навигация по клику из быстрых действий */
  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate],
  )

  /** Быстрые действия на основе статической конфигурации */
  const quickItems = useMemo(
    () =>
      UIConfiguration.QUICK_ACTIONS.map((a) => ({
        label: a.label,
        description: a.description,
        icon: <a.icon size={18} />,
        onClick: () => handleNavigate(a.route),
        accentClass: a.accentClass,
      })),
    [handleNavigate],
  )

  /** Признак пустого состояния */
  const isEmpty = useMemo(() => products.length === 0 && collections.length === 0, [products.length, collections.length])

  /** Словарь товаров для виджета закреплённых коллекций */
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  return (
    <main className="space-y-8" role="main" aria-labelledby="hero-title">
      {/* Приветственная секция */}
      <HeroSection />

      {/* Системные метрики */}
      <SystemMetricsPanel metrics={metrics} />

      {/* Внешние данные */}
      <InformationPanel />

      {/* Пустое состояние (подсказка) */}
      {isEmpty && <EmptyStateSection onSeedData={seed} onNavigateCollections={() => handleNavigate('/collections')} />}

      {/* Быстрые действия */}
      <QuickActionsPanel items={quickItems} />

      {/* Закреплённые коллекции (если есть) */}
      {pinnedCollections.length > 0 && (
        <PinnedCollectionsPanel
          collections={pinnedCollections}
          productMap={productMap}
          onOpenCollections={() => handleNavigate('/collections')}
        />
      )}

      {/* Журнал активности */}
      <RecentActivity limit={6} />
    </main>
  )
})

export default HomePage
