import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { InvoiceProvider } from './context/InvoiceContext';
import { BrowserRouter } from 'react-router-dom';
import AuthWrapper from './components/Auth/AuthWrapper';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthWrapper>
          <InvoiceProvider>
            <App />
          </InvoiceProvider>
        </AuthWrapper>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
