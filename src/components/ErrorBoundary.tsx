import React from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem('fawtara_dashboard_state');
    } catch {
      // ignore
    }
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          padding: '2rem',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        }}>
          <div style={{
            maxWidth: 480,
            width: '100%',
            background: '#FFFFFF',
            borderRadius: 16,
            padding: '2rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
              Une erreur inattendue est survenue
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              L'application a rencontré un problème imprévu. Vos données synchronisées avec le cloud restent en sécurité.
            </p>

            {this.state.error && (
              <div style={{
                background: '#F1F5F9',
                padding: '0.75rem',
                borderRadius: 8,
                fontSize: '0.75rem',
                color: '#475569',
                fontFamily: 'monospace',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                maxHeight: 120,
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} />
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
