/**
 * Модальное окно
 * Простая реализация оверлея и диалога без сторонних зависимостей
 */

import React, { memo, useEffect } from 'react'
import Button from './Button'

/**
 * Пропсы модального окна
 */
export interface ModalProps {
  /** Показать/скрыть модалку */
  open: boolean
  /** Заголовок окна */
  title?: string
  /** Закрыть модалку */
  onClose: () => void
  /** Контент */
  children: React.ReactNode
  /** Блокировать клик по оверлею */
  lockOverlay?: boolean
}

/**
 * Modal — диалоговое окно
 */
const Modal = memo(function Modal({
  open,
  title,
  onClose,
  children,
  lockOverlay = false,
}: ModalProps): React.ReactElement | null {
  /** Блокируем прокрутку под модалкой */
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!lockOverlay) onClose()
        }}
      />
      <div className="relative w-[95vw] max-w-3xl max-h-[90vh] overflow-auto bg-white border border-gray-200 rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title || 'Диалог'}</h3>
          <Button variant="outline" className="bg-transparent" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
})

export default Modal
