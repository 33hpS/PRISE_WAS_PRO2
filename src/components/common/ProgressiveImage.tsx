/**
 * ProgressiveImage — универсальный компонент изображения
 * Поддерживает picture с WebP (если передан webpSrc), lazy/eager, sizes
 * и плавное появление с "blur-up" скелетоном без внешних зависимостей.
 */

import React, { memo, useState } from 'react'

/**
 * Пропсы ProgressiveImage
 */
export interface ProgressiveImageProps {
  /** Альтернативный текст */
  alt: string
  /** Базовый источник (jpg/png/др.) */
  src: string
  /** Источник WebP (опционально; используется в picture) */
  webpSrc?: string
  /** Классы корневого контейнера */
  className?: string
  /** Классы самого тега img */
  imgClassName?: string
  /** Атрибут sizes для адаптивной загрузки */
  sizes?: string
  /** Режим загрузки */
  loading?: 'eager' | 'lazy'
  /** Режим декодирования */
  decoding?: 'async' | 'auto' | 'sync'
  /** Callback загрузки */
  onLoad?: () => void
}

/**
 * Локальный утилитарный предикат — выглядит ли строка как webp URL
 */
function isLikelyWebP(url?: string): boolean {
  if (!url) return false
  const u = url.toLowerCase()
  return u.endsWith('.webp') || u.includes('fm=webp') || u.includes('format=webp')
}

/**
 * ProgressiveImage — универсальный компонент
 */
const ProgressiveImage = memo(function ProgressiveImage({
  alt,
  src,
  webpSrc,
  className = '',
  imgClassName = '',
  sizes,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
}: ProgressiveImageProps): React.ReactElement {
  const [loaded, setLoaded] = useState(false)

  /** Обработчик завершения загрузки */
  function handleLoad(): void {
    setLoaded(true)
    onLoad?.()
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      aria-busy={!loaded}
      aria-live="polite"
    >
      {/* Скелетон/шиммер пока не загрузилось */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
      )}

      {/* Изображение: picture, если есть валидный webpSrc */}
      {webpSrc && isLikelyWebP(webpSrc) ? (
        <picture>
          <source type="image/webp" srcSet={webpSrc} />
          <img
            src={src}
            alt={alt}
            className={`transition-all duration-500 ease-out ${loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-105'} ${imgClassName}`}
            sizes={sizes}
            loading={loading}
            decoding={decoding}
            onLoad={handleLoad}
          />
        </picture>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`transition-all duration-500 ease-out ${loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-105'} ${imgClassName}`}
          sizes={sizes}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
        />
      )}
    </div>
  )
})

export default ProgressiveImage
