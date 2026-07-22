import React from 'react';
import type { BusinessProfile, DocumentData, Expense, TaxSettings } from '../../types';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { Printer, X } from 'lucide-react';

interface TaxDeclarationExportProps {
  profile: BusinessProfile;
  periodLabel: string;
  taxSettings: TaxSettings;
  sales: DocumentData[];
  expenses: Expense[];
  tvaCollected: number;
  tvaDeductible: number;
  tvaPayable: number;
  tvaCredit: number;
  salesHT: number;
  expensesHT: number;
  netProfit: number;
  ibsAmount: number;
  irgAmount: number;
  onClose: () => void;
}

export const TaxDeclarationExport: React.FC<TaxDeclarationExportProps> = ({
  profile,
  periodLabel,
  taxSettings,
  sales,
  expenses: _expenses,
  tvaCollected,
  tvaDeductible,
  tvaPayable,
  tvaCredit,
  salesHT,
  expensesHT,
  netProfit,
  ibsAmount,
  irgAmount: _irgAmount,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          background: '#ffffff',
          padding: '2rem',
        }}
      >
        {/* Controls */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Récapitulatif Fiscal & Déclaration G50</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>
              Document préparatoire pour la déclaration fiscale ({periodLabel})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={15} /> Imprimer / Imprimer en PDF
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div id="tax-export-sheet" style={{ background: '#ffffff', color: '#0F172A', fontSize: '0.85rem' }}>
          {/* Header */}
          <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{profile.company || profile.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.25rem' }}>{profile.address}, {profile.wilaya}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                NIF: {profile.nif || '—'} · NIS: {profile.nis || '—'} · RC: {profile.rc || '—'} · Art. Imp: {profile.art || '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>RÉCAPITULATIF FISCAL</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563EB', marginTop: '0.2rem' }}>Période : {periodLabel}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.2rem' }}>Généré le : {formatDateShort(new Date().toISOString())}</div>
            </div>
          </div>

          {/* Tax Summary Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#334155', marginBottom: '0.75rem' }}>
              1. Synthèse TVA (Déclaration G50)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>TVA Collectée (Ventes éligibles)</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(tvaCollected, 'DZD')}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>TVA Déductible (Achats avec justificatif)</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                    - {formatCurrency(tvaDeductible, 'DZD')}
                  </td>
                </tr>
                <tr style={{ background: tvaPayable > 0 ? '#FEF2F2' : '#F0FDF4', borderTop: '2px solid #0F172A' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 800, fontSize: '0.9rem' }}>
                    {tvaPayable > 0 ? 'TVA Net à Payer' : 'Crédit de TVA Reportable'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: tvaPayable > 0 ? '#DC2626' : '#16A34A' }}>
                    {formatCurrency(tvaPayable > 0 ? tvaPayable : tvaCredit, 'DZD')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* IBS & Profit Summary */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#334155', marginBottom: '0.75rem' }}>
              2. Impôt sur les Bénéfices des Sociétés (IBS)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}>Chiffre d'Affaires HT (Factures émises)</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(salesHT, 'DZD')}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}>Total Charges / Achats HT</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>- {formatCurrency(expensesHT, 'DZD')}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Bénéfice Net Imposable HT</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(netProfit, 'DZD')}</td>
                </tr>
                <tr style={{ background: '#F1F5F9', borderTop: '2px solid #0F172A' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 800 }}>
                    IBS Estimé {taxSettings.isStartupLabelActive ? '(Exonération Label Startup Active)' : `(${taxSettings.ibsRate}%)`}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>
                    {formatCurrency(ibsAmount, 'DZD')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sales Invoices Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
              Détail des Factures de Ventes ({sales.length})
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid #E2E8F0' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>N° Facture</th>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>Client</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Montant HT</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>TVA</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'center', color: '#94A3B8' }}>Aucune facture de vente sur la période</td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '0.4rem' }}>{formatDateShort(s.date)}</td>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{s.invoiceNumber}</td>
                      <td style={{ padding: '0.4rem' }}>{s.recipient.company || s.recipient.name}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{formatCurrency(s.items.reduce((sum, i) => sum + i.quantity * i.rate, 0), 'DZD')}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{formatCurrency((s.items.reduce((sum, i) => sum + i.quantity * i.rate, 0) * (s.settings.taxRate || 0)) / 100, 'DZD')}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.items.reduce((sum, i) => sum + i.quantity * i.rate, 0) * (1 + (s.settings.taxRate || 0) / 100), 'DZD')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Legal Certification Footer */}
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B' }}>
            <div>Document généré par Fawtara · Conforme à la réglementation fiscale algérienne</div>
            <div>Cachet & Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
};
