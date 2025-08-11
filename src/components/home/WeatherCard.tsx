/**
 * WeatherCard — карточка с текущей погодой.
 * Источник: open-meteo.com (без ключа). Геолокация пользователя с фолбэком на Бишкек.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Card from '../common/Card'
import { MapPin, Sun, Cloud, CloudRain, Snowflake, Wind, RefreshCw } from 'lucide-react'

/** Состояние погоды */
interface WeatherState {
  loading: boolean
  error?: string
  /** Город/метка местоположения для отображения */ place: string
  /** Температура, °C */ temperature?: number
  /** Скорость ветра, м/с */ windspeed?: number
  /** Код погоды по Open-Meteo */ weathercode?: number
  /** Обновлено */ updatedAt?: number
}

/** Бишкек — фолбэк координат */
const BISHKEK = { lat: 42.8746, lon: 74.5698, label: 'Бишкек' }

/** Ключ для лёгкого кэша */
const LS_KEY = 'wasser_weather_current'
/** TTL кэша (мс) — 20 минут */
const CACHE_TTL = 20 * 60 * 1000

/** Подбор иконки и описания по коду погоды Open-Meteo */
function weatherMeta(code?: number): { icon: React.ReactNode; label: string } {
  if (code == null) return { icon: <Cloud size={16} />, label: '—' }
  if (code === 0) return { icon: <Sun size={16} className="text-amber-500" />, label: 'Ясно' }
  if ([1, 2, 3].includes(code)) return { icon: <Sun size={16} className="text-amber-500" />, label: 'Переменная облачность' }
  if ([45, 48].includes(code)) return { icon: <Cloud size={16} />, label: 'Туман' }
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: <CloudRain size={16} className="text-blue-600" />, label: 'Морось' }
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { icon: <CloudRain size={16} className="text-blue-600" />, label: 'Дождь' }
  if ([66, 67].includes(code)) return { icon: <CloudRain size={16} className="text-blue-600" />, label: 'Ледяной дождь' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: <Snowflake size={16} className="text-sky-600" />, label: 'Снег' }
  if (code === 95) return { icon: <CloudRain size={16} className="text-blue-600" />, label: 'Гроза' }
  if ([96, 97].includes(code)) return { icon: <CloudRain size={16} className="text-blue-600" />, label: 'Гроза, град' }
  return { icon: <Cloud size={16} />, label: 'Облачно' }
}

/** Прочитать кэш */
function readCache(): WeatherState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as WeatherState
    if (data.updatedAt && Date.now() - data.updatedAt < CACHE_TTL) return data
  } catch {
    /* noop */
  }
  return null
}

/** Сохранить кэш */
function writeCache(state: WeatherState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* noop */
  }
}

/** Компонент карточки погоды */
export default function WeatherCard(): React.ReactElement {
  const [state, setState] = useState<WeatherState>({ loading: true, place: BISHKEK.label })

  /** Загрузка погоды для координат */
  async function loadByCoords(lat: number, lon: number, placeLabel: string) {
    setState((s) => ({ ...s, loading: true, error: undefined, place: placeLabel }))
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) throw new Error('Сервис погоды недоступен')
      const json = await resp.json()
      const cw = json?.current_weather
      const next: WeatherState = {
        loading: false,
        place: placeLabel,
        temperature: typeof cw?.temperature === 'number' ? cw.temperature : undefined,
        windspeed: typeof cw?.windspeed === 'number' ? cw.windspeed : undefined,
        weathercode: typeof cw?.weathercode === 'number' ? cw.weathercode : undefined,
        updatedAt: Date.now(),
      }
      setState(next)
      writeCache(next)
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message || 'Не удалось получить погоду' }))
    }
  }

  /** Инициализация: кэш -> геолокация -> фолбэк Бишкек */
  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setState({ ...cached, loading: false })
      return
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          loadByCoords(latitude, longitude, 'Ваше местоположение')
        },
        () => {
          loadByCoords(BISHKEK.lat, BISHKEK.lon, BISHKEK.label)
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
      )
    } else {
      loadByCoords(BISHKEK.lat, BISHKEK.lon, BISHKEK.label)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const meta = useMemo(() => weatherMeta(state.weathercode), [state.weathercode])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Погода</span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={12} />
            {state.place}
          </span>
        </div>
        <button
          type="button"
          onClick={() => loadByCoords(BISHKEK.lat, BISHKEK.lon, state.place || BISHKEK.label)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          title="Обновить"
          aria-label="Обновить"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {state.loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
        </div>
      ) : state.error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{state.error}</div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-3xl font-extrabold text-gray-900">
            {typeof state.temperature === 'number' ? `${Math.round(state.temperature)}°C` : '—'}
          </div>
          <div className="text-sm text-gray-700 inline-flex items-center gap-2">
            {meta.icon}
            <span>{meta.label}</span>
            <span className="inline-flex items-center gap-1 text-gray-500 ml-3">
              <Wind size={14} />
              {typeof state.windspeed === 'number' ? `${Math.round(state.windspeed)} м/с` : '—'}
            </span>
          </div>
        </div>
      )}
      <div className="mt-2 text-xs text-gray-500">
        {state.updatedAt ? `Обновлено: ${new Date(state.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}` : '—'}
      </div>
    </Card>
  )
}
