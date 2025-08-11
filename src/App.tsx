/**
 * Корневое приложение WASSER PRO
 * Маршрутизация с общим AppShell (боковая панель + шапка) и контентом страниц.
 * Инициализация i18n и темы (light/dark/system) + плавающая панель предпочтений.
 * Дополнено: глобальный ToasterProvider для тост‑уведомлений.
 */

import React from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import AppShell from './layouts/AppShell'
import HomePage from './pages/Home'
import CollectionsPage from './pages/Collections'
import ProductsPage from './pages/Products'
import MaterialsPage from './pages/Materials'
import PriceListPage from './pages/PriceList'
import SettingsPage from './pages/Settings'
import JournalPage from './pages/Journal'
import SupabaseDebugPage from './pages/SupabaseDebug' // Новая страница отладки Supabase

// Инициализация i18n (однократно)
import './i18n'
// Инициализация темы (однократно)
import './theme'

// Плавающая панель предпочтений (язык/тема)
import QuickPrefsDock from './components/common/QuickPrefsDock'
// Глобальный тост‑провайдер
import ToasterProvider from './components/common/ToasterProvider'

/**
 * App — корневой компонент с layout-маршрутом
 */
export default function App(): React.ReactElement {
  return (
    <HashRouter>
      <Routes>
        {/* Общий layout */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="pricelist" element={<PriceListPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="journal" element={<JournalPage />} />
          {/* Новое: отладочная страница Supabase */}
          <Route path="dev" element={<SupabaseDebugPage />} />
          {/* Fallback внутрь layout */}
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>

      {/* Глобальная панель пользовательских предпочтений и тосты */}
      <QuickPrefsDock />
      <ToasterProvider />
    </HashRouter>
  )
}
