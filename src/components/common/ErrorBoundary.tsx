/**
 * ErrorBoundary — общий перехватчик ошибок рендера.
 * Показывает дружелюбный fallback вместо «белого экрана» и даёт опцию перезагрузить.
 */

import React from 'react'
import Card from './Card'
import Button from './Button'

/**
 * Пропсы ErrorBoundary
 */
export interface ErrorBoundaryProps {
  /** Дочерние элементы для оборачивания */
  children: React.ReactNode
  /** Заголовок в fallback UI (необязательно) */
  title?: string
  /** Сообщение в fallback UI (необязательно) */
  message?: string
}

/**
 * Состояние ErrorBoundary
 */
interface ErrorBoundaryState {
  /** Признак, что произошла ошибка */
  hasError: boolean
  /** Объект ошибки (опционально) */
  error?: Error
}

/**
 * ErrorBoundary — классический boundary для React
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /** Инициализация состояния */
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  /**
   * Перехват ошибки и установка признака ошибки
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * Логирование ошибки
   */
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Минимальное логирование — в проде можно отправлять на внешний сборщик логов
    // eslint-disable-next-line no-console
    console.error('Caught by ErrorBoundary:', error, info)
  }

  /**
   * Обработчик кнопки перезагрузки
   */
  private handleReload = (): void => {
    try {
      // Мягкая очистка только временного состояния (если нужно можно расширить)
      // Здесь просто перезагрузка страницы
      window.location.reload()
    } catch {
      window.location.href = '#/'
    }
  }

  /**
   * Рендер компонента
   */
  render(): React.ReactNode {
    if (this.state.hasError) {
      const title = this.props.title || 'Что-то пошло не так'
      const message =
        this.props.message ||
        'Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу. Если проблема повторяется — обратитесь к администратору.'
      return (
        <div className="py-8">
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-700 font-bold">!</div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-red-800">{title}</div>
                <div className="text-sm text-red-700 mt-1">{message}</div>
                {this.state.error?.message && (
                  <div className="text-xs text-red-600 mt-2 break-words">
                    Техническая информация: {this.state.error.message}
                  </div>
                )}
                <div className="mt-4">
                  <Button onClick={this.handleReload}>Перезагрузить</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
