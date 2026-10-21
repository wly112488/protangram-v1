import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/themes.css'
import { initializeDemoData } from './workspace/demoData'

const render = () => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

void (import.meta.env.VITE_DEMO_DATA === 'false' ? Promise.resolve() : initializeDemoData())
  .catch(error => console.warn('演示样例初始化失败，保留已有数据：', error))
  .finally(render)
