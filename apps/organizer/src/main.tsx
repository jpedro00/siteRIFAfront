import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.tsx';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento #root nao encontrado.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.slice(0, -1)}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
