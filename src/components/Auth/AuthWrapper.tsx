import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Login from './Login';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for custom user session
    const storedUser = localStorage.getItem('fawtara_user');
    if (storedUser) {
      setSession(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    const storedUser = localStorage.getItem('fawtara_user');
    if (storedUser) {
      setSession(JSON.parse(storedUser));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <>{children}</>;
}
