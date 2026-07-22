import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatCurrency } from '../../utils/formatters';
import { DEFAULT_TAX_SETTINGS } from '../../types';
import type { TaxSettings } from '../../types';
import {
  Calculator,
  Calendar,
  AlertCircle,
  Printer,
  TrendingUp,
  Clock,
  ShieldCheck,
  Info,
  DollarSign,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaxDeclarationExport } from './TaxDeclarationExport';

export const TaxesTab: React.FC = () => {
  const { state, activeProfile } = useInvoice();
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [showExportModal, setShowExportModal] = useState(false);

  const profileId = state.activeProfileId;
  const taxSettings: TaxSettings = state.taxSettings[profileId] || DEFAULT_TAX_SETTINGS;

  // Date Intervals
  const now = new Date();
  let intervalStart: Date;
  let intervalEnd: Date;
  let periodLabel: string;

  if (periodType === 'month') {
    intervalStart = startOfMonth(now);
    intervalEnd = endOfMonth(now);
    periodLabel = format(now, 'MMMM yyyy', { locale: fr });
  } else if (periodType === 'quarter') {
    intervalStart = startOfQuarter(now);
    intervalEnd = endOfQuarter(now);
    const qNum = Math.floor(now.getMonth() / 3) + 1;
    periodLabel = `Trimestre Q${qNum} ${now.getFullYear()}`;
  } else {
    intervalStart = startOfYear(now);
    intervalEnd = endOfYear(now);
    periodLabel = `Année ${now.getFullYear()}`;
  }

  // Filter Sales & Purchases by Active Profile and Date Interval
  const profileSales = state.documents.filter((d) => d.settings?.profileId === profileId || (!d.settings?.profileId && profileId === state.profiles[0]?.id));
  const profileExpenses = state.expenses.filter((e) => e.profileId === profileId);

  const filteredSales = profileSales.filter((d) => {
    try {
      const docDate = parseISO(d.date);
      const isDateMatch = isWithinInterval(docDate, { start: intervalStart, end: intervalEnd });
      if (taxSettings.tvaRegime === 'encaissements') {
        return isDateMatch && d.status === 'Paid';
      }
      return isDateMatch;
    } catch {
      return false;
    }
  });

  const filteredExpenses = profileExpenses.filter((e) => {
    try {
      const expDate = parseISO(e.date);
      return isWithinInterval(expDate, { start: intervalStart, end: intervalEnd });
    } catch {
      return false;
    }
  });

  // Calculate Sales HT, TVA Collectée
  let salesHT = 0;
  let tvaCollected = 0;
  filteredSales.forEach((s) => {
    const ht = s.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const tva = (ht * (s.settings.taxRate || 0)) / 100;
    salesHT += ht;
    tvaCollected += tva;
  });

  // Calculate Expenses HT, TVA Déductible (Only for expenses WITH receipts or all depending on law)
  let expensesHT = 0;
  let tvaDeductible = 0;
  let missingReceiptCount = 0;

  filteredExpenses.forEach((e) => {
    expensesHT += e.amountHT;
    if (e.attachmentUrl) {
      tvaDeductible += e.amountTVA;
    } else {
      missingReceiptCount += 1;
    }
  });

  // Net TVA Output
  const netTVA = tvaCollected - tvaDeductible;
  const tvaPayable = netTVA > 0 ? netTVA : 0;
  const tvaCredit = netTVA < 0 ? Math.abs(netTVA) : 0;

  // Net Profit & IBS
  const netProfit = Math.max(0, salesHT - expensesHT);
  let estimatedIBS = 0;
  if (!taxSettings.isStartupLabelActive) {
    estimatedIBS = Math.round(netProfit * (taxSettings.ibsRate / 100));
  }

  // IRG Calculation (Algerian Barème Progressive for Manager Salary)
  const annualSalary = (taxSettings.managerMonthlySalary || 0) * 12;
  let annualIRG = 0;
  if (annualSalary > 240000) {
    if (annualSalary <= 480000) {
      annualIRG = (annualSalary - 240000) * 0.23;
    } else if (annualSalary <= 960000) {
      annualIRG = (480000 - 240000) * 0.23 + (annualSalary - 480000) * 0.27;
    } else if (annualSalary <= 1920000) {
      annualIRG = (480000 - 240000) * 0.23 + (960000 - 480000) * 0.27 + (annualSalary - 960000) * 0.3;
    } else {
      annualIRG =
        (480000 - 240000) * 0.23 +
        (960000 - 480000) * 0.27 +
        (1920000 - 960000) * 0.3 +
        (annualSalary - 1920000) * 0.33;
    }
  }
  const periodIRG = periodType === 'year' ? annualIRG : periodType === 'quarter' ? annualIRG / 4 : annualIRG / 12;

  // G50 Fiscal Deadline Calculation (20th of next month)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const daysUntilG50 = differenceInDays(nextMonth, now);

  // Total Tax Provisioned
  const totalTaxProvisioned = tvaPayable + estimatedIBS + periodIRG;

  return (
    <div>
      {/* Header & Controls */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Calculateur de Taxes & G50</h1>
          <p className="page-subtitle">Estimations fiscales automatiques selon la législation algérienne</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Period Selector Pills */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '0.2rem', borderRadius: 'var(--r-sm)' }}>
            {[
              { id: 'month', label: 'Mois' },
              { id: 'quarter', label: 'Trimestre' },
              { id: 'year', label: 'Année' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setPeriodType(pill.id as any)}
                className={`btn ${periodType === pill.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
            <Printer size={15} /> Exporter la déclaration
          </button>
        </div>
      </div>

      {/* Fiscal Deadline Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
          background: daysUntilG50 <= 5 ? '#FEF2F2' : '#F0F7FF',
          border: `1px solid ${daysUntilG50 <= 5 ? '#FECACA' : '#E0ECFB'}`,
          borderRadius: 'var(--r-sm)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Calendar size={20} color={daysUntilG50 <= 5 ? '#DC2626' : '#2563EB'} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: daysUntilG50 <= 5 ? '#991B1B' : '#1E40AF' }}>
              Prochaine échéance G50 : {format(nextMonth, '20 MMMM yyyy', { locale: fr })}
            </div>
            <div style={{ fontSize: '0.75rem', color: daysUntilG50 <= 5 ? '#B91C1C' : '#3B82F6' }}>
              Période concernée : {periodLabel} · Régime des {taxSettings.tvaRegime}
            </div>
          </div>
        </div>
        <span
          className="status-badge"
          style={{
            background: daysUntilG50 <= 5 ? '#FEE2E2' : '#DBEAFE',
            color: daysUntilG50 <= 5 ? '#991B1B' : '#1E40AF',
            fontWeight: 700,
          }}
        >
          {daysUntilG50} jours restants
        </span>
      </div>

      {/* Missing Receipt Warning Banner */}
      {missingReceiptCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 'var(--r-sm)',
            marginBottom: '1.5rem',
            color: '#B45309',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Attention : {missingReceiptCount} achat(s) sans justificatif joint.</strong> La TVA associée ne peut pas être déduite sur votre déclaration G50 sans facture fournisseur conforme.
          </div>
        </div>
      )}

      {/* Startup Label Exemption Banner */}
      {taxSettings.isStartupLabelActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--r-sm)',
            marginBottom: '1.5rem',
            color: '#065F46',
            fontSize: '0.82rem',
          }}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Exonération IBS "Label Startup" active.</strong> Votre entreprise bénéficie d'une exonération totale d'IBS. Taux d'IBS calculé = 0 DA.
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-card-accent">
          <div className="stat-icon">
            <Calculator size={18} />
          </div>
          <div className="stat-label">{tvaPayable > 0 ? 'TVA à Payer (G50)' : 'Crédit de TVA'}</div>
          <div className="stat-value">{formatCurrency(tvaPayable > 0 ? tvaPayable : tvaCredit, 'DZD')}</div>
          <div className="stat-meta">
            {tvaPayable > 0 ? 'À déclarer et payer' : 'Reportable sur la période suivante'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={18} />
          </div>
          <div className="stat-label">IBS Estimé</div>
          <div className="stat-value">
            {taxSettings.isStartupLabelActive ? '0 DA (Exonéré)' : formatCurrency(estimatedIBS, 'DZD')}
          </div>
          <div className="stat-meta">
            {taxSettings.isStartupLabelActive ? 'Label Startup Exonéré' : `Taux imposable : ${taxSettings.ibsRate}%`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={18} />
          </div>
          <div className="stat-label">IRG Gérant Estimé</div>
          <div className="stat-value">{formatCurrency(periodIRG, 'DZD')}</div>
          <div className="stat-meta">Basé sur salaire déclaré ({formatCurrency(taxSettings.managerMonthlySalary, 'DZD')}/mois)</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={18} />
          </div>
          <div className="stat-label">Total Provision Nécessaire</div>
          <div className="stat-value" style={{ color: 'var(--text-1)' }}>
            {formatCurrency(totalTaxProvisioned, 'DZD')}
          </div>
          <div className="stat-meta">Réserve recommandée</div>
        </div>
      </div>

      {/* Detailed Transparent Calculation Table (No Black Box) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              Détail transparent du calcul fiscal ({periodLabel})
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>
              Décomposition ligne par ligne des montants de vente, d'achat et des taxes calculées
            </p>
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              background: 'var(--surface-2)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--r-sm)',
              fontWeight: 600,
              color: 'var(--text-2)',
            }}
          >
            Régime : {taxSettings.tvaRegime === 'encaissements' ? 'Encaissements (Factures payées)' : 'Débits (Factures émises)'}
          </span>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Poste Fiscal</th>
                <th>Base de Calcul (HT)</th>
                <th>Taux Appliqué</th>
                <th style={{ textAlign: 'right' }}>Montant Obtenu</th>
              </tr>
            </thead>
            <tbody>
              {/* Sales TVA */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>TVA Collectée sur Ventes</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                    Basée sur {filteredSales.length} facture(s) de vente dans la période
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(salesHT, 'DZD')}</td>
                <td>Varie (0%, 9%, 19%)</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                  + {formatCurrency(tvaCollected, 'DZD')}
                </td>
              </tr>

              {/* Expense TVA */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>TVA Déductible sur Achats</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                    Basée sur {filteredExpenses.filter((e) => e.attachmentUrl).length} achat(s) avec justificatif
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(expensesHT, 'DZD')}</td>
                <td>Varie (0%, 9%, 19%)</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                  - {formatCurrency(tvaDeductible, 'DZD')}
                </td>
              </tr>

              {/* Net TVA */}
              <tr style={{ background: tvaPayable > 0 ? '#FEF2F2' : '#F0FDF4' }}>
                <td>
                  <div style={{ fontWeight: 800, color: tvaPayable > 0 ? '#991B1B' : '#065F46' }}>
                    {tvaPayable > 0 ? 'Solde TVA à Payer (G50)' : 'Solde Crédit de TVA Reportable'}
                  </div>
                </td>
                <td>—</td>
                <td>TVA Collectée − TVA Déductible</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: tvaPayable > 0 ? '#DC2626' : '#16A34A' }}>
                  {formatCurrency(tvaPayable > 0 ? tvaPayable : tvaCredit, 'DZD')}
                </td>
              </tr>

              {/* Net Profit & IBS */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>Bénéfice Net Imposable (IBS)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Total Ventes HT − Total Achats HT</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(netProfit, 'DZD')}</td>
                <td>{taxSettings.isStartupLabelActive ? 'Exonéré (Label Startup)' : `${taxSettings.ibsRate}%`}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                  {taxSettings.isStartupLabelActive ? '0 DA' : formatCurrency(estimatedIBS, 'DZD')}
                </td>
              </tr>

              {/* IRG Manager */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>IRG Gérant (Barème Progressif)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Rémunération du gérant soumise au barème IRG</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(taxSettings.managerMonthlySalary, 'DZD')} / mois</td>
                <td>Barème progressif IRG</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                  {formatCurrency(periodIRG, 'DZD')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CASNOS & TAP Information Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* CASNOS Reminder */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} color="var(--text-1)" />
            <h3 className="card-title" style={{ margin: 0 }}>
              Cotisations Sociales CASNOS
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Les cotisations CASNOS pour non-salariés/gérants sont calculées sur l'assiette du revenu imposable (15% avec un montant minimum légal).
          </p>
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>Montant CASNOS Renseigné</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-1)' }}>
              {formatCurrency(taxSettings.casnosDeclaredAmount || 0, 'DZD')}
            </span>
          </div>
        </div>

        {/* TAP Abolished Notice */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Info size={18} color="var(--accent-hover)" />
            <h3 className="card-title" style={{ margin: 0 }}>
              Taxe sur l'Activité Professionnelle (TAP)
            </h3>
          </div>
          <div
            style={{
              padding: '0.85rem 1rem',
              background: '#F0F7FF',
              border: '1px solid #E0ECFB',
              borderRadius: 'var(--r-sm)',
              color: '#1E40AF',
              fontSize: '0.82rem',
              lineHeight: 1.6,
            }}
          >
            <strong>Note fiscale officielle :</strong> Conformément à la Loi de Finances 2024 (et à la suppression progressive initiée en 2022), la TAP est <strong>définitivement supprimée</strong> pour toutes les activités productives et de services. Aucun montant n'est dû au titre de la TAP.
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <TaxDeclarationExport
          profile={activeProfile}
          periodLabel={periodLabel}
          taxSettings={taxSettings}
          sales={filteredSales}
          expenses={filteredExpenses}
          tvaCollected={tvaCollected}
          tvaDeductible={tvaDeductible}
          tvaPayable={tvaPayable}
          tvaCredit={tvaCredit}
          salesHT={salesHT}
          expensesHT={expensesHT}
          netProfit={netProfit}
          ibsAmount={estimatedIBS}
          irgAmount={periodIRG}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};
