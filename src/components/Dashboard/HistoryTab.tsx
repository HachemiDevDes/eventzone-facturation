import React, { useState, useEffect } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { calculateTotals, formatCurrency, formatDateShort } from '../../utils/formatters';
import { Edit2, Trash2, Copy, FileText, TrendingUp, Clock, AlertCircle, Search, CreditCard, FileX, ArrowRight, Bell } from 'lucide-react';
import type { DocumentData, InvoiceStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { PaiementsModal } from './PaiementsModal';
import { RelanceModal } from './RelanceModal';

const HistoryTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [filterProfileId, setFilterProfileId] = useState<string>(state.activeProfileId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paiementsDoc, setPaiementsDoc] = useState<DocumentData | null>(null);
  const [relanceDoc, setRelanceDoc] = useState<DocumentData | null>(null);
  const navigate = useNavigate();

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
        sourceDocumentId: undefined,
        linkedAvoirId: undefined,
        relances: [],
      },
    });
    navigate(`/builder/${newId}`);
  };

  const handleConvertToInvoice = (doc: DocumentData) => {
    if (window.confirm(`Convertir le devis N° ${doc.invoiceNumber} en facture ?`)) {
      dispatch({ type: 'CONVERT_QUOTE_TO_INVOICE', payload: doc.id });
      navigate(`/builder/${state.currentDocument.id}`);
    }
  };

  const handleCreateAvoir = (doc: DocumentData) => {
    if (window.confirm(`Créer un avoir pour annuler la facture N° ${doc.invoiceNumber} ? La facture sera marquée comme annulée.`)) {
      const newId = crypto.randomUUID();
      dispatch({ type: 'START_NEW_DOCUMENT', payload: { type: 'avoir', id: newId, sourceDocumentId: doc.id } });
      navigate(`/builder/${newId}`);
    }
  };

  const handleRelance = (doc: DocumentData, level: 1 | 2 | 3, notes: string) => {
    dispatch({ type: 'ADD_RELANCE', payload: { documentId: doc.id, level, notes, profileId: doc.settings.profileId || state.activeProfileId } });
    // Update status to Overdue if not already
    if (doc.status === 'Sent') {
      dispatch({ type: 'UPDATE_DOCUMENT_STATUS', payload: { id: doc.id, status: 'Overdue' } });
    }
  };

  const filteredDocuments = state.documents.filter((doc) => {
    if (filterProfileId !== 'all') {
      const docProfileId = doc.settings?.profileId || state.profiles[0]?.id;
      if (docProfileId !== filterProfileId) return false;
    }
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = doc.recipient?.name?.toLowerCase().includes(q);
      const companyMatch = doc.recipient?.company?.toLowerCase().includes(q);
      const numMatch = doc.invoiceNumber?.toLowerCase().includes(q);
      if (!nameMatch && !companyMatch && !numMatch) return false;
    }
    return true;
  });

  const profileDocuments = state.documents.filter((doc) => {
    if (filterProfileId === 'all') return true;
    const docProfileId = doc.settings?.profileId || state.profiles[0]?.id;
    return docProfileId === filterProfileId;
  });

  const stats = profileDocuments.reduce(
    (acc, doc) => {
      const { total } = calculateTotals(
        doc.items || [], doc.settings?.taxRate ?? 0, doc.settings?.discountType ?? 'percentage',
        doc.settings?.discountValue ?? 0, doc.settings?.applyStampDuty ?? false, doc.settings?.stampDutyAmount ?? 0
      );
      acc.total += 1;
      if (doc.status === 'Paid') acc.paid += total;
      else if (doc.status === 'Overdue') acc.overdue += total;
      else if (doc.status === 'Sent' || doc.status === 'Partial') acc.pending += total;
      return acc;
    },
    { total: 0, paid: 0, overdue: 0, pending: 0 }
  );

  const docTypeLabel = (type: string) => {
    if (type === 'invoice') return 'Facture';
    if (type === 'quote') return 'Devis';
    if (type === 'avoir') return 'Avoir';
    return 'Pro Forma';
  };

  const docTypeBadgeStyle = (type: string) => {
    if (type === 'avoir') return { background: '#FDF4FF', color: '#7E22CE', border: '1px solid #E9D5FF' };
    if (type === 'quote') return { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' };
    if (type === 'proforma') return { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' };
    return { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' };
  };

  const getDocPaymentInfo = (doc: DocumentData) => {
    const docPayments = state.payments.filter(p => p.documentId === doc.id);
    const paid = docPayments.reduce((s, p) => s + p.amount, 0);
    return { paid, count: docPayments.length };
  };

  const sortedDocs = filteredDocuments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble de votre activité facturation</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-card-accent">
          <div className="stat-icon"><TrendingUp size={18} /></div>
          <div className="stat-label">Total Encaissé</div>
          <div className="stat-value">{formatCurrency(stats.paid, 'DZD')}</div>
          <div className="stat-meta">Factures payées</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Clock size={18} /></div>
          <div className="stat-label">En Attente</div>
          <div className="stat-value">{formatCurrency(stats.pending, 'DZD')}</div>
          <div className="stat-meta">Factures envoyées / partielles</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }}>
            <AlertCircle size={18} />
          </div>
          <div className="stat-label">En Retard</div>
          <div className="stat-value" style={{ color: 'var(--status-overdue-text)' }}>{formatCurrency(stats.overdue, 'DZD')}</div>
          <div className="stat-meta">À relancer</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FileText size={18} /></div>
          <div className="stat-label">Documents</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-meta">Au total</div>
        </div>
      </div>

      {/* Documents */}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Historique des documents</h2>
            <select className="input-field" style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8rem', minWidth: '150px' }}
              value={filterProfileId} onChange={(e) => setFilterProfileId(e.target.value)}>
              <option value="all">Tous les profils</option>
              {state.profiles.map((p) => <option key={p.id} value={p.id}>{p.profileName || p.company}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input type="text" placeholder="Rechercher par client, N°..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: '2.25rem', fontSize: '0.82rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px', maxWidth: '100%' }}>
              {[
                { key: 'all', label: 'Tous' }, { key: 'Paid', label: 'Encaissés' },
                { key: 'Sent', label: 'En attente' }, { key: 'Overdue', label: 'En retard' },
                { key: 'Partial', label: 'Partiels' }, { key: 'Draft', label: 'Brouillons' },
              ].map((chip) => (
                <button key={chip.key} type="button"
                  className={`term-chip ${statusFilter === chip.key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(chip.key)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', whiteSpace: 'nowrap' }}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Table */}
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
                <th>Encaissé</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <FileText size={40} style={{ opacity: 0.4 }} />
                      <p>Aucun document ne correspond à vos critères.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedDocs.map((doc) => {
                  const { total } = calculateTotals(
                    doc.items || [], doc.settings?.taxRate ?? 0, doc.settings?.discountType ?? 'percentage',
                    doc.settings?.discountValue ?? 0, doc.settings?.applyStampDuty ?? false, doc.settings?.stampDutyAmount ?? 0
                  );
                  const { paid: paidAmt } = getDocPaymentInfo(doc);
                  const isInvoice = doc.type === 'invoice';
                  const isQuoteOrProforma = doc.type === 'quote' || doc.type === 'proforma';
                  const canRelance = isInvoice && (doc.status === 'Sent' || doc.status === 'Overdue' || doc.status === 'Partial');

                  return (
                    <tr key={doc.id} style={{ opacity: doc.status === 'Cancelled' ? 0.5 : 1 }}>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.4rem', borderRadius: 'var(--r-sm)', ...docTypeBadgeStyle(doc.type) }}>
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
                        {doc.sourceDocumentId && <div style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Réf: {state.documents.find(d => d.id === doc.sourceDocumentId)?.invoiceNumber}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{doc.recipient.name || '—'}</div>
                        {doc.recipient.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>{doc.recipient.company}</div>}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(doc.date)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(doc.dueDate)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(total, doc.settings.currency)}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: paidAmt > 0 ? '#16A34A' : 'var(--text-4)', fontSize: '0.82rem' }}>
                        {paidAmt > 0 ? formatCurrency(paidAmt, doc.settings.currency) : '—'}
                      </td>
                      <td>
                        {doc.status === 'Cancelled'
                          ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7E22CE', background: '#FDF4FF', padding: '0.2rem 0.5rem', borderRadius: 'var(--r-full)' }}>Annulé</span>
                          : <select className={`status-select-badge badge-${doc.status.toLowerCase()}`} value={doc.status}
                              onChange={(e) => handleStatusChange(doc.id, e.target.value)}>
                              <option value="Draft">Brouillon</option>
                              <option value="Sent">Envoyé</option>
                              <option value="Partial">Partiel</option>
                              <option value="Paid">Encaissé</option>
                              <option value="Overdue">En retard</option>
                            </select>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '2px' }}>
                          {isInvoice && !doc.linkedAvoirId && doc.status !== 'Cancelled' && (
                            <button className="btn-icon" title="Paiements reçus" onClick={() => setPaiementsDoc(doc)}>
                              <CreditCard size={14} />
                            </button>
                          )}
                          {canRelance && (
                            <button className="btn-icon" title="Relancer le client" onClick={() => setRelanceDoc(doc)}
                              style={{ color: (doc.relances?.length ?? 0) > 0 ? '#B45309' : 'var(--text-4)' }}>
                              <Bell size={14} />
                            </button>
                          )}
                          {isQuoteOrProforma && doc.status !== 'Cancelled' && (
                            <button className="btn-icon" title="Convertir en facture" onClick={() => handleConvertToInvoice(doc)}
                              style={{ color: '#1D4ED8' }}>
                              <ArrowRight size={14} />
                            </button>
                          )}
                          {isInvoice && !doc.linkedAvoirId && (doc.status === 'Sent' || doc.status === 'Paid' || doc.status === 'Partial') && (
                            <button className="btn-icon" title="Créer un avoir" onClick={() => handleCreateAvoir(doc)}
                              style={{ color: '#7E22CE' }}>
                              <FileX size={14} />
                            </button>
                          )}
                          <button className="btn-icon" onClick={() => handleEdit(doc.id)} title="Modifier"><Edit2 size={14} /></button>
                          <button className="btn-icon" onClick={() => handleDuplicate(doc)} title="Dupliquer"><Copy size={14} /></button>
                          <button className="btn-icon" onClick={() => handleDelete(doc.id)} title="Supprimer"
                            style={{ color: 'var(--status-overdue-text)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="mobile-doc-list">
          {sortedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-4)' }}>
              <FileText size={36} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>Aucun document ne correspond à vos critères.</p>
            </div>
          ) : (
            sortedDocs.map((doc) => {
              const { total } = calculateTotals(
                doc.items || [], doc.settings?.taxRate ?? 0, doc.settings?.discountType ?? 'percentage',
                doc.settings?.discountValue ?? 0, doc.settings?.applyStampDuty ?? false, doc.settings?.stampDutyAmount ?? 0
              );
              const profileName = state.profiles.find((p) => p.id === doc.settings?.profileId)?.profileName;
              const { paid: paidAmt } = getDocPaymentInfo(doc);
              const isInvoice = doc.type === 'invoice';
              const isQuote = doc.type === 'quote' || doc.type === 'proforma';
              const canRelance = isInvoice && (doc.status === 'Sent' || doc.status === 'Overdue' || doc.status === 'Partial');

              return (
                <div key={doc.id} className="mobile-doc-card" style={{ opacity: doc.status === 'Cancelled' ? 0.6 : 1 }}>
                  <div className="mobile-doc-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: 'var(--r-sm)', ...docTypeBadgeStyle(doc.type) }}>
                        {docTypeLabel(doc.type)}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-1)' }}>#{doc.invoiceNumber}</span>
                    </div>
                    {doc.status === 'Cancelled'
                      ? <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7E22CE', background: '#FDF4FF', padding: '0.15rem 0.4rem', borderRadius: 'var(--r-full)' }}>Annulé</span>
                      : <select className={`status-select-badge badge-${doc.status.toLowerCase()}`} value={doc.status}
                          onChange={(e) => handleStatusChange(doc.id, e.target.value)}>
                          <option value="Draft">Brouillon</option>
                          <option value="Sent">Envoyé</option>
                          <option value="Partial">Partiel</option>
                          <option value="Paid">Encaissé</option>
                          <option value="Overdue">En retard</option>
                        </select>
                    }
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div className="mobile-doc-card-title">{doc.recipient.name || 'Client non spécifié'}</div>
                    {doc.recipient.company && <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{doc.recipient.company}</div>}
                    {filterProfileId === 'all' && profileName && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>Profil: {profileName}</div>
                    )}
                  </div>

                  <div className="mobile-doc-card-meta">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--text-4)', fontSize: '0.72rem' }}>Émis le {formatDateShort(doc.date)}</span>
                      {doc.dueDate && <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>Échéance {formatDateShort(doc.dueDate)}</span>}
                      {paidAmt > 0 && <span style={{ color: '#16A34A', fontSize: '0.72rem', fontWeight: 600 }}>Encaissé: {formatCurrency(paidAmt, doc.settings.currency)}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Montant TTC</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-1)' }}>{formatCurrency(total, doc.settings.currency)}</div>
                    </div>
                  </div>

                  <div className="mobile-doc-card-actions" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', minWidth: 80 }}
                      onClick={() => handleEdit(doc.id)}><Edit2 size={13} /> Modifier</button>
                    {isInvoice && !doc.linkedAvoirId && doc.status !== 'Cancelled' && (
                      <button className="btn btn-outline" style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                        onClick={() => setPaiementsDoc(doc)} title="Paiements"><CreditCard size={13} /></button>
                    )}
                    {canRelance && (
                      <button className="btn btn-outline" style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', color: '#B45309', borderColor: '#FDE68A' }}
                        onClick={() => setRelanceDoc(doc)}><Bell size={13} /></button>
                    )}
                    {isQuote && (
                      <button className="btn btn-outline" style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                        onClick={() => handleConvertToInvoice(doc)} title="Convertir"><ArrowRight size={13} /></button>
                    )}
                    <button className="btn btn-ghost" style={{ padding: '0.45rem 0.6rem', color: 'var(--status-overdue-text)' }}
                      onClick={() => handleDelete(doc.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {paiementsDoc && <PaiementsModal document={paiementsDoc} onClose={() => setPaiementsDoc(null)} />}
      {relanceDoc && (
        <RelanceModal
          document={relanceDoc}
          onClose={() => setRelanceDoc(null)}
          onSendRelance={(level, notes) => handleRelance(relanceDoc, level, notes)}
        />
      )}
    </div>
  );
};

export default HistoryTab;
