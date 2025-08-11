/**
 * LoadingOverlay — стартовый загрузчик "как в файле"
 * Показывает светлый оверлей со спиннером и брендом
 */

import React, { memo } from 'react'

/**
 * Пропсы для LoadingOverlay
 */
export interface LoadingOverlayProps {
  /** Показать/скрыть загрузчик */
  show: boolean
}

/**
 * LoadingOverlay — полноэкранный блок со спиннером
 */
const LoadingOverlay = memo(function LoadingOverlay({ show }: LoadingOverlayProps): React.ReactElement | null {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-1">WASSER PRO</h2>
        <p className="text-gray-600">Загрузка системы управления…</p>
        <div className="mt-4 w-48 bg-gray-200 rounded-full h-2 mx-auto overflow-hidden">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '62%' }} />
        </div>
      </div>
    </div>
  )
})

export default LoadingOverlay
