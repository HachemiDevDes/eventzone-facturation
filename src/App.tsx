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
  const [syncLogs, setSyncLogs] = useState<{msg: string, isError: boolean}[]>([]);

  // Listen for save events
  useEffect(() => {
    const handleSaved = () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    };

    const handleError = (e: any) => {
      setSyncLogs(prev => [...prev, { msg: e.detail, isError: true }]);
    };

    const handleLog = (e: any) => {
      setSyncLogs(prev => [...prev, { msg: e.detail, isError: false }]);
    };

    window.addEventListener('invoice_saved', handleSaved);
    window.addEventListener('sync_error', handleError);
    window.addEventListener('sync_log', handleLog);
    return () => {
      window.removeEventListener('invoice_saved', handleSaved);
      window.removeEventListener('sync_error', handleError);
      window.removeEventListener('sync_log', handleLog);
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

      {/* Sync Debug Panel */}
      {syncLogs.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '400px',
          maxHeight: '300px',
          background: '#1f2937',
          color: '#f3f4f6',
          borderRadius: '8px',
          padding: '1rem',
          overflowY: 'auto',
          zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#9ca3af' }}>Sync Logs</h3>
            <button onClick={() => setSyncLogs([])} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {syncLogs.map((log, i) => (
              <div key={i} style={{ 
                fontSize: '0.8rem', 
                color: log.isError ? '#ef4444' : '#10b981',
                borderBottom: '1px solid #374151',
                paddingBottom: '4px'
              }}>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
