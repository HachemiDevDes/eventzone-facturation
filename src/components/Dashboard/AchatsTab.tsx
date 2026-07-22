import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import {
  ShoppingBag,
  Plus,
  Search,
  Paperclip,
  AlertTriangle,
  Edit2,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  DollarSign,
  FileText,
  ExternalLink,
  X,
} from 'lucide-react';
import type { Expense, PaymentStatus } from '../../types';
import { ExpenseModal } from './ExpenseModal';

export const AchatsTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null);

  // Filter expenses by active profile
  const profileExpenses = state.expenses.filter((e) => e.profileId === state.activeProfileId);

  const customCategories = state.taxSettings[state.activeProfileId]?.customCategories;

  // Search & Status/Category Filtering
  const filteredExpenses = profileExpenses.filter((item) => {
    const matchesSearch =
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    let matchesStatus = true;
    if (statusFilter === 'Paid') matchesStatus = item.status === 'Paid';
    else if (statusFilter === 'Pending') matchesStatus = item.status === 'Pending';
    else if (statusFilter === 'Partial') matchesStatus = item.status === 'Partial';
    else if (statusFilter === 'missing_receipt') matchesStatus = !item.attachmentUrl;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate Metrics
  const stats = profileExpenses.reduce(
    (acc, curr) => {
      acc.totalTTC += curr.amountTTC;
      acc.totalTVA += curr.amountTVA;
      if (curr.status === 'Pending' || curr.status === 'Partial') {
        acc.pendingTTC += curr.amountTTC;
      }
      if (!curr.attachmentUrl) {
        acc.missingReceipts += 1;
      }
      return acc;
    },
    { totalTTC: 0, totalTVA: 0, pendingTTC: 0, missingReceipts: 0 }
  );

  const existingSuppliers = Array.from(new Set(profileExpenses.map((e) => e.supplier).filter(Boolean)));

  const handleSaveExpense = (expense: Expense) => {
    const exists = state.expenses.some((e) => e.id === expense.id);
    if (exists) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: { id: expense.id, expense } });
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
    }
    setEditingExpense(null);
  };

  const handleDuplicate = (expense: Expense) => {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: expense.invoiceNumber ? `${expense.invoiceNumber}-COPY` : '',
    };
    dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cet achat ?')) {
      dispatch({ type: 'DELETE_EXPENSE', payload: id });
    }
  };

  const statusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return <span className="status-badge status-paid"><CheckCircle2 size={12} /> Payé</span>;
      case 'Pending':
        return <span className="status-badge status-draft"><Clock size={12} /> En attente</span>;
      case 'Partial':
        return <span className="status-badge status-sent"><Clock size={12} /> Partiel</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Achats & Charges</h1>
          <p className="page-subtitle">Suivi des factures fournisseurs et justificatifs de charges</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingExpense(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Nouvel Achat
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-card-accent">
          <div className="stat-icon">
            <ShoppingBag size={18} />
          </div>
          <div className="stat-label">Total des Achats</div>
          <div className="stat-value">{formatCurrency(stats.totalTTC, 'DZD')}</div>
          <div className="stat-meta">Montant TTC sur la période</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={18} />
          </div>
          <div className="stat-label">TVA Déductible</div>
          <div className="stat-value" style={{ color: 'var(--text-1)' }}>
            {formatCurrency(stats.totalTVA, 'DZD')}
          </div>
          <div className="stat-meta">Récupérable sur le G50</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={18} />
          </div>
          <div className="stat-label">En Attente de Paiement</div>
          <div className="stat-value">{formatCurrency(stats.pendingTTC, 'DZD')}</div>
          <div className="stat-meta">Factures non réglées</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{
              background: stats.missingReceipts > 0 ? 'var(--status-overdue-bg)' : 'var(--surface-2)',
              color: stats.missingReceipts > 0 ? 'var(--status-overdue-text)' : 'var(--text-3)',
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div
            className="stat-label"
            style={{ color: stats.missingReceipts > 0 ? 'var(--status-overdue-text)' : 'var(--text-3)' }}
          >
            Justificatifs Manquants
          </div>
          <div
            className="stat-value"
            style={{ color: stats.missingReceipts > 0 ? 'var(--status-overdue-text)' : 'var(--text-1)' }}
          >
            {stats.missingReceipts}
          </div>
          <div className="stat-meta">Factures sans fichier joint</div>
        </div>
      </div>

      {/* Filter & History Card */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2 className="card-title" style={{ margin: 0 }}>
            Historique des achats
          </h2>

          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search
              size={15}
              color="var(--text-4)"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: '2.25rem', fontSize: '0.82rem' }}
              placeholder="Rechercher fournisseur, N°..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'Paid', label: 'Payés' },
            { id: 'Pending', label: 'En attente' },
            { id: 'Partial', label: 'Partiellement payés' },
            { id: 'missing_receipt', label: 'Sans justificatif' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`btn ${statusFilter === pill.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
            >
              {pill.label}
            </button>
          ))}

          {/* Category Filter */}
          <div style={{ marginLeft: 'auto' }}>
            <select
              className="input-field"
              style={{ padding: '0.35rem 2rem 0.35rem 0.75rem', fontSize: '0.78rem', width: 'auto' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Toutes les catégories</option>
              {(customCategories && customCategories.length > 0 ? customCategories : []).map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Purchases Table */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Catégorie</th>
                <th>N° Facture</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th style={{ textAlign: 'right' }}>TVA</th>
                <th style={{ textAlign: 'right' }}>Montant TTC</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'center' }}>Justificatif</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-4)' }}>
                    Aucun achat enregistré.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{formatDateShort(item.date)}</td>
                    <td style={{ fontWeight: 600 }}>{item.supplier}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'var(--surface-2)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--r-sm)',
                          color: 'var(--text-2)',
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{item.invoiceNumber || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.amountHT, 'DZD')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-3)' }}>
                      {item.amountTVA > 0 ? formatCurrency(item.amountTVA, 'DZD') : '0 DA'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                      {formatCurrency(item.amountTTC, 'DZD')}
                    </td>
                    <td style={{ textAlign: 'center' }}>{statusBadge(item.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {item.attachmentUrl ? (
                        <button
                          className="btn-icon"
                          title="Voir la pièce jointe"
                          onClick={() => setPreviewAttachment({ url: item.attachmentUrl!, name: item.attachmentName || 'Justificatif' })}
                          style={{ color: 'var(--text-1)' }}
                        >
                          <Paperclip size={15} />
                        </button>
                      ) : (
                        <span title="Justificatif manquant" style={{ color: 'var(--status-overdue-text)' }}>
                          <AlertTriangle size={15} />
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button
                          className="btn-icon"
                          title="Modifier"
                          onClick={() => {
                            setEditingExpense(item);
                            setModalOpen(true);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon" title="Dupliquer" onClick={() => handleDuplicate(item)}>
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Supprimer"
                          onClick={() => handleDelete(item.id)}
                          style={{ color: 'var(--status-overdue-text)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveExpense}
        initialData={editingExpense}
        existingSuppliers={existingSuppliers}
        customCategories={customCategories}
        activeProfileId={state.activeProfileId}
      />

      {/* Preview Attachment Modal */}
      {previewAttachment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
              maxWidth: '800px',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1rem',
              margin: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{previewAttachment.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  className="btn btn-outline"
                  style={{ fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> Télécharger
                </a>
                <button className="btn-icon" onClick={() => setPreviewAttachment(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: '#000' }}>
              {previewAttachment.url.startsWith('data:application/pdf') ? (
                <iframe src={previewAttachment.url} width="100%" height="100%" title="Justificatif PDF" style={{ border: 'none' }} />
              ) : (
                <img
                  src={previewAttachment.url}
                  alt="Justificatif"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
