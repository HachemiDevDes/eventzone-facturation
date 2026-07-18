import { useState, useEffect } from 'react';
import { useInvoice } from './context/InvoiceContext';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Dashboard/Sidebar';
import HistoryTab from './components/Dashboard/HistoryTab';
import ClientsTab from './components/Dashboard/ClientsTab';
import SettingsTab from './components/Dashboard/SettingsTab';
import EditorPane from './components/Editor/EditorPane';
import PreviewPane from './components/Preview/PreviewPane';
import { ArrowLeft, CheckCircle2, Link as LinkIcon } from 'lucide-react';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route path="/builder/:id" element={<BuilderRouteWrapper />} />

      <Route path="/*" element={
        <div className="dashboard-layout">
          <Sidebar />
          <main className="main-content">
            <div className="content-pane">
              <Routes>
                <Route path="dashboard" element={<HistoryTab />} />
                <Route path="clients" element={<ClientsTab />} />
                <Route path="settings" element={<SettingsTab />} />
              </Routes>
            </div>
          </main>
        </div>
      } />
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
      <div className="editor-pane">
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
            {copied ? 'Lien copié !' : 'Copier le lien'}
          </button>
          <div className="saved-indicator" style={{ opacity: saved ? 1 : 0.6 }}>
            <CheckCircle2 size={13} /> {saved ? 'Sauvegardé' : 'Synchronisé en temps réel'}
          </div>
        </div>
        <div className="editor-body">
          <EditorPane />
        </div>
      </div>
      <PreviewPane />
    </div>
  );
}

export default App;
