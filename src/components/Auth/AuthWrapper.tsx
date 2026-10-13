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
        // 1. If user followed an email confirmation link with a PKCE code parameter (?code=...)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, '', url.pathname + url.search);
            setLoading(false);
            return;
          }
        }

        // 2. If user followed a hash token confirmation link (#access_token=...)
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data.session) {
              setSession(data.session);
              window.history.replaceState({}, '', window.location.pathname + window.location.search);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Auth exchange error or handled:', err);
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
