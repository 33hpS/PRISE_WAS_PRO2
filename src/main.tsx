import { createRoot } from 'react-dom/client'
import './shadcn.css'
import App from './App'

// Отключаем EventSource в production
if (typeof EventSource !== 'undefined' && location.hostname !== 'localhost') {
  // Блокируем EventSource в production
  window.EventSource = undefined as any;
}

const root = createRoot(document.getElementById('app')!)
root.render(<App />)
