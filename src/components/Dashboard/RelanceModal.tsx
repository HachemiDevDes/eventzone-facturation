import React, { useState } from 'react';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { X, RotateCcw, Send, CheckCircle2 } from 'lucide-react';
import type { DocumentData } from '../../types';

interface RelanceModalProps {
  document: DocumentData;
  onClose: () => void;
  onSendRelance: (level: 1 | 2 | 3, notes: string) => void;
}

const RELANCE_TEMPLATES = {
  1: (inv: DocumentData, remainingAmt: string) => `Madame, Monsieur,

Sauf erreur ou omission de notre part, il apparaît que la facture N° ${inv.invoiceNumber} d'un montant de ${remainingAmt}, établie le ${formatDateShort(inv.date)}, n'a pas encore été réglée à ce jour.

Nous vous remercions de bien vouloir procéder à son règlement dans les meilleurs délais.

Dans l'hypothèse où votre règlement aurait déjà été effectué, nous vous prions de ne pas tenir compte de la présente.

Cordialement,
${inv.sender.company || inv.sender.name}`,

  2: (inv: DocumentData, remainingAmt: string) => `Madame, Monsieur,

Malgré notre première relance, nous n'avons pas encore reçu le règlement de la facture N° ${inv.invoiceNumber} d'un montant de ${remainingAmt}, dont l'échéance était fixée au ${formatDateShort(inv.dueDate)}.

Nous vous demandons de bien vouloir régulariser cette situation sans délai.

À défaut de règlement sous 8 jours, nous nous verrons dans l'obligation de recourir à toute procédure de recouvrement.

Cordialement,
${inv.sender.company || inv.sender.name}`,

  3: (inv: DocumentData, remainingAmt: string) => `MISE EN DEMEURE

Madame, Monsieur,

Malgré nos précédentes relances restées sans suite, la facture N° ${inv.invoiceNumber} d'un montant de ${remainingAmt} (échéance du ${formatDateShort(inv.dueDate)}) demeure impayée.

Par la présente, nous vous mettons en demeure de procéder au règlement intégral de cette créance dans un délai de 48 heures à compter de la réception de ce courrier.

À défaut, nous engagerons sans autre avis les procédures légales de recouvrement forcé.

Fait à Alger, le ${formatDateShort(new Date().toISOString().split('T')[0])}

${inv.sender.company || inv.sender.name}
${inv.sender.address}`,
};

export const RelanceModal: React.FC<RelanceModalProps> = ({ document, onClose, onSendRelance }) => {
  const existingRelances = document.relances || [];
  const maxLevel = existingRelances.length > 0 ? Math.max(...existingRelances.map(r => r.level)) : 0;
  const nextLevel = Math.min(3, maxLevel + 1) as 1 | 2 | 3;

  const levelLabels = { 1: '1ère Relance', 2: '2ème Relance', 3: 'Mise en Demeure' };
  const levelColors = { 1: '#1D4ED8', 2: '#B45309', 3: '#BE123C' };
  const levelBgs = { 1: '#EFF6FF', 2: '#FFFBEB', 3: '#FFF1F2' };

  // Compute remaining amount
  const subtotal = document.items.reduce((a, i) => a + i.quantity * i.rate, 0);
  const disc = document.settings.discountType === 'percentage' ? subtotal * (document.settings.discountValue / 100) : document.settings.discountValue;
  const taxable = Math.max(0, subtotal - disc);
  const tva = taxable * ((document.settings.taxRate || 0) / 100);
  const stamp = document.settings.applyStampDuty ? (document.settings.stampDutyAmount || 0) : 0;
  const total = taxable + tva + stamp;
  const remainingAmt = formatCurrency(total, document.settings.currency);

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(nextLevel);
  const [letterText, setLetterText] = useState(RELANCE_TEMPLATES[nextLevel](document, remainingAmt));
  const [notes, setNotes] = useState('');

  const handleLevelChange = (l: 1 | 2 | 3) => {
    setSelectedLevel(l);
    setLetterText(RELANCE_TEMPLATES[l](document, remainingAmt));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
  };

  const handleConfirm = () => {
    onSendRelance(selectedLevel, notes);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', margin: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Relance Client</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Facture N° {document.invoiceNumber} · {document.recipient.name || document.recipient.company}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Existing relance history */}
        {existingRelances.length > 0 && (
          <div style={{ padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--r-sm)', marginBottom: '1rem', flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.4rem' }}>HISTORIQUE DES RELANCES</div>
            {existingRelances.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                <CheckCircle2 size={12} color="#16A34A" />
                <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{levelLabels[r.level]}</span>
                <span style={{ color: 'var(--text-4)' }}>· {formatDateShort(r.date)}</span>
                {r.notes && <span style={{ color: 'var(--text-3)' }}>· {r.notes}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Level selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {([1, 2, 3] as const).map(l => (
            <button key={l} onClick={() => handleLevelChange(l)}
              style={{
                flex: 1, minWidth: 100, padding: '0.5rem', borderRadius: 'var(--r-sm)', border: '1.5px solid',
                borderColor: selectedLevel === l ? levelColors[l] : 'var(--border)',
                background: selectedLevel === l ? levelBgs[l] : 'transparent',
                color: selectedLevel === l ? levelColors[l] : 'var(--text-3)',
                fontWeight: selectedLevel === l ? 700 : 400, fontSize: '0.8rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {levelLabels[l]}
              {existingRelances.some(r => r.level === l) && ' ✓'}
            </button>
          ))}
        </div>

        {/* Letter preview */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
            Modèle de lettre — {levelLabels[selectedLevel]}
          </label>
          <textarea
            className="input-field"
            value={letterText}
            onChange={e => setLetterText(e.target.value)}
            style={{ minHeight: 260, fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7, resize: 'vertical' }}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '0.25rem' }}>
            Vous pouvez modifier librement le texte avant de l'envoyer.
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Notes internes (non envoyées)</label>
            <input type="text" className="input-field" placeholder="Ex: Contacté par téléphone le..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexShrink: 0, paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-outline" onClick={handleCopy}>
            <RotateCcw size={14} /> Copier le texte
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            <Send size={14} /> Confirmer la relance
          </button>
        </div>
      </div>
    </div>
  );
};
