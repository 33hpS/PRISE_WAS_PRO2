/**
 * EmptyStateSection — подсказка при пустых данных на главной странице.
 * Предлагает загрузить демо-данные или перейти к коллекциям.
 */

import React from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import { Database, Zap, ChevronRight } from 'lucide-react'

/**
 * Пропсы пустого состояния
 */
export interface EmptyStateSectionProps {
  /** Загрузить демо-данные */
  onSeedData: () => void
  /** Перейти к коллекциям */
  onNavigateCollections: () => void
}

/**
 * EmptyStateSection — компонент подсказки
 */
export default function EmptyStateSection({
  onSeedData,
  onNavigateCollections,
}: EmptyStateSectionProps): React.ReactElement {
  return (
    <Card className="p-8 text-center border-dashed">
      <div className="max-w-md mx-auto">
        <Database className="mx-auto text-gray-300 mb-3" size={44} />
        <h3 className="text-lg font-semibold text-gray-900">Система готова к работе</h3>
        <p className="text-gray-600 mt-1">
          Загрузите демонстрационные данные или начните с создания первой коллекции.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
          <Button onClick={onSeedData} className="inline-flex items-center gap-2">
            <Zap size={16} />
            Загрузить демо-данные
          </Button>
          <Button variant="outline" className="bg-transparent" onClick={onNavigateCollections}>
            Перейти к коллекциям
            <ChevronRight size={16} className="inline ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
