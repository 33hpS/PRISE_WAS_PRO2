/**
 * Кнопка общего назначения
 * Варианты: primary | outline | danger, размеры и состояния. Без внешних зависимостей.
 */

import React, { memo } from 'react'

/**
 * Пропсы кнопки
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Вариант оформления */
  variant?: 'primary' | 'outline' | 'danger'
  /** Размер кнопки */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Button — переиспользуемая кнопка
 */
const Button = memo(function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled,
  ...rest
}: ButtonProps): React.ReactElement {
  /** Подбор цветов по варианту */
  const variantClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent'
      : variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white border border-transparent'
      : // outline: важно — bg-transparent (см. OutlineButtonFix)
        'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50'

  /** Подбор отступов по размеру */
  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : size === 'lg'
      ? 'px-6 py-3 text-base'
      : 'px-4 py-2 text-sm'

  return (
    <button
      type="button"
      className={`rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
