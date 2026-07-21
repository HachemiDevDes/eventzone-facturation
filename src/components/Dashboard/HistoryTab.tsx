import React, { useState, useEffect } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { calculateTotals, formatCurrency, formatDateShort } from '../../utils/formatters';
import { Edit2, Trash2, Copy, FileText, TrendingUp, Clock, AlertCircle, Search } from 'lucide-react';
import type { DocumentData, InvoiceStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const HistoryTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [filterProfileId, setFilterProfileId] = useState<string>(state.activeProfileId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  // Keep filter synced with the active profile selected in the sidebar
  useEffect(() => {
    setFilterProfileId(state.activeProfileId);
  }, [state.activeProfileId]);

  const handleEdit = (id: string) => {
    dispatch({ type: 'EDIT_DOCUMENT', payload: id });
    navigate(`/builder/${id}`);
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
    const yearYY = format(new Date(), 'yy');
    const newId = crypto.randomUUID();
    dispatch({
      type: 'SET_CURRENT_DOCUMENT',
      payload: {
        ...doc,
        id: newId,
        invoiceNumber: `EZ-${yearYY}-${String(count).padStart(4, '0')}`,
        status: 'Draft',
      },
    });
    navigate(`/builder/${newId}`);
  };

  const filteredDocuments = state.documents.filter((doc) => {
    // Profile filter
    if (filterProfileId !== 'all') {
      const docProfileId = doc.settings?.profileId || state.profiles[0]?.id;
      if (docProfileId !== filterProfileId) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && doc.status !== statusFilter) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = doc.recipient?.name?.toLowerCase().includes(q);
      const companyMatch = doc.recipient?.company?.toLowerCase().includes(q);
      const numMatch = doc.invoiceNumber?.toLowerCase().includes(q);
      if (!nameMatch && !companyMatch && !numMatch) return false;
    }

    return true;
  });

  // Stats calculation across filtered profile
  const profileDocuments = state.documents.filter((doc) => {
    if (filterProfileId === 'all') return true;
    const docProfileId = doc.settings?.profileId || state.profiles[0]?.id;
    return docProfileId === filterProfileId;
  });

  const stats = profileDocuments.reduce(
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

      {/* Documents Table & Cards */}
      <div className="card">
        {/* Search & Filter Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Historique des documents</h2>
            <select
              className="input-field"
              style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8rem', minWidth: '150px' }}
              value={filterProfileId}
              onChange={(e) => setFilterProfileId(e.target.value)}
            >
              <option value="all">Tous les profils</option>
              {state.profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.profileName || p.company}</option>
              ))}
            </select>
          </div>

          {/* Search bar & status filter chips */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input
                type="text"
                placeholder="Rechercher par client, N°..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px', maxWidth: '100%' }}>
              {[
                { key: 'all', label: 'Tous' },
                { key: 'Paid', label: 'Encaissés' },
                { key: 'Sent', label: 'En attente' },
                { key: 'Overdue', label: 'En retard' },
                { key: 'Draft', label: 'Brouillons' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`term-chip ${statusFilter === chip.key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(chip.key)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', whiteSpace: 'nowrap' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="data-table-container desktop-table-container">
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
                      <p>Aucun document ne correspond à vos critères.</p>
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
                            {state.profiles.find((p) => p.id === doc.settings?.profileId)?.profileName || '—'}
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
                            className={`status-select-badge badge-${doc.status.toLowerCase()}`}
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

        {/* Mobile Document Cards View */}
        <div className="mobile-doc-list">
          {filteredDocuments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-4)' }}>
              <FileText size={36} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>Aucun document ne correspond à vos critères.</p>
            </div>
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
                const profileName = state.profiles.find((p) => p.id === doc.settings?.profileId)?.profileName;

                return (
                  <div key={doc.id} className="mobile-doc-card">
                    {/* Header Row: Type badge + Document Number & Status Dropdown */}
                    <div className="mobile-doc-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: '0.7rem', fontWeight: 700 }}>
                          {docTypeLabel(doc.type)}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-1)' }}>
                          #{doc.invoiceNumber}
                        </span>
                      </div>

                      <select
                        className={`status-select-badge badge-${doc.status.toLowerCase()}`}
                        value={doc.status}
                        onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                      >
                        <option value="Draft" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Brouillon</option>
                        <option value="Sent" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Envoyé</option>
                        <option value="Paid" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>Encaissé</option>
                        <option value="Overdue" style={{ color: 'var(--text-1)', background: 'var(--bg)' }}>En retard</option>
                      </select>
                    </div>

                    {/* Recipient & Profile Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div className="mobile-doc-card-title">{doc.recipient.name || 'Client non spécifié'}</div>
                      {doc.recipient.company && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                          {doc.recipient.company}
                        </div>
                      )}
                      {filterProfileId === 'all' && profileName && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>
                          Profil: {profileName}
                        </div>
                      )}
                    </div>

                    {/* Date info & Total Amount */}
                    <div className="mobile-doc-card-meta">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--text-4)', fontSize: '0.72rem' }}>
                          Émis le {formatDateShort(doc.date)}
                        </span>
                        {doc.dueDate && (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
                            Échéance {formatDateShort(doc.dueDate)}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                          Montant TTC
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-1)' }}>
                          {formatCurrency(total, doc.settings.currency)}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mobile-doc-card-actions">
                      <button className="btn btn-primary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }} onClick={() => handleEdit(doc.id)}>
                        <Edit2 size={13} /> Modifier
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleDuplicate(doc)} title="Dupliquer">
                        <Copy size={13} /> Dupliquer
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '0.45rem 0.6rem', color: 'var(--status-overdue-text)' }} onClick={() => handleDelete(doc.id)} title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryTab;
