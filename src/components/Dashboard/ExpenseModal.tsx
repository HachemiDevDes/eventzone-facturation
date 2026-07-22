import React, { useState, useEffect } from 'react';
import type { Expense, PaymentMethod, PaymentStatus } from '../../types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types';
import { X, Upload, FileText, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  initialData?: Expense | null;
  existingSuppliers: string[];
  customCategories?: string[];
  activeProfileId: string;
}

const EMPTY_EXPENSE = (profileId: string): Expense => ({
  id: crypto.randomUUID(),
  profileId,
  supplier: '',
  category: DEFAULT_EXPENSE_CATEGORIES[0],
  date: format(new Date(), 'yyyy-MM-dd'),
  invoiceNumber: '',
  amountHT: 0,
  taxRate: 19,
  amountTVA: 0,
  amountTTC: 0,
  paymentMethod: 'Virement',
  status: 'Paid',
  notes: '',
});

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingSuppliers,
  customCategories,
  activeProfileId,
}) => {
  const [formData, setFormData] = useState<Expense>(EMPTY_EXPENSE(activeProfileId));
  const [isManualTVA, setIsManualTVA] = useState(false);

  const categories = customCategories && customCategories.length > 0
    ? customCategories
    : DEFAULT_EXPENSE_CATEGORIES;

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setIsManualTVA(false);
    } else {
      setFormData(EMPTY_EXPENSE(activeProfileId));
      setIsManualTVA(false);
    }
  }, [initialData, isOpen, activeProfileId]);

  // Recalculate TVA and TTC when HT or taxRate changes, unless manually overridden
  const handleHTChange = (val: number) => {
    const ht = Math.max(0, val);
    const tva = isManualTVA ? formData.amountTVA : Math.round(ht * (formData.taxRate / 100) * 100) / 100;
    const ttc = Math.round((ht + tva) * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      amountHT: ht,
      amountTVA: tva,
      amountTTC: ttc,
    }));
  };

  const handleTaxRateChange = (rate: number) => {
    const tva = Math.round(formData.amountHT * (rate / 100) * 100) / 100;
    const ttc = Math.round((formData.amountHT + tva) * 100) / 100;
    setIsManualTVA(false);
    setFormData((prev) => ({
      ...prev,
      taxRate: rate,
      amountTVA: tva,
      amountTTC: ttc,
    }));
  };

  const handleTVAChange = (val: number) => {
    const tva = Math.max(0, val);
    setIsManualTVA(true);
    const ttc = Math.round((formData.amountHT + tva) * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      amountTVA: tva,
      amountTTC: ttc,
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          attachmentName: file.name,
          attachmentUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier.trim()) return;
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              {initialData ? 'Modifier l\'achat' : 'Enregistrer un achat'}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>
              Renseignez les détails de la facture fournisseur
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Supplier & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Fournisseur *</label>
              <input
                className="input-field"
                list="suppliers-list"
                placeholder="Ex: SARL Distributeur..."
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
              <datalist id="suppliers-list">
                {existingSuppliers.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">Catégorie d'achat</label>
              <select
                className="input-field"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoice Number & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Date d'achat</label>
              <input
                type="date"
                className="input-field"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">N° de facture fournisseur</label>
              <input
                className="input-field"
                placeholder="Ex: FACT-2026-089"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Financials: HT, Tax Rate, TVA, TTC */}
          <div
            style={{
              background: 'var(--surface)',
              padding: '1rem',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Montants & TVA
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Montant HT (DA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={formData.amountHT || ''}
                  onChange={(e) => handleHTChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Taux TVA</label>
                <select
                  className="input-field"
                  value={formData.taxRate}
                  onChange={(e) => handleTaxRateChange(parseFloat(e.target.value))}
                >
                  <option value={0}>0% (Exonéré)</option>
                  <option value={9}>9% (Réduit)</option>
                  <option value={19}>19% (Normal)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Montant TVA (DA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={formData.amountTVA || 0}
                  onChange={(e) => handleTVAChange(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Total TTC (DA)</label>
                <input
                  type="number"
                  className="input-field"
                  style={{ fontWeight: 700, background: 'var(--bg)', color: 'var(--text-1)' }}
                  value={formData.amountTTC || 0}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Payment Method & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Mode de paiement</label>
              <select
                className="input-field"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
              >
                <option value="Virement">Virement bancaire</option>
                <option value="Espèces">Espèces</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte">Carte bancaire</option>
              </select>
            </div>

            <div>
              <label className="form-label">Statut de paiement</label>
              <select
                className="input-field"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PaymentStatus })}
              >
                <option value="Paid">Payé</option>
                <option value="Pending">En attente</option>
                <option value="Partial">Partiellement payé</option>
              </select>
            </div>
          </div>

          {/* Attachment Upload */}
          <div>
            <label className="form-label">Facture fournisseur (Justificatif PDF / Image)</label>
            {formData.attachmentUrl ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="var(--accent-hover)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    {formData.attachmentName || 'Justificatif joint'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ color: 'var(--status-overdue-text)' }}
                  onClick={() => setFormData({ ...formData, attachmentName: undefined, attachmentUrl: undefined })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label
                className="upload-zone"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.25rem',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface)',
                }}
              >
                <Upload size={20} color="var(--text-4)" style={{ marginBottom: '0.3rem' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  Cliquez pour joindre une facture (PDF, PNG, JPG)
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Taille max : 10 Mo</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes / Remarques (Optionnel)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Remarques complémentaires sur cet achat..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle2 size={16} /> Enregistrer l'achat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
