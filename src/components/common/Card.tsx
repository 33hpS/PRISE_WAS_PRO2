/**
 * Карточка-контейнер
 * Универсальный блок с рамкой и скруглением
 */

import React, { memo } from 'react'

/**
 * Пропсы карточки
 */
export interface CardProps {
  /** Внутреннее содержимое */
  children: React.ReactNode
  /** Класс оформления */
  className?: string
  /** Включить hover-анимацию */
  hover?: boolean
  /** Убрать паддинги */
  noPadding?: boolean
}

/**
 * Card — переиспользуемая карточка
 */
const Card = memo(function Card({
  children,
  className = '',
  hover = false,
  noPadding = false,
}: CardProps): React.ReactElement {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl ${hover ? 'hover:shadow-md hover:-translate-y-0.5 transition-all' : ''} ${
        noPadding ? '' : 'p-5'
      } ${className}`}
    >
      {children}
    </div>
  )
})

export default Card
