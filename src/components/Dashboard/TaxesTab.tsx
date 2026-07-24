import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatCurrency, calculateIRG } from '../../utils/formatters';
import { DEFAULT_TAX_SETTINGS } from '../../types';
import type { TaxSettings } from '../../types';
import {
  Calculator, Calendar, AlertCircle, Printer, TrendingUp, Clock, ShieldCheck, Info, DollarSign,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  isWithinInterval, parseISO, differenceInDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaxDeclarationExport } from './TaxDeclarationExport';
import { CalendrierFiscalCard } from './CalendrierFiscalCard';

export const TaxesTab: React.FC = () => {
  const { state, activeProfile } = useInvoice();
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [showExportModal, setShowExportModal] = useState(false);

  const profileId = state.activeProfileId;
  const taxSettings: TaxSettings = state.taxSettings[profileId] || DEFAULT_TAX_SETTINGS;

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

  const profileSales = state.documents.filter(
    (d) => d.settings?.profileId === profileId || (!d.settings?.profileId && profileId === state.profiles[0]?.id)
  );
  const profileExpenses = state.expenses.filter((e) => e.profileId === profileId);

  const filteredSales = profileSales.filter((d) => {
    try {
      const docDate = parseISO(d.date);
      const isDateMatch = isWithinInterval(docDate, { start: intervalStart, end: intervalEnd });
      if (taxSettings.tvaRegime === 'encaissements') {
        return isDateMatch && (d.status === 'Paid' || d.status === 'Partial');
      }
      return isDateMatch;
    } catch { return false; }
  });

  const filteredExpenses = profileExpenses.filter((e) => {
    try {
      const expDate = parseISO(e.date);
      return isWithinInterval(expDate, { start: intervalStart, end: intervalEnd });
    } catch { return false; }
  });

  // ── TVA Collectée (groupée par taux) ──────────────────────────────────────
  let salesHT = 0;
  let tvaCollected = 0;
  const tvaBySalesRate: Record<number, { base: number; tva: number }> = {};

  filteredSales.forEach((s) => {
    s.items.forEach(item => {
      const rate = item.taxRate !== undefined ? item.taxRate : (s.settings.taxRate || 0);
      const ht = item.quantity * item.rate * (s.settings.discountType === 'percentage' ? (1 - s.settings.discountValue / 100) : 1);
      const tva = ht * (rate / 100);
      salesHT += ht;
      tvaCollected += tva;
      if (!tvaBySalesRate[rate]) tvaBySalesRate[rate] = { base: 0, tva: 0 };
      tvaBySalesRate[rate].base += ht;
      tvaBySalesRate[rate].tva += tva;
    });
  });

  // ── TVA Déductible ─────────────────────────────────────────────────────────
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

  // ── Net TVA ────────────────────────────────────────────────────────────────
  const netTVA = tvaCollected - tvaDeductible;
  const tvaPayable = netTVA > 0 ? netTVA : 0;
  const tvaCredit = netTVA < 0 ? Math.abs(netTVA) : 0;

  // ── IBS (with non-deductible charges reintegration) ───────────────────────
  const nonDeductible = taxSettings.nonDeductibleCharges ?? 0;
  const netProfit = Math.max(0, salesHT - expensesHT);
  const taxableProfit = Math.max(0, netProfit + nonDeductible);
  let estimatedIBS = 0;
  if (!taxSettings.isStartupLabelActive) {
    estimatedIBS = Math.round(taxableProfit * (taxSettings.ibsRate / 100));
  }

  // ── IRG (CORRECTED: CNAS salariale déduite avant barème) ──────────────────
  const monthlyGross = taxSettings.managerMonthlySalary || 0;
  const annualIRG = calculateIRG(monthlyGross);
  const periodIRG = periodType === 'year' ? annualIRG : periodType === 'quarter' ? annualIRG / 4 : annualIRG / 12;

  // CNAS salariale info (for display)
  const cnasSalariale = monthlyGross * 12 * 0.09;
  const netAfterCnas = monthlyGross * 12 - cnasSalariale;

  // ── G50 Deadline ───────────────────────────────────────────────────────────
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const daysUntilG50 = differenceInDays(nextMonth, now);

  const totalTaxProvisioned = tvaPayable + estimatedIBS + periodIRG;

  const tvaSalesRateEntries = Object.entries(tvaBySalesRate).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Calculateur de Taxes & G50</h1>
          <p className="page-subtitle">Estimations fiscales automatiques selon la législation algérienne</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '0.2rem', borderRadius: 'var(--r-sm)' }}>
            {[{ id: 'month', label: 'Mois' }, { id: 'quarter', label: 'Trimestre' }, { id: 'year', label: 'Année' }].map((pill) => (
              <button key={pill.id} onClick={() => setPeriodType(pill.id as any)}
                className={`btn ${periodType === pill.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>{pill.label}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
            <Printer size={15} /> Exporter la déclaration
          </button>
        </div>
      </div>

      {/* G50 Deadline */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
        background: daysUntilG50 <= 5 ? '#FEF2F2' : '#F0F7FF',
        border: `1px solid ${daysUntilG50 <= 5 ? '#FECACA' : '#E0ECFB'}`,
        borderRadius: 'var(--r-sm)', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
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
        <span className="status-badge" style={{ background: daysUntilG50 <= 5 ? '#FEE2E2' : '#DBEAFE', color: daysUntilG50 <= 5 ? '#991B1B' : '#1E40AF', fontWeight: 700 }}>
          {daysUntilG50} jours restants
        </span>
      </div>

      {/* Warnings */}
      {missingReceiptCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--r-sm)', marginBottom: '1.5rem', color: '#B45309', fontSize: '0.82rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div><strong>Attention : {missingReceiptCount} achat(s) sans justificatif joint.</strong> La TVA associée ne peut pas être déduite sur votre déclaration G50 sans facture fournisseur conforme.</div>
        </div>
      )}

      {taxSettings.isStartupLabelActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 'var(--r-sm)', marginBottom: '1.5rem', color: '#065F46', fontSize: '0.82rem' }}>
          <ShieldCheck size={18} style={{ flexShrink: 0 }} />
          <div><strong>Exonération IBS "Label Startup" active.</strong> Votre entreprise bénéficie d'une exonération totale d'IBS. Taux d'IBS calculé = 0 DA.</div>
        </div>
      )}

      {/* Metrics */}
      <div className="stats-grid">
        <div className="stat-card stat-card-accent">
          <div className="stat-icon"><Calculator size={18} /></div>
          <div className="stat-label">{tvaPayable > 0 ? 'TVA à Payer (G50)' : 'Crédit de TVA'}</div>
          <div className="stat-value">{formatCurrency(tvaPayable > 0 ? tvaPayable : tvaCredit, 'DZD')}</div>
          <div className="stat-meta">{tvaPayable > 0 ? 'À déclarer et payer' : 'Reportable sur la période suivante'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={18} /></div>
          <div className="stat-label">IBS Estimé</div>
          <div className="stat-value">{taxSettings.isStartupLabelActive ? '0 DA (Exonéré)' : formatCurrency(estimatedIBS, 'DZD')}</div>
          <div className="stat-meta">{taxSettings.isStartupLabelActive ? 'Label Startup' : `Taux : ${taxSettings.ibsRate}% · Base : ${formatCurrency(taxableProfit, 'DZD')}`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={18} /></div>
          <div className="stat-label">IRG Gérant Estimé</div>
          <div className="stat-value">{formatCurrency(periodIRG, 'DZD')}</div>
          <div className="stat-meta">Base nette après CNAS 9% + abattement 40%</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Clock size={18} /></div>
          <div className="stat-label">Total Provision Nécessaire</div>
          <div className="stat-value" style={{ color: 'var(--text-1)' }}>{formatCurrency(totalTaxProvisioned, 'DZD')}</div>
          <div className="stat-meta">Réserve recommandée</div>
        </div>
      </div>

      {/* Detailed Calculation Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Détail transparent du calcul fiscal ({periodLabel})</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>Décomposition ligne par ligne</p>
          </div>
          <span style={{ fontSize: '0.72rem', background: 'var(--surface-2)', padding: '0.35rem 0.75rem', borderRadius: 'var(--r-sm)', fontWeight: 600, color: 'var(--text-2)' }}>
            Régime : {taxSettings.tvaRegime === 'encaissements' ? 'Encaissements' : 'Débits'}
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
              {/* TVA collectée par taux */}
              {tvaSalesRateEntries.map(([rate, vals]) => (
                <tr key={`tva-sales-${rate}`}>
                  <td>
                    <div style={{ fontWeight: 700 }}>TVA Collectée — Taux {rate}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Base HT des ventes taxées à {rate}%</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(vals.base, 'DZD')}</td>
                  <td>{rate}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>+ {formatCurrency(vals.tva, 'DZD')}</td>
                </tr>
              ))}
              {tvaSalesRateEntries.length > 1 && (
                <tr style={{ background: 'var(--surface)' }}>
                  <td><div style={{ fontWeight: 800 }}>Total TVA Collectée</div></td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(salesHT, 'DZD')}</td>
                  <td>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>+ {formatCurrency(tvaCollected, 'DZD')}</td>
                </tr>
              )}
              {tvaSalesRateEntries.length === 0 && (
                <tr>
                  <td><div style={{ fontWeight: 700 }}>TVA Collectée sur Ventes</div><div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Basée sur {filteredSales.length} facture(s)</div></td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(salesHT, 'DZD')}</td>
                  <td>Varie (0%, 9%, 19%)</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>+ {formatCurrency(tvaCollected, 'DZD')}</td>
                </tr>
              )}
              {/* TVA Déductible */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>TVA Déductible sur Achats</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Basée sur {filteredExpenses.filter((e) => e.attachmentUrl).length} achat(s) avec justificatif</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(expensesHT, 'DZD')}</td>
                <td>Varie (0%, 9%, 19%)</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>- {formatCurrency(tvaDeductible, 'DZD')}</td>
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
              {/* Bénéfice IBS */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>Bénéfice Brut (Ventes − Achats)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Total Ventes HT − Total Achats HT</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(netProfit, 'DZD')}</td>
                <td>—</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(netProfit, 'DZD')}</td>
              </tr>
              {nonDeductible > 0 && (
                <tr style={{ background: '#FFFBEB' }}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#B45309' }}>Charges non-déductibles (réintégrées)</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Amendes, pénalités, dépenses non-justifiées</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>—</td>
                  <td>À réintégrer</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#B45309' }}>+ {formatCurrency(nonDeductible, 'DZD')}</td>
                </tr>
              )}
              {/* IBS */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>IBS — Bénéfice Fiscal Imposable</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Bénéfice brut + charges réintégrées</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(taxableProfit, 'DZD')}</td>
                <td>{taxSettings.isStartupLabelActive ? 'Exonéré (Label Startup)' : `${taxSettings.ibsRate}%`}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                  {taxSettings.isStartupLabelActive ? '0 DA' : formatCurrency(estimatedIBS, 'DZD')}
                </td>
              </tr>
              {/* IRG */}
              <tr>
                <td>
                  <div style={{ fontWeight: 700 }}>IRG Gérant (Barème Progressif)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                    Brut {formatCurrency(monthlyGross * 12, 'DZD')}/an → −CNAS 9% ({formatCurrency(cnasSalariale, 'DZD')}) → −Abattement 40% → Base IRG {formatCurrency(Math.max(0, netAfterCnas * 0.6 - 12000), 'DZD')}
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(monthlyGross, 'DZD')} / mois</td>
                <td>Barème progressif IRG</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>{formatCurrency(periodIRG, 'DZD')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CASNOS + TAP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} color="var(--text-1)" />
            <h3 className="card-title" style={{ margin: 0 }}>Cotisations Sociales CASNOS</h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Les cotisations CASNOS pour non-salariés/gérants sont calculées sur l'assiette du revenu imposable (taux légal minimum en vigueur).
          </p>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>Montant CASNOS Renseigné</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-1)' }}>{formatCurrency(taxSettings.casnosDeclaredAmount || 0, 'DZD')}</span>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Info size={18} color="var(--accent-hover)" />
            <h3 className="card-title" style={{ margin: 0 }}>Taxe sur l'Activité Professionnelle (TAP)</h3>
          </div>
          <div style={{ padding: '0.85rem 1rem', background: '#F0F7FF', border: '1px solid #E0ECFB', borderRadius: 'var(--r-sm)', color: '#1E40AF', fontSize: '0.82rem', lineHeight: 1.6 }}>
            <strong>Note fiscale officielle :</strong> Conformément à la Loi de Finances 2024, la TAP est <strong>définitivement supprimée</strong> pour toutes les activités productives et de services. Aucun montant n'est dû au titre de la TAP.
          </div>
        </div>
      </div>

      {/* Calendrier Fiscal */}
      <CalendrierFiscalCard />

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
          netProfit={taxableProfit}
          ibsAmount={estimatedIBS}
          irgAmount={periodIRG}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};
