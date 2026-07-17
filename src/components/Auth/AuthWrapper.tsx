import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import Login from './Login';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <>{children}</>;
}
