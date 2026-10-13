import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  FileText, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  Building2, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import '../../index.css';

type AuthMode = 'login' | 'signup' | 'verify' | 'forgot_password';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-check if the user confirmed their email via the link in another window or device
  useEffect(() => {
    if (mode !== 'verify' || !email || !password) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const { data, error: checkErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });
        if (!checkErr && data?.session && isMounted) {
          setSuccessMessage("Email confirmé avec succès ! Connexion en cours...");
          clearInterval(interval);
        }
      } catch {
        // Silently wait for the user to confirm
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mode, email, password]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  const getWebmailInfo = (userEmail: string) => {
    const domain = userEmail.split('@')[1]?.toLowerCase();
    if (domain === 'gmail.com') return { name: 'Ouvrir Gmail', url: 'https://mail.google.com' };
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
      return { name: 'Ouvrir Outlook', url: 'https://outlook.live.com' };
    }
    if (domain === 'yahoo.com' || domain === 'yahoo.fr') {
      return { name: 'Ouvrir Yahoo Mail', url: 'https://mail.yahoo.com' };
    }
    return null;
  };

  // ─── LOGIN HANDLER ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Veuillez renseigner votre email et votre mot de passe.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (signInError) {
      console.error("Login Error:", signInError);
      const msg = signInError.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        setError("Votre adresse email n'est pas encore confirmée. Veuillez cliquer sur le lien reçu par email.");
        setMode('verify');
        setResendCooldown(60);
      } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        setError("Email ou mot de passe incorrect.");
      } else {
        setError(signInError.message || "Erreur lors de la connexion.");
      }
    }

    setLoading(false);
  };

  // ─── SIGNUP HANDLER ─────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!cleanName) {
      setError("Veuillez renseigner votre nom ou le nom de votre entreprise.");
      setLoading(false);
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError("Veuillez renseigner une adresse email valide.");
      setLoading(false);
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      setLoading(false);
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name: cleanName,
          full_name: cleanName,
        },
      },
    });

    if (signUpError) {
      console.error("Signup Error:", signUpError);
      const msg = signUpError.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('user already exists')) {
        setError("Un compte existe déjà avec cette adresse email. Connectez-vous avec vos identifiants.");
      } else if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError("Trop de demandes d'envoi d'email. Veuillez patienter quelques instants.");
      } else {
        setError(signUpError.message || "Une erreur est survenue lors de l'inscription.");
      }
      setLoading(false);
      return;
    }

    // Check if session was returned immediately (if email confirmations are off)
    if (data?.session) {
      setSuccessMessage("Compte créé avec succès ! Connexion en cours...");
      setLoading(false);
      return;
    }

    // Email confirmation was dispatched by Supabase
    setSuccessMessage(`Un email de confirmation a été envoyé à ${cleanEmail}.`);
    setMode('verify');
    setResendCooldown(60);
    setLoading(false);
  };

  // ─── MANUAL STATUS CHECK ───────────────────────────────────────────────────
  const handleManualCheck = async () => {
    setCheckingStatus(true);
    setError(null);
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setError("Veuillez saisir votre mot de passe pour vérifier.");
      setCheckingStatus(false);
      return;
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    setCheckingStatus(false);
    if (signInErr) {
      const msg = signInErr.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        setError("Votre email n'est pas encore confirmé. Veuillez d'abord cliquer sur le lien reçu dans votre email.");
      } else {
        setError(signInErr.message || "Erreur lors de la vérification.");
      }
    } else if (data?.session) {
      setSuccessMessage("Email vérifié avec succès ! Connexion en cours...");
    }
  };

  // ─── OTP CODE VERIFICATION (OPTIONAL FALLBACK) ──────────────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/[\s-]/g, '').trim();

    if (!cleanEmail) {
      setError("Veuillez renseigner votre adresse email.");
      setLoading(false);
      return;
    }

    if (!cleanCode) {
      setError("Veuillez saisir le code de confirmation reçu par email.");
      setLoading(false);
      return;
    }

    // Try verification as 'signup'
    let { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'signup',
    });

    // Fallback to 'email' type if 'signup' failed
    if (verifyError) {
      const fallback = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });
      if (!fallback.error) {
        verifyError = null;
      }
    }

    if (verifyError) {
      console.error("Verify OTP Error:", verifyError);
      const msg = verifyError.message.toLowerCase();
      if (msg.includes('expired')) {
        setError("Ce code de confirmation a expiré. Cliquez sur 'Renvoyer l'email'.");
      } else if (msg.includes('invalid') || msg.includes('token')) {
        setError("Code de confirmation incorrect. Si votre email ne contient qu'un lien, cliquez directement dessus !");
      } else {
        setError(verifyError.message || "Impossible de vérifier le code.");
      }
      setLoading(false);
      return;
    }

    setSuccessMessage("Votre compte a été activé avec succès ! Connexion en cours...");
  };

  // ─── RESEND CONFIRMATION EMAIL ──────────────────────────────────────────────
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Veuillez renseigner votre adresse email.");
      setResendLoading(false);
      return;
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setResendLoading(false);
    if (resendError) {
      console.error("Resend Error:", resendError);
      const msg = resendError.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError("Trop de demandes. Veuillez patienter une minute avant de réessayer.");
      } else {
        setError(resendError.message || "Erreur lors de l'envoi de l'email.");
      }
    } else {
      setSuccessMessage("Un nouvel email de confirmation a été envoyé.");
      setResendCooldown(60);
    }
  };

  // ─── FORGOT PASSWORD HANDLER ────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Veuillez renseigner votre adresse email.");
      setLoading(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message || "Erreur lors de la réinitialisation.");
    } else {
      setSuccessMessage("Si un compte est associé à cette adresse, vous recevrez un email de réinitialisation.");
    }
  };

  const webmail = getWebmailInfo(email);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--surface-2, #F4F4F5)',
      padding: '1.5rem',
      fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes pulse-dot {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .pulse {
          animation: pulse-dot 2s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        background: '#ffffff',
        padding: '2.5rem',
        borderRadius: 'var(--r-lg, 14px)',
        boxShadow: 'var(--shadow-md, 0 4px 8px rgba(0,0,0,0.04))',
        width: '100%',
        maxWidth: '440px',
        border: '1px solid var(--border, #E2E8F0)',
        transition: 'all 0.2s ease',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            background: 'var(--accent, #D4F252)',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--r-md, 10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
            color: 'var(--text-1, #0F172A)',
            boxShadow: '0 2px 8px rgba(212,242,82,0.45)',
          }}>
            {mode === 'verify' ? (
              <Mail size={24} />
            ) : mode === 'forgot_password' ? (
              <KeyRound size={24} />
            ) : (
              <FileText size={24} />
            )}
          </div>
          <h1 style={{ 
            fontSize: '1.45rem', 
            fontWeight: 700, 
            color: 'var(--text-1, #0F172A)',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            {mode === 'login' && 'Connexion'}
            {mode === 'signup' && 'Créer un compte'}
            {mode === 'verify' && 'Vérifiez votre email'}
            {mode === 'forgot_password' && 'Mot de passe oublié'}
          </h1>
          <p style={{ 
            color: 'var(--text-3, #64748B)', 
            fontSize: '0.85rem', 
            marginTop: '0.35rem',
            lineHeight: 1.4
          }}>
            {mode === 'login' && 'Accédez à votre espace de facturation'}
            {mode === 'signup' && 'Commencez à facturer simplement en quelques secondes'}
            {mode === 'verify' && 'Cliquez sur le lien reçu pour activer votre compte'}
            {mode === 'forgot_password' && 'Recevez un lien pour réinitialiser votre accès'}
          </p>
        </div>

        {/* Tab switcher for Login / Signup */}
        {(mode === 'login' || mode === 'signup') && (
          <div style={{
            display: 'flex',
            background: 'var(--surface-2, #F4F4F5)',
            borderRadius: 'var(--r-sm, 6px)',
            padding: '3px',
            marginBottom: '1.5rem',
            gap: '3px',
          }}>
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: 'calc(var(--r-sm, 6px) - 2px)',
                border: 'none',
                background: mode === 'login' ? '#ffffff' : 'transparent',
                color: mode === 'login' ? 'var(--text-1, #0F172A)' : 'var(--text-3, #64748B)',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <LogIn size={15} />
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: 'calc(var(--r-sm, 6px) - 2px)',
                border: 'none',
                background: mode === 'signup' ? '#ffffff' : 'transparent',
                color: mode === 'signup' ? 'var(--text-1, #0F172A)' : 'var(--text-3, #64748B)',
                boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <UserPlus size={15} />
              Créer un compte
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {error && (
          <div style={{
            padding: '0.75rem 0.9rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDD3',
            color: '#B91C1C',
            borderRadius: 'var(--r-sm, 6px)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            lineHeight: 1.45,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Success notification banner */}
        {successMessage && (
          <div style={{
            padding: '0.75rem 0.9rem',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            borderRadius: 'var(--r-sm, 6px)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            lineHeight: 1.45,
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* ─── 1. MODE: LOGIN ──────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email" 
                  placeholder="votre@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                  }}
                  required
                  autoFocus
                />
                <Mail size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)' }}>
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3, #64748B)',
                    fontSize: '0.775rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                    paddingRight: '2.4rem',
                  }}
                  required
                />
                <Lock size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-4, #94A3B8)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', height: '42px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '0.5rem' }} />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn size={18} style={{ marginRight: '0.5rem' }} />
                  Se connecter
                </>
              )}
            </button>
          </form>
        )}

        {/* ─── 2. MODE: SIGNUP ─────────────────────────────────────────────── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Nom ou Entreprise
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Ex: SARL Algiers Tech ou Ahmed Benali" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                  }}
                  required
                  autoFocus
                />
                <Building2 size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email" 
                  placeholder="votre@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                  }}
                  required
                />
                <Mail size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <p style={{ color: 'var(--text-4, #94A3B8)', fontSize: '0.725rem', marginTop: '0.25rem' }}>
                Un email de confirmation vous sera envoyé à cette adresse.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Au moins 6 caractères" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                    paddingRight: '2.4rem',
                  }}
                  required
                />
                <Lock size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-4, #94A3B8)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Confirmer le mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  placeholder="Répétez votre mot de passe" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                    paddingRight: '2.4rem',
                  }}
                  required
                />
                <Lock size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-4, #94A3B8)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title={showConfirmPassword ? 'Masquer' : 'Afficher'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', height: '42px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '0.5rem' }} />
                  Création du compte...
                </>
              ) : (
                <>
                  <UserPlus size={18} style={{ marginRight: '0.5rem' }} />
                  Créer mon compte
                </>
              )}
            </button>
          </form>
        )}

        {/* ─── 3. MODE: VERIFY EMAIL (CONFIRMATION LINK & CODE) ─────────────── */}
        {mode === 'verify' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Recipient highlight box */}
            <div style={{
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              padding: '1.1rem',
              borderRadius: 'var(--r-md, 10px)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-3, #64748B)' }}>
                Email de confirmation envoyé à :
              </div>
              <div style={{ 
                fontWeight: 700, 
                fontSize: '1rem', 
                color: 'var(--text-1, #0F172A)', 
                marginTop: '0.25rem',
                wordBreak: 'break-all'
              }}>
                {email || 'votre adresse email'}
              </div>

              {webmail && (
                <div style={{ marginTop: '0.85rem' }}>
                  <a
                    href={webmail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      background: '#ffffff',
                    }}
                  >
                    <span>{webmail.name}</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>

            {/* Step-by-step instructions */}
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              padding: '1rem',
              borderRadius: 'var(--r-sm, 6px)',
              fontSize: '0.85rem',
              color: '#166534',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                Comment confirmer votre compte :
              </div>
              <ol style={{ paddingLeft: '1.3rem', margin: 0 }}>
                <li>Ouvrez l'email envoyé par <strong>Supabase Auth</strong></li>
                <li>Cliquez sur le bouton ou lien bleu <strong>« Confirm email address »</strong></li>
                <li>Votre compte sera instantanément activé !</li>
              </ol>
            </div>

            {/* Waiting indicator & manual check button */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.5rem 0',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-3, #64748B)',
              }}>
                <span className="pulse" style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10B981',
                }} />
                <span>En attente de confirmation (détection automatique active)...</span>
              </div>

              <button
                type="button"
                onClick={handleManualCheck}
                disabled={checkingStatus}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', height: '42px' }}
              >
                {checkingStatus ? (
                  <>
                    <RefreshCw size={16} className="spin" style={{ marginRight: '0.5rem' }} />
                    Vérification en cours...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} style={{ marginRight: '0.5rem' }} />
                    J'ai cliqué sur le lien (Continuer)
                  </>
                )}
              </button>
            </div>

            {/* Expandable 6-digit code input (fallback if template provides a code) */}
            <div style={{
              borderTop: '1px solid var(--border, #E2E8F0)',
              paddingTop: '0.85rem',
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={() => setShowCodeInput(!showCodeInput)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3, #64748B)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {showCodeInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showCodeInput ? 'Masquer la saisie par code' : 'Vous avez reçu un code à 6 chiffres ? Cliquez ici'}
              </button>

              {showCodeInput && (
                <form onSubmit={handleVerifyCode} style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      letterSpacing: '0.25em',
                      fontFamily: 'monospace, Space Grotesk, sans-serif',
                      padding: '0.5rem',
                    }}
                    maxLength={10}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-outline"
                    disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', height: '38px', fontSize: '0.825rem' }}
                  >
                    {loading ? 'Validation du code...' : 'Valider le code saisi'}
                  </button>
                </form>
              )}
            </div>

            {/* Resend button */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0 || resendLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--text-4, #94A3B8)' : 'var(--text-2, #334155)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                }}
              >
                <RefreshCw size={13} className={resendLoading ? 'spin' : ''} />
                {resendCooldown > 0
                  ? `Renvoyer l'email dans ${resendCooldown}s`
                  : "Vous n'avez pas reçu l'email ? Renvoyer"}
              </button>
            </div>

            {/* Back link */}
            <div style={{ textAlign: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border, #E2E8F0)' }}>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3, #64748B)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ArrowLeft size={14} />
                Modifier l'adresse email / Retour
              </button>
            </div>
          </div>
        )}

        {/* ─── 4. MODE: FORGOT PASSWORD ────────────────────────────────────── */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-2, #334155)', marginBottom: '0.4rem' }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email" 
                  placeholder="votre@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                  }}
                  required
                  autoFocus
                />
                <Mail size={16} color="var(--text-4, #94A3B8)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', height: '42px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '0.5rem' }} />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <KeyRound size={18} style={{ marginRight: '0.5rem' }} />
                  Envoyer le lien de réinitialisation
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border, #E2E8F0)' }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3, #64748B)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
