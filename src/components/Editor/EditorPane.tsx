import React from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import LineItemsEditor from './LineItemsEditor';
import type { InvoiceStatus, PaymentTerm, DocumentType } from '../../types';
import { ALGERIA_TVA_RATES, CURRENCY_INFO } from '../../types';
import { addDays, format } from 'date-fns';

const PAYMENT_TERMS: PaymentTerm[] = ['Due on receipt', 'Net 15', 'Net 30', 'Net 60', 'Custom'];

const TERM_LABELS: Record<PaymentTerm, string> = {
  'Due on receipt': 'À réception',
  'Net 15': '15 jours',
  'Net 30': '30 jours',
  'Net 60': '60 jours',
  'Custom': 'Personnalisé',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft: 'Brouillon',
  Sent: 'Envoyé',
  Paid: 'Payé',
  Overdue: 'En retard',
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Facture',
  quote: 'Devis',
  proforma: 'Pro Forma',
};

const EditorPane: React.FC = () => {
  const { state, dispatch, activeProfile } = useInvoice();
  const doc = state.currentDocument;
  const isAutoEntrepreneur = activeProfile?.businessType === 'auto-entrepreneur';

  const handleSenderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    dispatch({ type: 'UPDATE_CURRENT_SENDER', payload: { [e.target.name]: e.target.value } });
  };

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    dispatch({ type: 'UPDATE_CURRENT_RECIPIENT', payload: { [e.target.name]: e.target.value } });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { logo: reader.result as string } });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const client = state.clients.find((c) => c.id === e.target.value);
    if (client) {
      dispatch({
        type: 'UPDATE_CURRENT_RECIPIENT',
        payload: {
          name: client.name, email: client.email, company: client.company,
          address: client.address, phone: client.phone,
          nif: client.nif, nis: client.nis, rc: client.rc, art: client.art,
        },
      });
    }
  };

  const handleTermChange = (term: PaymentTerm) => {
    let days = 0;
    if (term === 'Net 15') days = 15;
    else if (term === 'Net 30') days = 30;
    else if (term === 'Net 60') days = 60;

    const newDueDate = term === 'Custom' || term === 'Due on receipt'
      ? doc.dueDate
      : format(addDays(new Date(doc.date), days), 'yyyy-MM-dd');

    dispatch({
      type: 'SET_CURRENT_DOCUMENT',
      payload: { paymentTerm: term, dueDate: newDueDate },
    });
  };

  const inputStyle = { fontSize: '0.82rem' };
  const sectionCardStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Document Header Controls */}
      <div className="card" style={{ ...sectionCardStyle }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
          Configuration du document
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Type de document</label>
            <select
              value={doc.type}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { type: e.target.value as DocumentType } })}
              style={inputStyle}
            >
              {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Numéro</label>
            <input
              value={doc.invoiceNumber}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { invoiceNumber: e.target.value } })}
              style={inputStyle}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Statut</label>
            <select
              value={doc.status}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { status: e.target.value as InvoiceStatus } })}
              style={inputStyle}
            >
              {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Date d'émission</label>
            <input type="date" value={doc.date}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { date: e.target.value } })}
              style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Devise</label>
            <select
              value={doc.settings.currency}
              onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { currency: e.target.value as any } })}
              style={inputStyle}
            >
              {(Object.keys(CURRENCY_INFO) as (keyof typeof CURRENCY_INFO)[]).map((c) => (
                <option key={c} value={c}>{c} — {CURRENCY_INFO[c].name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ ...inputStyle, border: 'none', padding: '0' }} />
          </div>
        </div>
      </div>

      {/* Payment Terms */}
      <div className="card" style={{ ...sectionCardStyle }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
          Délai de paiement
        </div>
        <div className="term-chips">
          {PAYMENT_TERMS.map((term) => (
            <button
              key={term}
              type="button"
              className={`term-chip ${doc.paymentTerm === term ? 'active' : ''}`}
              onClick={() => handleTermChange(term)}
            >
              {TERM_LABELS[term]}
            </button>
          ))}
        </div>
        {doc.paymentTerm === 'Custom' && (
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label">Date d'échéance</label>
            <input type="date" value={doc.dueDate}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { dueDate: e.target.value } })}
              style={inputStyle} />
          </div>
        )}
      </div>

      {/* Parties: Emetteur + Client */}
      <div className="grid-2">
        {/* Emetteur */}
        <div className="card" style={{ ...sectionCardStyle }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
            Émetteur
          </div>
          <div className="form-group">
            <label className="form-label">Raison sociale</label>
            <input name="company" value={doc.sender.company} onChange={handleSenderChange} placeholder="ACME SARL" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom</label>
            <input name="name" value={doc.sender.name} onChange={handleSenderChange} placeholder="Gérant" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Adresse</label>
            <textarea name="address" value={doc.sender.address} onChange={handleSenderChange} rows={2} placeholder="Adresse complète" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" value={doc.sender.email} onChange={handleSenderChange} placeholder="contact@..." style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input name="phone" value={doc.sender.phone || ''} onChange={handleSenderChange} placeholder="0555 00 00 00" style={inputStyle} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">NIF</label>
              <input name="nif" value={doc.sender.nif || ''} onChange={handleSenderChange} style={inputStyle} />
            </div>
            <div className="form-group">
              <label className="form-label">{isAutoEntrepreneur ? "N° C.A.E" : "RC"}</label>
              <input name={isAutoEntrepreneur ? "cae" : "rc"} value={isAutoEntrepreneur ? (doc.sender.cae || '') : (doc.sender.rc || '')} onChange={handleSenderChange} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="card" style={{ ...sectionCardStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)' }}>Client</div>
            {state.clients.length > 0 && (
              <select onChange={handleClientSelect} defaultValue="" style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                <option value="" disabled>Sélectionner un client</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Raison sociale / Nom *</label>
            <input name="name" value={doc.recipient.name} onChange={handleRecipientChange} placeholder="Client SARL" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom du contact</label>
            <input name="company" value={doc.recipient.company} onChange={handleRecipientChange} placeholder="M. Benali" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Adresse</label>
            <textarea name="address" value={doc.recipient.address} onChange={handleRecipientChange} rows={2} placeholder="Adresse complète" style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" value={doc.recipient.email} onChange={handleRecipientChange} placeholder="contact@..." style={inputStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input name="phone" value={doc.recipient.phone || ''} onChange={handleRecipientChange} placeholder="0555 00 00 00" style={inputStyle} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">NIF</label>
              <input name="nif" value={doc.recipient.nif || ''} onChange={handleRecipientChange} style={inputStyle} />
            </div>
            <div className="form-group">
              <label className="form-label">RC / N° C.A.E</label>
              <input name="rc" value={doc.recipient.rc || ''} onChange={handleRecipientChange} style={inputStyle} placeholder="RC ou N° C.A.E" />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card" style={{ ...sectionCardStyle }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
          Articles / Prestations
        </div>
        <LineItemsEditor />
      </div>

      {/* Tax, Discount, Stamp Duty */}
      <div className="card" style={{ ...sectionCardStyle }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
          Taxes et réductions
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Taux TVA</label>
            <select
              value={doc.settings.taxRate}
              onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { taxRate: Number(e.target.value) } })}
              style={inputStyle}
            >
              {ALGERIA_TVA_RATES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Remise</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select
                value={doc.settings.discountType}
                onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { discountType: e.target.value as any } })}
                style={{ ...inputStyle, width: 'auto', flexShrink: 0 }}
              >
                <option value="percentage">%</option>
                <option value="fixed">Fixe</option>
              </select>
              <input
                type="number"
                value={doc.settings.discountValue}
                onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { discountValue: Number(e.target.value) || 0 } })}
                min="0"
                step="any"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={doc.settings.applyStampDuty}
              onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { applyStampDuty: e.target.checked } })}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            Droit de timbre
          </label>
          {doc.settings.applyStampDuty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                value={doc.settings.stampDutyAmount}
                onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { stampDutyAmount: Number(e.target.value) || 0 } })}
                style={{ ...inputStyle, width: 90 }}
                min="0"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-4)' }}>DA</span>
            </div>
          )}
        </div>
        
        {/* Cachet / Signature toggle (only if profile has a stamp) */}
        {activeProfile?.stamp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={doc.settings.showStamp}
                onChange={(e) => dispatch({ type: 'UPDATE_CURRENT_SETTINGS', payload: { showStamp: e.target.checked } })}
                style={{ width: 'auto', accentColor: 'var(--accent)' }}
              />
              Afficher le cachet / signature
            </label>
          </div>
        )}
      </div>



      {/* Notes */}
      <div className="card" style={{ ...sectionCardStyle }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
          Notes / Conditions de paiement
        </div>
        <textarea
          rows={3}
          value={doc.notes}
          onChange={(e) => dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: { notes: e.target.value } })}
          placeholder="Merci pour votre confiance. Paiement par virement bancaire dans le délai convenu."
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>
  );
};

export default EditorPane;
