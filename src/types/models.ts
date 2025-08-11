/**
 * Модели домена WASSER PRO
 * Общие интерфейсы для материалов, изделий, техкарт и настроек цен
 */

export interface Material {
  /** Уникальный идентификатор */
  id: string
  /** Название материала */
  name: string
  /** Артикул */
  article: string
  /** Единица измерения */
  unit: string
  /** Цена за единицу */
  price: number
  /** Дата создания */
  created_at: string
  /** Дата обновления */
  updated_at: string
}

export interface TechCardItem {
  /** ID материала */
  materialId: string
  /** Количество материала */
  quantity: number
  /** Локальный ID строки техкарты (для UI) */
  _techCardId?: string
}

export interface Product {
  /** Уникальный идентификатор */
  id: string
  /** Название изделия */
  name: string
  /** Артикул */
  article: string
  /** Технологическая карта (состав материалов) */
  tech_card: TechCardItem[]
  /** Коллекция (опционально) */
  collection_id?: string | null
  /** Тип изделия (ID) */
  product_type_id?: string | null
  /** Тип отделки (ID) */
  finish_type_id?: string | null
  /** URL изображения */
  image_url?: string | null
  /** Дата создания */
  created_at: string
  /** Дата обновления */
  updated_at: string
}

export interface PriceType {
  /** ID типа изделия */
  id: string
  /** Имя типа изделия */
  name: string
  /** Наценка, % */
  markup: number
  /** Стоимость работ */
  workCost: number
}

export interface FinishType {
  /** ID типа отделки */
  id: string
  /** Имя типа отделки */
  name: string
  /** Наценка, % */
  markup: number
  /** Стоимость работ (необязательно) */
  workCost?: number
}

export interface PriceSettings {
  /** Типы изделий */
  productTypes: PriceType[]
  /** Типы отделки */
  finishTypes: FinishType[]
}
