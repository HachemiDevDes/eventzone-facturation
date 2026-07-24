import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatDateShort } from '../../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, Paperclip, ExternalLink, UploadCloud } from 'lucide-react';
import type { DocumentData, DocumentAttachment, AttachmentCategory } from '../../types';

interface AttachmentsModalProps {
  document: DocumentData;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  signed_document: 'Facture / Devis signé',
  contract: 'Contrat / Convention client',
  proof_of_payment: 'Scan chèque / Reçu de virement',
  other: 'Autre document',
};

const CATEGORY_BADGES: Record<AttachmentCategory, { bg: string; color: string; border: string; icon: string }> = {
  signed_document: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', icon: '✍️' },
  contract: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', icon: '📜' },
  proof_of_payment: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A', icon: '💳' },
  other: { bg: 'var(--surface-2)', color: 'var(--text-2)', border: 'var(--border)', icon: '📎' },
};

export const AttachmentsModal: React.FC<AttachmentsModalProps> = ({ document, onClose }) => {
  const { state, dispatch } = useInvoice();

  const [category, setCategory] = useState<AttachmentCategory>('signed_document');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const docAttachments = document.attachments || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFile({
        name: file.name,
        url: reader.result as string,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddAttachment = () => {
    if (!selectedFile) return;
    const attachment: DocumentAttachment = {
      id: uuidv4(),
      documentId: document.id,
      profileId: document.settings.profileId || state.activeProfileId,
      name: selectedFile.name,
      url: selectedFile.url,
      category,
      uploadDate: new Date().toISOString().split('T')[0],
      sizeBytes: selectedFile.size,
      notes: notes.trim() || undefined,
    };

    dispatch({ type: 'ADD_DOCUMENT_ATTACHMENT', payload: attachment });
    setSelectedFile(null);
    setNotes('');
    setShowForm(false);
  };

  const handleDelete = (attachmentId: string) => {
    if (window.confirm('Supprimer cette pièce jointe ?')) {
      dispatch({
        type: 'DELETE_DOCUMENT_ATTACHMENT',
        payload: { documentId: document.id, attachmentId },
      });
    }
  };

  const openAttachment = (url: string, name: string) => {
    const win = window.open();
    if (win) {
      win.document.write(`<title>${name}</title><iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Paperclip size={18} /> Pièces jointes & Documents signés
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Document N° {document.invoiceNumber} · {document.recipient.name || document.recipient.company}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Existing Attachments List */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {docAttachments.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-4)' }}>
              <UploadCloud size={36} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-2)' }}>Aucune pièce jointe liée</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                Joignez les factures signées par le client, les contrats, scannés de chèques ou tout autre document.
              </div>
            </div>
          )}

          {docAttachments.map(att => {
            const badge = CATEGORY_BADGES[att.category] || CATEGORY_BADGES.other;
            return (
              <div key={att.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', marginBottom: '0.5rem',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              }}>
                <div style={{ fontSize: '1.3rem' }}>{badge.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--r-full)', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                    }}>
                      {CATEGORY_LABELS[att.category]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
                    Ajouté le {formatDateShort(att.uploadDate)} {att.sizeBytes ? `· ${formatFileSize(att.sizeBytes)}` : ''}
                    {att.notes && ` · ${att.notes}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => openAttachment(att.url, att.name)}>
                    <ExternalLink size={13} /> Ouvrir
                  </button>
                  <button className="btn-icon" style={{ color: 'var(--status-overdue-text)' }}
                    onClick={() => handleDelete(att.id)} title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Attachment Form */}
          {showForm && (
            <div style={{ border: '2px solid var(--accent)', borderRadius: 'var(--r-md)', padding: '1rem', marginTop: '0.5rem', background: 'var(--bg)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Ajouter un fichier (Tous types acceptés)
              </div>

              {/* Category */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Type de document</label>
                <select className="input-field" value={category}
                  onChange={e => setCategory(e.target.value as AttachmentCategory)}>
                  <option value="signed_document">✍️ Facture / Devis signé par le client</option>
                  <option value="contract">📜 Contrat / Convention / Cahier des charges</option>
                  <option value="proof_of_payment">💳 Scan chèque / Capture virement / Reçu</option>
                  <option value="other">📎 Autre document (PDF, Word, Excel, Image...)</option>
                </select>
              </div>

              {/* File Input */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Sélectionner un fichier</label>
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleFileChange}
                  style={{ fontSize: '0.82rem' }}
                />
                {selectedFile && (
                  <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '0.3rem', fontWeight: 600 }}>
                    ✓ Fichier prêt : {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '0.875rem' }}>
                <label className="form-label">Notes ou référence (optionnel)</label>
                <input type="text" className="input-field" placeholder="Ex: Signé par le directeur le 24/07/2026"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setSelectedFile(null); }}>Annuler</button>
                <button className="btn btn-primary" onClick={handleAddAttachment} disabled={!selectedFile}>
                  <UploadCloud size={15} /> Téléverser le fichier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {docAttachments.length} document(s) rattaché(s)
          </div>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Ajouter un fichier
            </button>
          )}
          {showForm && (
            <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
};
