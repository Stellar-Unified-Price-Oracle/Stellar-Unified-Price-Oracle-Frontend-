import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PriceProvider } from './context/PriceContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PriceProvider>
      <App />
    </PriceProvider>
  </StrictMode>,
)
