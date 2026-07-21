import { useState, useEffect } from 'react';
import { useInvoice } from './context/InvoiceContext';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import Sidebar from './components/Dashboard/Sidebar';
import HistoryTab from './components/Dashboard/HistoryTab';
import ClientsTab from './components/Dashboard/ClientsTab';
import SettingsTab from './components/Dashboard/SettingsTab';
import EditorPane from './components/Editor/EditorPane';
import PreviewPane from './components/Preview/PreviewPane';
import { ArrowLeft, CheckCircle2, Link as LinkIcon, Menu, X, LayoutDashboard, Users, Settings, Plus, FileText, Eye, Edit3 } from 'lucide-react';

function DashboardLayout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { dispatch } = useInvoice();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCreateDocument = () => {
    const newId = crypto.randomUUID();
    dispatch({ type: 'START_NEW_DOCUMENT', payload: { type: 'invoice', id: newId } });
    navigate(`/builder/${newId}`);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile Header Bar */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <div className="sidebar-logo-mark" style={{ width: 28, height: 28 }}>
            <FileText size={14} color="#0F172A" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>Fawtara</span>
        </div>
        <button
          className="btn-icon"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Menu"
        >
          {mobileDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      <div
        className={`sidebar-backdrop ${mobileDrawerOpen ? 'active' : ''}`}
        onClick={() => setMobileDrawerOpen(false)}
      />

      <Sidebar isOpen={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />

      <main className="main-content">
        <div className="content-pane">
          <Routes>
            <Route path="dashboard" element={<HistoryTab />} />
            <Route path="clients" element={<ClientsTab />} />
            <Route path="settings" element={<SettingsTab />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <Link
          to="/dashboard"
          className={`mobile-nav-item ${location.pathname.includes('dashboard') ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </Link>

        <Link
          to="/clients"
          className={`mobile-nav-item ${location.pathname.includes('clients') ? 'active' : ''}`}
        >
          <Users size={18} />
          <span>Clients</span>
        </Link>

        <button className="mobile-nav-fab" onClick={handleCreateDocument} title="Nouvelle facture">
          <Plus size={22} color="#0F172A" />
        </button>

        <Link
          to="/settings"
          className={`mobile-nav-item ${location.pathname.includes('settings') ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>Paramètres</span>
        </Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/builder/:id" element={<BuilderRouteWrapper />} />
      <Route path="/*" element={<DashboardLayout />} />
    </Routes>
  );
}


// ─── Builder Route Wrapper ──────────────────────────────────────────────────
function BuilderRouteWrapper() {
  const { id } = useParams();
  const { state, dispatch, isLoaded } = useInvoice();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const handleSaved = () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    };
    window.addEventListener('invoice_saved', handleSaved);
    return () => window.removeEventListener('invoice_saved', handleSaved);
  }, []);

  // Once data is loaded, find and activate the document by URL id
  useEffect(() => {
    if (!isLoaded || !id) return;
    if (state.currentDocument.id === id) return; // already active

    const doc = state.documents.find((d) => d.id === id);
    if (doc) {
      dispatch({ type: 'EDIT_DOCUMENT', payload: id });
    } else {
      // Document truly doesn't exist — go back to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [isLoaded, id, state.documents, state.currentDocument.id, dispatch, navigate]);

  const handleBack = () => {
    dispatch({ type: 'SAVE_DOCUMENT' });
    navigate('/dashboard');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Show spinner while loading data from localStorage/Supabase
  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-3)', fontSize: '0.9rem',
      }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="split-layout">
      {/* Mobile Tab Controls */}
      <div className="builder-mobile-tabs">
        <button
          className={`builder-tab-btn ${mobileTab === 'edit' ? 'active' : ''}`}
          onClick={() => setMobileTab('edit')}
        >
          <Edit3 size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Éditer
        </button>
        <button
          className={`builder-tab-btn ${mobileTab === 'preview' ? 'active' : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          <Eye size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Aperçu & Export
        </button>
      </div>

      <div className={`editor-pane ${mobileTab === 'preview' ? 'mobile-hidden' : ''}`}>
        <div className="editor-topbar">
          <button className="btn btn-ghost" onClick={handleBack} style={{ gap: '0.35rem' }}>
            <ArrowLeft size={15} />
            <span style={{ fontSize: '0.82rem' }}>Retour</span>
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost"
            onClick={handleCopyLink}
            title="Copier le lien de ce document"
            style={{ gap: '0.35rem', fontSize: '0.75rem', color: copied ? 'var(--accent)' : 'var(--text-3)' }}
          >
            <LinkIcon size={13} />
            {copied ? 'Copié !' : 'Copier le lien'}
          </button>
          <div className="saved-indicator" style={{ opacity: saved ? 1 : 0.6 }}>
            <CheckCircle2 size={13} /> {saved ? 'Sauvegardé' : 'Synchro'}
          </div>
        </div>
        <div className="editor-body">
          <EditorPane />
        </div>
      </div>

      <div className={`preview-pane-wrapper ${mobileTab === 'edit' ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PreviewPane />
      </div>
    </div>
  );
}

export default App;
