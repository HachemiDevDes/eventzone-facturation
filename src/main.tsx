import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { InvoiceProvider } from './context/InvoiceContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InvoiceProvider>
      <App />
    </InvoiceProvider>
  </StrictMode>,
);
