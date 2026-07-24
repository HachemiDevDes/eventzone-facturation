import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatCurrency, formatDateShort, calculateTotals } from '../../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import { CreditCard, CheckCircle2, Clock, Trash2, Plus, X } from 'lucide-react';
import type { DocumentData, Payment, PaymentMethod } from '../../types';

interface PaiementsModalProps {
  document: DocumentData;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Virement', 'Chèque', 'Espèces', 'Carte'];

export const PaiementsModal: React.FC<PaiementsModalProps> = ({ document, onClose }) => {
  const { state, dispatch } = useInvoice();

  const [newPayment, setNewPayment] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'Virement' as PaymentMethod,
    reference: '',
    notes: '',
  });
  const [showForm, setShowForm] = useState(false);

  const docPayments = state.payments
    .filter(p => p.documentId === document.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totals = calculateTotals(
    document.items,
    document.settings.taxRate,
    document.settings.discountType,
    document.settings.discountValue,
    document.settings.applyStampDuty,
    document.settings.stampDutyAmount
  );
  const invoiceTotal = totals.total;
  const totalPaid = docPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, invoiceTotal - totalPaid);
  const paidPct = invoiceTotal > 0 ? Math.min(100, (totalPaid / invoiceTotal) * 100) : 0;

  const handleAddPayment = () => {
    if (newPayment.amount <= 0) return;
    const payment: Payment = {
      id: uuidv4(),
      documentId: document.id,
      profileId: document.settings.profileId || state.activeProfileId,
      date: newPayment.date,
      amount: newPayment.amount,
      method: newPayment.method,
      reference: newPayment.reference,
      notes: newPayment.notes,
    };
    dispatch({ type: 'ADD_PAYMENT', payload: payment });
    setNewPayment({ date: new Date().toISOString().split('T')[0], amount: 0, method: 'Virement', reference: '', notes: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer cet encaissement ?')) {
      dispatch({ type: 'DELETE_PAYMENT', payload: id });
    }
  };

  const methodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'Virement': return '🏦';
      case 'Chèque': return '📝';
      case 'Espèces': return '💵';
      case 'Carte': return '💳';
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Paiements reçus</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Facture N° {document.invoiceNumber} · {document.recipient.name || document.recipient.company}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Invoice summary */}
        <div style={{ padding: '0.875rem', background: 'var(--surface)', borderRadius: 'var(--r-md)', marginBottom: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Total facture</span>
            <span style={{ fontWeight: 700 }}>{formatCurrency(invoiceTotal, document.settings.currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Total encaissé</span>
            <span style={{ fontWeight: 700, color: '#16A34A' }}>{formatCurrency(totalPaid, document.settings.currency)}</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${paidPct}%`, background: paidPct >= 100 ? '#16A34A' : '#D4F252', borderRadius: 99, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-3)' }}>{paidPct.toFixed(0)}% encaissé</span>
            <span style={{ fontWeight: 700, color: remaining > 0 ? '#B45309' : '#16A34A' }}>
              {remaining > 0 ? `Reste : ${formatCurrency(remaining, document.settings.currency)}` : '✅ Soldé'}
            </span>
          </div>
        </div>

        {/* Payment list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {docPayments.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-4)', fontSize: '0.85rem' }}>
              <CreditCard size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
              <div>Aucun paiement enregistré</div>
            </div>
          )}
          {docPayments.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem', marginBottom: '0.5rem',
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r-md)',
            }}>
              <div style={{ fontSize: '1.4rem' }}>{methodIcon(p.method)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {formatCurrency(p.amount, document.settings.currency)}
                  {p.reference && <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '0.78rem' }}> · {p.reference}</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {p.method} · {formatDateShort(p.date)}
                  {p.notes && ` · ${p.notes}`}
                </div>
              </div>
              <button className="btn-icon" style={{ color: 'var(--status-overdue-text)' }}
                onClick={() => handleDelete(p.id)} title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add Payment Form */}
          {showForm && (
            <div style={{ border: '2px solid var(--accent)', borderRadius: 'var(--r-md)', padding: '1rem', marginTop: '0.5rem' }}>
              <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="input-field" value={newPayment.date}
                    onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Montant reçu (DA)</label>
                  <input type="number" className="input-field" placeholder={`Max: ${remaining.toFixed(0)}`}
                    min="0" max={invoiceTotal}
                    value={newPayment.amount || ''}
                    onChange={e => setNewPayment(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Mode de paiement</label>
                  <select className="input-field" value={newPayment.method}
                    onChange={e => setNewPayment(p => ({ ...p, method: e.target.value as PaymentMethod }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{methodIcon(m)} {m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Référence (N° chèque/virement)</label>
                  <input type="text" className="input-field" placeholder="Ex: CHQ-001234"
                    value={newPayment.reference}
                    onChange={e => setNewPayment(p => ({ ...p, reference: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Notes (optionnel)</label>
                <input type="text" className="input-field" placeholder="Ex: Acompte 50%"
                  value={newPayment.notes}
                  onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={handleAddPayment} disabled={newPayment.amount <= 0}>
                  <CheckCircle2 size={15} /> Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {remaining <= 0
              ? <><CheckCircle2 size={13} color="#16A34A" /> Facture soldée</>
              : <><Clock size={13} /> {formatCurrency(remaining, document.settings.currency)} restant à recevoir</>}
          </div>
          {!showForm && remaining > 0 && (
            <button className="btn btn-primary" onClick={() => { setNewPayment(p => ({ ...p, amount: remaining })); setShowForm(true); }}>
              <Plus size={15} /> Ajouter paiement
            </button>
          )}
          {!showForm && remaining <= 0 && (
            <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
};
