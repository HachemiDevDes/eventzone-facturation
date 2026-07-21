import React, { useState, useRef, useEffect } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { LayoutDashboard, Users, Settings, Plus, FileText, ChevronDown, CheckCircle2, Building2, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { state, dispatch, activeProfile } = useInvoice();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);



  const handleCreateDocument = (type: 'invoice' | 'quote' | 'proforma') => {
    const newId = crypto.randomUUID();
    dispatch({ type: 'START_NEW_DOCUMENT', payload: { type, id: newId } });
    if (onClose) onClose();
    navigate(`/builder/${newId}`);
  };

  const handleSelectProfile = (id: string) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: id });
    setProfileMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const initials = (activeProfile?.company || activeProfile?.name || 'E')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Header: Logo + Profile Switcher */}
      <div className="sidebar-header">
        {/* Branding */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <FileText size={16} color="#0F172A" />
          </div>
          <div>
            <div className="sidebar-logo-text">Fawtara</div>
            <div className="sidebar-logo-sub">Facturation Algérie</div>
          </div>
        </div>

        {/* Profile Switcher */}
        <div className="profile-dropdown" ref={menuRef}>
          <button className="profile-switcher" onClick={() => setProfileMenuOpen((v) => !v)}>
            <div className="profile-avatar">{initials || <Building2 size={12} />}</div>
            <span className="profile-name">{activeProfile?.company || activeProfile?.name || 'Profil'}</span>
            <ChevronDown size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
          </button>

          {profileMenuOpen && (
            <div className="profile-menu">
              {state.profiles.map((p) => (
                <button
                  key={p.id}
                  className={`profile-menu-item ${p.id === state.activeProfileId ? 'active' : ''}`}
                  onClick={() => handleSelectProfile(p.id)}
                >
                  <div className="profile-avatar" style={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                    {(p.company || p.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.company || p.name || p.profileName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{p.profileName}</div>
                  </div>
                  {p.id === state.activeProfileId && <CheckCircle2 size={14} color="var(--text-2)" />}
                </button>
              ))}
              <div className="divider" />
              <button
                className="profile-menu-item"
                onClick={() => { navigate('/settings'); setProfileMenuOpen(false); }}
              >
                <Plus size={14} />
                <span style={{ fontSize: '0.82rem' }}>Gérer les profils</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Document Actions */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Nouveau document</div>
      </div>
      <div className="sidebar-actions" style={{ paddingTop: 0 }}>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.82rem' }}
          onClick={() => handleCreateDocument('invoice')}>
          <Plus size={14} /> Nouvelle Facture
        </button>
        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.82rem' }}
          onClick={() => handleCreateDocument('quote')}>
          <Plus size={14} /> Nouveau Devis
        </button>
        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.82rem' }}
          onClick={() => handleCreateDocument('proforma')}>
          <Plus size={14} /> Facture Pro Forma
        </button>
      </div>

      {/* Navigation */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
      </div>
      <nav className="sidebar-nav">
        {(
          [
            { tab: 'dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
            { tab: 'clients', icon: Users, label: 'Clients' },
            { tab: 'settings', icon: Settings, label: 'Paramètres' },
          ] as const
        ).map(({ tab, icon: Icon, label }) => (
          <Link
            key={tab}
            to={`/${tab}`}
            onClick={handleNavClick}
            className={`nav-item ${location.pathname.includes(tab) ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <button 
        className="nav-item" 
        onClick={handleLogout}
        style={{ color: 'var(--text-3)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <LogOut size={16} />
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Déconnexion</span>
      </button>

      <div className="sidebar-footer">
        Fawtara v2.1 · Conçu pour l'Algérie
      </div>
    </aside>
  );
};

export default Sidebar;
