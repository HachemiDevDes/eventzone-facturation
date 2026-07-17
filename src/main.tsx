import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { InvoiceProvider } from './context/InvoiceContext';

import AuthWrapper from './components/Auth/AuthWrapper';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthWrapper>
      <InvoiceProvider>
        <App />
      </InvoiceProvider>
    </AuthWrapper>
  </StrictMode>,
);
