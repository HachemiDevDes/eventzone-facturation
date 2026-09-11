import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { Edit2, Trash2, Users, Phone, Mail, MapPin, Search } from 'lucide-react';
import type { Client } from '../../types';

const EMPTY_CLIENT: Omit<Client, 'id'> = {
  name: '', company: '', email: '', phone: '', address: '',
  nif: '', nis: '', rc: '', art: '',
};

const ClientsTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [editingId, setEditingId] = useState<string | null>(state.clients[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const clientBeingEdited = state.clients.find(c => c.id === editingId);

  const filteredClients = state.clients.filter(client => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (client.name && client.name.toLowerCase().includes(q)) ||
      (client.company && client.company.toLowerCase().includes(q)) ||
      (client.phone && client.phone.toLowerCase().includes(q)) ||
      (client.email && client.email.toLowerCase().includes(q)) ||
      (client.nif && client.nif.toLowerCase().includes(q))
    );
  });

  const isAllSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id));
  const isSomeSelected = filteredClients.some(c => selectedIds.has(c.id));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!editingId) return;
    dispatch({ 
      type: 'UPDATE_CLIENT', 
      payload: { id: editingId, client: { [e.target.name]: e.target.value } } 
    });
  };

  const handleCreateClient = () => {
    const newClient = { ...EMPTY_CLIENT, id: crypto.randomUUID(), name: 'Nouveau client' };
    dispatch({ type: 'ADD_CLIENT', payload: newClient });
    setEditingId(newClient.id);
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer les ${count} clients sélectionnés ? Cette action est irréversible.`)) {
      const idsToDelete = Array.from(selectedIds);
      dispatch({ type: 'DELETE_CLIENTS', payload: idsToDelete });

      if (editingId && selectedIds.has(editingId)) {
        const remaining = state.clients.filter(c => !selectedIds.has(c.id));
        setEditingId(remaining[0]?.id || null);
      }

      setSelectedIds(new Set());
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer ce client ?')) {
      dispatch({ type: 'DELETE_CLIENT', payload: id });
      if (editingId === id) {
        const remaining = state.clients.filter(c => c.id !== id);
        setEditingId(remaining[0]?.id || null);
      }
      setSelectedIds(prev => {
        if (prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        return prev;
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion des clients</h1>
          <p className="page-subtitle">
            {state.clients.length} client{state.clients.length !== 1 ? 's' : ''} enregistré{state.clients.length !== 1 ? 's' : ''}
            {selectedIds.size > 0 && ` • ${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateClient}>
          Nouveau client
        </button>
      </div>

      <div className="clients-split-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Form */}
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          {clientBeingEdited ? (
            <>
              <h2 className="card-title">Modifier le client</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                <div className="form-section-title">Informations générales</div>
                <div className="form-group">
                  <label className="form-label">Nom / Raison sociale *</label>
                  <input name="name" value={clientBeingEdited.name} onChange={handleChange} required placeholder="Entreprise SARL" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom du contact</label>
                  <input name="company" value={clientBeingEdited.company || ''} onChange={handleChange} placeholder="M. Mohamed Benali" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Téléphone</label>
                    <input name="phone" value={clientBeingEdited.phone || ''} onChange={handleChange} placeholder="0555 00 00 00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input name="email" type="email" value={clientBeingEdited.email || ''} onChange={handleChange} placeholder="contact@..." />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Adresse</label>
                  <textarea name="address" value={clientBeingEdited.address || ''} onChange={handleChange} rows={2} placeholder="Rue, Wilaya..." />
                </div>

                <div className="form-section-title" style={{ marginTop: '0.5rem' }}>Identifiants fiscaux (Algérie)</div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">NIF</label>
                    <input name="nif" value={clientBeingEdited.nif || ''} onChange={handleChange} placeholder="000000000000000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">NIS</label>
                    <input name="nis" value={clientBeingEdited.nis || ''} onChange={handleChange} placeholder="000000000000000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registre de commerce</label>
                    <input name="rc" value={clientBeingEdited.rc || ''} onChange={handleChange} placeholder="16/00-XXXXX B26" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Article d'imposition</label>
                    <input name="art" value={clientBeingEdited.art || ''} onChange={handleChange} placeholder="XXXXXXXXXX" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Users size={32} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--text-4)' }} />
              <p style={{ fontWeight: 500, color: 'var(--text-3)' }}>Sélectionnez un client à modifier ou créez-en un nouveau.</p>
            </div>
          )}
        </div>

        {/* Clients list */}
        <div>
          {state.clients.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <Users size={40} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--text-4)' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.4rem' }}>Aucun client</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-4)' }}>
                Ajoutez vos clients ici ou ils seront enregistrés automatiquement depuis vos factures.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Search and Selection Toolbar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-4)',
                    }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, entreprise, téléphone, NIF..."
                    style={{
                      paddingLeft: '2.25rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>

                {/* Bulk Actions Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--r-sm)',
                    background: selectedIds.size > 0 ? 'var(--status-overdue-bg)' : 'var(--surface)',
                    border: `1.5px solid ${selectedIds.size > 0 ? '#FECDD3' : 'var(--border)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      fontWeight: selectedIds.size > 0 ? 600 : 500,
                      color: selectedIds.size > 0 ? 'var(--status-overdue-text)' : 'var(--text-2)',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = !isAllSelected && isSomeSelected;
                        }
                      }}
                      onChange={handleToggleSelectAll}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: selectedIds.size > 0 ? '#E11D48' : 'var(--text-1)',
                      }}
                    />
                    <span>
                      {selectedIds.size > 0
                        ? `${selectedIds.size} client${selectedIds.size > 1 ? 's' : ''} sélectionné${selectedIds.size > 1 ? 's' : ''}`
                        : `Tout sélectionner (${filteredClients.length})`}
                    </span>
                  </label>

                  {selectedIds.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.78rem',
                          color: 'var(--text-3)',
                        }}
                        onClick={handleClearSelection}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        onClick={handleBulkDelete}
                        title="Supprimer les clients sélectionnés"
                      >
                        <Trash2 size={13} />
                        Supprimer ({selectedIds.size})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Clients Cards List */}
              {filteredClients.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
                    Aucun client ne correspond à votre recherche "{searchQuery}".
                  </p>
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedIds.has(client.id);
                  const isEditing = client.id === editingId;
                  return (
                    <div
                      key={client.id}
                      className="card"
                      style={{
                        padding: '0.9rem 1.15rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.85rem',
                        borderColor: isSelected
                          ? '#F43F5E'
                          : isEditing
                          ? 'var(--text-1)'
                          : undefined,
                        backgroundColor: isSelected ? '#FFF8F8' : undefined,
                        transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{ paddingTop: '2px', flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(client.id)}
                          style={{
                            width: '17px',
                            height: '17px',
                            cursor: 'pointer',
                            accentColor: '#E11D48',
                          }}
                          aria-label={`Sélectionner ${client.name}`}
                        />
                      </div>

                      {/* Content */}
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => handleEdit(client)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-1)' }}>
                            {client.name}
                          </span>
                          {isEditing && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.45rem',
                                background: 'var(--surface-2)',
                                color: 'var(--text-2)',
                              }}
                            >
                              En cours d'édition
                            </span>
                          )}
                        </div>
                        {client.company && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.45rem' }}>
                            {client.company}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          {client.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-4)' }}>
                              <Phone size={11} /> {client.phone}
                            </span>
                          )}
                          {client.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-4)' }}>
                              <Mail size={11} /> {client.email}
                            </span>
                          )}
                          {client.address && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-4)' }}>
                              <MapPin size={11} /> {client.address}
                            </span>
                          )}
                        </div>
                        {(client.nif || client.rc) && (
                          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {client.nif && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>
                                <strong>NIF:</strong> {client.nif}
                              </span>
                            )}
                            {client.rc && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                                <strong>RC:</strong> {client.rc}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button className="btn-icon" onClick={() => handleEdit(client)} title="Modifier">
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(client.id)}
                          title="Supprimer"
                          style={{ color: 'var(--status-overdue-text)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsTab;
