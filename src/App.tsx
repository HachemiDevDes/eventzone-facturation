import { useState, useEffect } from 'react';
import { useInvoice } from './context/InvoiceContext';
import Sidebar from './components/Dashboard/Sidebar';
import HistoryTab from './components/Dashboard/HistoryTab';
import ClientsTab from './components/Dashboard/ClientsTab';
import SettingsTab from './components/Dashboard/SettingsTab';
import EditorPane from './components/Editor/EditorPane';
import PreviewPane from './components/Preview/PreviewPane';
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react';

function App() {
  const { state, dispatch } = useInvoice();
  const [saved, setSaved] = useState(false);
  // Listen for save events
  useEffect(() => {
    const handleSaved = () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    };

    window.addEventListener('invoice_saved', handleSaved);
    return () => {
      window.removeEventListener('invoice_saved', handleSaved);
    };
  }, []);

  const isBuilderTab = state.activeTab === 'builder';

  const handleSave = () => {
    dispatch({ type: 'SAVE_DOCUMENT' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'dashboard' });
  };

  // ── Builder Layout ──────────────────────────────────────────────
  if (isBuilderTab) {
    return (
      <div className="split-layout">
        {/* Editor */}
        <div className="editor-pane">
          {/* Editor Topbar */}
          <div className="editor-topbar">
            <button className="btn btn-ghost" onClick={handleBack} style={{ gap: '0.35rem' }}>
              <ArrowLeft size={15} />
              <span style={{ fontSize: '0.82rem' }}>Retour</span>
            </button>
            <div style={{ flex: 1 }} />
            {saved && (
              <div className="saved-indicator">
                <CheckCircle2 size={13} /> Sauvegardé
              </div>
            )}
            <button className="btn btn-primary" onClick={handleSave} style={{ fontSize: '0.82rem' }}>
              <Save size={14} />
              {state.editingDocumentId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>

          {/* Editor Body */}
          <div className="editor-body">
            <EditorPane />
          </div>
        </div>

        {/* Preview */}
        <PreviewPane />
      </div>
    );
  }

  // ── Dashboard Layout ────────────────────────────────────────────
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="content-pane">
          {state.activeTab === 'dashboard' && <HistoryTab />}
          {state.activeTab === 'clients' && <ClientsTab />}
          {state.activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

export default App;
