import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import {
  TrendingUp, TrendingDown, Wallet, Plus, Trash2, Pencil,
  ArrowUpCircle, ArrowDownCircle, Eye, EyeOff,
  AlertCircle, BarChart3
} from 'lucide-react';
import {
  parseISO, isWithinInterval, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, format,
  addDays, isBefore
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { CashFlowEntry } from '../../types';
import { CASHFLOW_CATEGORIES_IN, CASHFLOW_CATEGORIES_OUT } from '../../types';

const EMPTY_ENTRY: Omit<CashFlowEntry, 'id' | 'profileId'> = {
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'in',
  category: 'Encaissement client',
  description: '',
  amount: 0,
  bankAccountLabel: '',
};

export const TresorerieTab: React.FC = () => {
  const { state, dispatch, activeProfile } = useInvoice();
  const profileId = state.activeProfileId;

  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_ENTRY });
  const [showBalance, setShowBalance] = useState(true);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

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
    periodLabel = `T${qNum} ${now.getFullYear()}`;
  } else {
    intervalStart = startOfYear(now);
    intervalEnd = endOfYear(now);
    periodLabel = `Année ${now.getFullYear()}`;
  }

  // ── Compute from invoices (paid) ────────────────────────────────────────────
  const profileDocs = state.documents.filter(d =>
    (d.settings?.profileId === profileId || (!d.settings?.profileId && profileId === state.profiles[0]?.id))
    && d.type === 'invoice'
  );

  // Payments received (linked to invoices) in period
  const profilePayments = state.payments.filter(p => p.profileId === profileId);
  const periodPayments = profilePayments.filter(p => {
    try { return isWithinInterval(parseISO(p.date), { start: intervalStart, end: intervalEnd }); }
    catch { return false; }
  });
  const paymentsInTotal = periodPayments.reduce((s, p) => s + p.amount, 0);

  // Expenses (paid) in period as outflows
  const profileExpenses = state.expenses.filter(e => e.profileId === profileId && e.status === 'Paid');
  const periodExpenses = profileExpenses.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start: intervalStart, end: intervalEnd }); }
    catch { return false; }
  });
  const expensesOutTotal = periodExpenses.reduce((s, e) => s + e.amountTTC, 0);

  // Manual cash flow entries
  const profileCashFlow = state.cashFlow.filter(e => e.profileId === profileId);
  const periodCashFlow = profileCashFlow.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start: intervalStart, end: intervalEnd }); }
    catch { return false; }
  });
  const manualIn = periodCashFlow.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0);
  const manualOut = periodCashFlow.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);

  const totalIn = paymentsInTotal + manualIn;
  const totalOut = expensesOutTotal + manualOut;
  const netFlow = totalIn - totalOut;

  // Opening balance
  const openingBalance = activeProfile?.openingBalance ?? 0;
  const currentBalance = openingBalance + netFlow;

  // Prévisionnel: pending invoices due in next 30/60/90 days
  const today = new Date();
  const pending30 = profileDocs
    .filter(d => (d.status === 'Sent' || d.status === 'Partial' || d.status === 'Overdue'))
    .filter(d => { try { return isBefore(parseISO(d.dueDate), addDays(today, 30)); } catch { return false; } });
  const pending60 = profileDocs
    .filter(d => (d.status === 'Sent' || d.status === 'Partial' || d.status === 'Overdue'))
    .filter(d => { try { const due = parseISO(d.dueDate); return isBefore(addDays(today, 30), due) && isBefore(due, addDays(today, 60)); } catch { return false; } });

  const calcDocTotal = (d: typeof profileDocs[0]) => {
    const sub = d.items.reduce((a, i) => a + i.quantity * i.rate, 0);
    const disc = d.settings.discountType === 'percentage' ? sub * (d.settings.discountValue / 100) : d.settings.discountValue;
    const taxable = Math.max(0, sub - disc);
    const tva = taxable * ((d.settings.taxRate || 0) / 100);
    const stamp = d.settings.applyStampDuty ? (d.settings.stampDutyAmount || 0) : 0;
    const paid = state.payments.filter(p => p.documentId === d.id).reduce((s, p) => s + p.amount, 0);
    return Math.max(0, taxable + tva + stamp - paid);
  };

  const forecast30 = pending30.reduce((s, d) => s + calcDocTotal(d), 0);
  const forecast60 = pending60.reduce((s, d) => s + calcDocTotal(d), 0);

  const handleSave = () => {
    if (!formData.description.trim() || formData.amount <= 0) return;
    if (editingEntryId) {
      dispatch({ type: 'UPDATE_CASHFLOW_ENTRY', payload: { id: editingEntryId, entry: { ...formData, profileId } } });
      setEditingEntryId(null);
    } else {
      dispatch({
        type: 'ADD_CASHFLOW_ENTRY',
        payload: { id: uuidv4(), profileId, ...formData },
      });
    }
    setFormData({ ...EMPTY_ENTRY });
    setShowAddForm(false);
  };

  const handleEdit = (entry: CashFlowEntry) => {
    setFormData({
      date: entry.date,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      bankAccountLabel: entry.bankAccountLabel || '',
    });
    setEditingEntryId(entry.id);
    setShowAddForm(true);
  };

  const allPeriodEntries = [
    ...periodCashFlow.map(e => ({ ...e, source: 'manual' as const })),
    ...periodPayments.map(p => ({
      id: p.id, profileId, date: p.date, type: 'in' as const,
      category: 'Encaissement client', description: `Paiement — ${p.reference || p.method}`,
      amount: p.amount, source: 'payment' as const,
    })),
    ...periodExpenses.map(e => ({
      id: e.id, profileId, date: e.date, type: 'out' as const,
      category: e.category, description: `Achat — ${e.supplier}`,
      amount: e.amountTTC, source: 'expense' as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Trésorerie & Cash Flow</h1>
          <p className="page-subtitle">Flux financiers réels et prévisions à 30/60 jours</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '0.2rem', borderRadius: 'var(--r-sm)' }}>
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button key={p} onClick={() => setPeriodType(p)}
                className={`btn ${periodType === p ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>
                {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trimestre' : 'Année'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setShowAddForm(true); setEditingEntryId(null); setFormData({ ...EMPTY_ENTRY }); }}>
            <Plus size={15} /> Ajouter flux
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #F0FFF4 0%, #fff 60%)', borderColor: '#A7F3D0' }}>
          <div className="stat-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}><ArrowUpCircle size={18} /></div>
          <div className="stat-label">Entrées ({periodLabel})</div>
          <div className="stat-value" style={{ color: '#16A34A' }}>{formatCurrency(totalIn, 'DZD')}</div>
          <div className="stat-meta">Encaissements + flux entrants</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFF1F2 0%, #fff 60%)', borderColor: '#FECDD3' }}>
          <div className="stat-icon" style={{ background: '#FFE4E6', color: '#BE123C' }}><ArrowDownCircle size={18} /></div>
          <div className="stat-label">Sorties ({periodLabel})</div>
          <div className="stat-value" style={{ color: '#BE123C' }}>{formatCurrency(totalOut, 'DZD')}</div>
          <div className="stat-meta">Achats payés + flux sortants</div>
        </div>
        <div className="stat-card" style={{
          background: netFlow >= 0 ? 'linear-gradient(135deg, #F0F7FF 0%, #fff 60%)' : 'linear-gradient(135deg, #FFF9EC 0%, #fff 60%)',
          borderColor: netFlow >= 0 ? '#BFDBFE' : '#FDE68A',
        }}>
          <div className="stat-icon" style={{ background: netFlow >= 0 ? '#DBEAFE' : '#FEF9C3', color: netFlow >= 0 ? '#1D4ED8' : '#D97706' }}>
            {netFlow >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </div>
          <div className="stat-label">Flux Net ({periodLabel})</div>
          <div className="stat-value" style={{ color: netFlow >= 0 ? '#1D4ED8' : '#D97706' }}>
            {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow, 'DZD')}
          </div>
          <div className="stat-meta">Entrées − Sorties</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-icon"><Wallet size={18} /></div>
            <button className="btn-icon" onClick={() => setShowBalance(v => !v)} style={{ padding: '0.2rem' }}>
              {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          <div className="stat-label">Solde Courant Estimé</div>
          <div className="stat-value">
            {showBalance ? formatCurrency(currentBalance, 'DZD') : '••••••'}
          </div>
          <div className="stat-meta">Solde initial + flux net cumulé</div>
        </div>
      </div>

      {/* Prévisionnel */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #F8FAFF 0%, #fff 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <BarChart3 size={18} color="var(--text-2)" />
          <h2 className="card-title" style={{ margin: 0 }}>Prévisionnel d'Encaissements</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D', marginBottom: '0.3rem' }}>À recevoir — 30 jours</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16A34A' }}>{formatCurrency(forecast30, 'DZD')}</div>
            <div style={{ fontSize: '0.72rem', color: '#4ADE80', marginTop: '0.2rem' }}>{pending30.length} facture(s) concernée(s)</div>
          </div>
          <div style={{ padding: '1rem', background: '#FFF9EC', border: '1px solid #FDE68A', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', marginBottom: '0.3rem' }}>À recevoir — 31 à 60 jours</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#D97706' }}>{formatCurrency(forecast60, 'DZD')}</div>
            <div style={{ fontSize: '0.72rem', color: '#FCA500', marginTop: '0.2rem' }}>{pending60.length} facture(s) concernée(s)</div>
          </div>
          <div style={{ padding: '1rem', background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF', marginBottom: '0.3rem' }}>Solde Prévisionnel (60j)</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1D4ED8' }}>{formatCurrency(currentBalance + forecast30 + forecast60, 'DZD')}</div>
            <div style={{ fontSize: '0.72rem', color: '#60A5FA', marginTop: '0.2rem' }}>Si toutes les factures sont encaissées</div>
          </div>
        </div>
      </div>

      {/* Add Entry Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--accent)' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            {editingEntryId ? 'Modifier le flux' : 'Ajouter un flux de trésorerie'}
          </h3>
          <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="input-field" value={formData.type}
                onChange={e => setFormData(f => ({ ...f, type: e.target.value as 'in' | 'out', category: e.target.value === 'in' ? CASHFLOW_CATEGORIES_IN[0] : CASHFLOW_CATEGORIES_OUT[0] }))}>
                <option value="in">💚 Entrée d'argent</option>
                <option value="out">🔴 Sortie d'argent</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="input-field" value={formData.date}
                onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Catégorie</label>
              <select className="input-field" value={formData.category}
                onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}>
                {(formData.type === 'in' ? CASHFLOW_CATEGORIES_IN : CASHFLOW_CATEGORIES_OUT).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Montant (DA)</label>
              <input type="number" className="input-field" placeholder="0" min="0" value={formData.amount || ''}
                onChange={e => setFormData(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Description</label>
            <input type="text" className="input-field" placeholder="Ex : Paiement loyer décembre 2025"
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Compte bancaire (optionnel)</label>
            <input type="text" className="input-field" placeholder="Ex : CPA — Compte courant"
              value={formData.bankAccountLabel}
              onChange={e => setFormData(f => ({ ...f, bankAccountLabel: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => { setShowAddForm(false); setEditingEntryId(null); }}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}
              disabled={!formData.description.trim() || formData.amount <= 0}>
              {editingEntryId ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Mouvements — {periodLabel}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {allPeriodEntries.length} opération(s)
          </span>
        </div>
        {allPeriodEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-4)' }}>
            <Wallet size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem' }}>Aucun mouvement sur cette période.</div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Ajoutez des flux manuels ou enregistrez des paiements de factures.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allPeriodEntries.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
                background: entry.type === 'in' ? '#F0FDF4' : '#FFF1F2',
                border: `1px solid ${entry.type === 'in' ? '#BBF7D0' : '#FECDD3'}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: entry.type === 'in' ? '#DCFCE7' : '#FFE4E6',
                  color: entry.type === 'in' ? '#16A34A' : '#BE123C',
                }}>
                  {entry.type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.description}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                    {entry.category} · {formatDateShort(entry.date)}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: entry.type === 'in' ? '#16A34A' : '#BE123C', whiteSpace: 'nowrap' }}>
                  {entry.type === 'in' ? '+' : '-'}{formatCurrency(entry.amount, 'DZD')}
                </div>
                {(entry as any).source === 'manual' && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn-icon" onClick={() => handleEdit(entry as CashFlowEntry)} title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" style={{ color: 'var(--status-overdue-text)' }}
                      onClick={() => dispatch({ type: 'DELETE_CASHFLOW_ENTRY', payload: entry.id })} title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opening Balance Info */}
      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: '0.78rem', color: 'var(--text-3)' }}>
        <AlertCircle size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
        Solde d'ouverture : <strong>{formatCurrency(openingBalance, 'DZD')}</strong>. 
        Modifiez-le dans <strong>Paramètres → Profil → Solde bancaire initial</strong>.
      </div>
    </div>
  );
};
