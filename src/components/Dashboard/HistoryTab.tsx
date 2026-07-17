import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { calculateTotals, formatCurrency, formatDateShort } from '../../utils/formatters';
import { Edit2, Trash2, Copy, FileText, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import type { DocumentData, InvoiceStatus } from '../../types';
import { supabase } from '../../lib/supabase';

const HistoryTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [filterProfileId, setFilterProfileId] = useState<string>('all');

  const handleEdit = (id: string) => {
    dispatch({ type: 'EDIT_DOCUMENT', payload: id });
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    dispatch({ type: 'UPDATE_DOCUMENT_STATUS', payload: { id, status: newStatus as InvoiceStatus } });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Supprimer ce document définitivement ?')) {
      dispatch({ type: 'DELETE_DOCUMENT', payload: id });
      try {
        await supabase.from('line_items').delete().eq('document_id', id);
        await supabase.from('documents').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting document from Supabase:', err);
      }
    }
  };

  const handleDuplicate = (doc: DocumentData) => {
    const count = state.documents.filter((d) => d.type === doc.type).length + 1;
    const prefix = doc.type === 'invoice' ? 'FAC' : doc.type === 'quote' ? 'DEV' : 'PRO';
    dispatch({
      type: 'SET_CURRENT_DOCUMENT',
      payload: {
        ...doc,
        id: crypto.randomUUID(),
        invoiceNumber: `${prefix}-${String(count).padStart(4, '0')}`,
        status: 'Draft',
      },
    });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'builder' });
  };

  const filteredDocuments = state.documents.filter(doc => 
    filterProfileId === 'all' || doc.settings?.profileId === filterProfileId
  );

  // Stats
  const stats = filteredDocuments.reduce(
    (acc, doc) => {
      const { total } = calculateTotals(
        doc.items || [],
        doc.settings?.taxRate ?? 0,
        doc.settings?.discountType ?? 'percentage',
        doc.settings?.discountValue ?? 0,
        doc.settings?.applyStampDuty ?? false,
        doc.settings?.stampDutyAmount ?? 0
      );
      acc.total += 1;
      if (doc.status === 'Paid') acc.paid += total;
      else if (doc.status === 'Overdue') acc.overdue += total;
      else if (doc.status === 'Sent') acc.pending += total;
      return acc;
    },
    { total: 0, paid: 0, overdue: 0, pending: 0 }
  );

  const docTypeLabel = (type: string) => {
    if (type === 'invoice') return 'Facture';
    if (type === 'quote') return 'Devis';
    return 'Pro Forma';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble de votre activité</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-card-accent">
          <div className="stat-icon">
            <TrendingUp size={18} />
          </div>
          <div className="stat-label">Total Encaissé</div>
          <div className="stat-value">{formatCurrency(stats.paid, 'DZD')}</div>
          <div className="stat-meta">Factures payées</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={18} />
          </div>
          <div className="stat-label">En Attente</div>
          <div className="stat-value">{formatCurrency(stats.pending, 'DZD')}</div>
          <div className="stat-meta">Factures envoyées</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }}>
            <AlertCircle size={18} />
          </div>
          <div className="stat-label">En Retard</div>
          <div className="stat-value" style={{ color: 'var(--status-overdue-text)' }}>
            {formatCurrency(stats.overdue, 'DZD')}
          </div>
          <div className="stat-meta">À relancer</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={18} />
          </div>
          <div className="stat-label">Documents</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-meta">Au total</div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Historique des documents</h2>
          <select 
            className="input-field" 
            style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8rem', minWidth: '150px' }}
            value={filterProfileId}
            onChange={(e) => setFilterProfileId(e.target.value)}
          >
            <option value="all">Tous les profils</option>
            {state.profiles.map(p => (
              <option key={p.id} value={p.id}>{p.profileName || p.company}</option>
            ))}
          </select>
        </div>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Profil</th>
                <th>Numéro</th>
                <th>Client</th>
                <th>Date</th>
                <th>Échéance</th>
                <th>Montant TTC</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <FileText size={40} style={{ opacity: 0.4 }} />
                      <p>Aucun document pour ce profil.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocuments
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((doc) => {
                  const { total } = calculateTotals(
                    doc.items || [],
                    doc.settings?.taxRate ?? 0,
                    doc.settings?.discountType ?? 'percentage',
                    doc.settings?.discountValue ?? 0,
                    doc.settings?.applyStampDuty ?? false,
                    doc.settings?.stampDutyAmount ?? 0
                  );
                  return (
                    <tr key={doc.id}>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)' }}>
                          {docTypeLabel(doc.type)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)' }}>
                          {state.profiles.find(p => p.id === doc.settings?.profileId)?.profileName || '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                        {doc.invoiceNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>
                          {doc.recipient.name || '—'}
                        </div>
                        {doc.recipient.company && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>{doc.recipient.company}</div>
                        )}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(doc.date)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(doc.dueDate)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(total, doc.settings.currency)}
                      </td>
                      <td>
                        <select
                          className={`badge badge-${doc.status.toLowerCase()}`}
                          style={{ outline: 'none', border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: '1rem' }}
                          value={doc.status}
                          onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                        >
                          <option value="Draft" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Brouillon</option>
                          <option value="Sent" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Envoyé / En attente</option>
                          <option value="Paid" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Encaissé</option>
                          <option value="Overdue" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>En retard</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '2px' }}>
                          <button className="btn-icon" onClick={() => handleEdit(doc.id)} title="Modifier">
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDuplicate(doc)} title="Dupliquer">
                            <Copy size={14} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(doc.id)} title="Supprimer"
                            style={{ color: 'var(--status-overdue-text)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

export default HistoryTab;
