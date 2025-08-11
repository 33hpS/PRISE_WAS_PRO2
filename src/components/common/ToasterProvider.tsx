/**
 * ToasterProvider — глобальный провайдер уведомлений
 * Использует библиотеку sonner (предустановлена) для уведомлений в стиле "как в файле"
 */

import React from 'react'
import { Toaster } from 'sonner'

/**
 * ToasterProvider — рендерит глобальный Toaster в правом верхнем углу
 */
export default function ToasterProvider(): React.ReactElement {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={3200}
      toastOptions={{
        classNames: {
          toast: 'rounded-xl shadow-lg',
        },
      }}
    />
  )
}
