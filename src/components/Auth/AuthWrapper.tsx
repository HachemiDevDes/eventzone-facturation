import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import Login from './Login';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // If user followed an email confirmation link with a PKCE code parameter
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            // Clean the code parameter from the URL
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, '', url.pathname + url.search);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Code exchange handled or skipped:', err);
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#FAFAFA',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: '#64748B',
        fontSize: '0.9rem'
      }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <>{children}</>;
}
