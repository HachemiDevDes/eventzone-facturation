import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, LogIn } from 'lucide-react';
import '../../index.css';

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // We are querying our custom "users" table now
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      setError("Email ou mot de passe incorrect");
    } else {
      // Store custom session
      localStorage.setItem('fawtara_user', JSON.stringify(data));
      onLoginSuccess();
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)',
      padding: '1rem',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        background: '#ffffff',
        padding: '2.5rem',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'var(--color-brand-light)',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--color-brand)'
          }}>
            <FileText size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)' }}>Connexion</h1>
          <p style={{ color: 'var(--color-text-light)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Accédez à votre espace facturation
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Email</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="votre@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Mot de passe</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : (
              <>
                <LogIn size={18} style={{ marginRight: '0.5rem' }} />
                Se connecter
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
