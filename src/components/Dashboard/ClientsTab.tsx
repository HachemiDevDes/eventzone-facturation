import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { Edit2, Trash2, Users, Phone, Mail, MapPin } from 'lucide-react';
import type { Client } from '../../types';
import { supabase } from '../../lib/supabase';

const EMPTY_CLIENT: Omit<Client, 'id'> = {
  name: '', company: '', email: '', phone: '', address: '',
  nif: '', nis: '', rc: '', art: '',
};

const ClientsTab: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const [form, setForm] = useState<Omit<Client, 'id'>>({ ...EMPTY_CLIENT });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingId) {
      dispatch({ type: 'UPDATE_CLIENT', payload: { id: editingId, client: form } });
      setEditingId(null);
    } else {
      dispatch({ type: 'ADD_CLIENT', payload: form });
    }
    setForm({ ...EMPTY_CLIENT });
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name, company: client.company || '', email: client.email || '',
      phone: client.phone || '', address: client.address || '',
      nif: client.nif || '', nis: client.nis || '', rc: client.rc || '', art: client.art || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Supprimer ce client ?')) {
      dispatch({ type: 'DELETE_CLIENT', payload: id });
      try {
        await supabase.from('clients').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting client from Supabase:', err);
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ ...EMPTY_CLIENT });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion des clients</h1>
          <p className="page-subtitle">{state.clients.length} client{state.clients.length !== 1 ? 's' : ''} enregistré{state.clients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Form */}
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <h2 className="card-title">{editingId ? 'Modifier le client' : 'Nouveau client'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            <div className="form-section-title">Informations générales</div>
            <div className="form-group">
              <label className="form-label">Nom / Raison sociale *</label>
              <input name="name" value={form.name} onChange={handleChange} required placeholder="Entreprise SARL" />
            </div>
            <div className="form-group">
              <label className="form-label">Nom du contact</label>
              <input name="company" value={form.company} onChange={handleChange} placeholder="M. Mohamed Benali" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input name="phone" value={form.phone || ''} onChange={handleChange} placeholder="0555 00 00 00" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input name="email" type="email" value={form.email || ''} onChange={handleChange} placeholder="contact@..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <textarea name="address" value={form.address || ''} onChange={handleChange} rows={2} placeholder="Rue, Wilaya..." />
            </div>

            <div className="form-section-title" style={{ marginTop: '0.5rem' }}>Identifiants fiscaux (Algérie)</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">NIF</label>
                <input name="nif" value={form.nif || ''} onChange={handleChange} placeholder="000000000000000" />
              </div>
              <div className="form-group">
                <label className="form-label">NIS</label>
                <input name="nis" value={form.nis || ''} onChange={handleChange} placeholder="000000000000000" />
              </div>
              <div className="form-group">
                <label className="form-label">Registre de commerce</label>
                <input name="rc" value={form.rc || ''} onChange={handleChange} placeholder="16/00-XXXXX B26" />
              </div>
              <div className="form-group">
                <label className="form-label">Article d'imposition</label>
                <input name="art" value={form.art || ''} onChange={handleChange} placeholder="XXXXXXXXXX" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingId ? 'Mettre à jour' : 'Enregistrer le client'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-outline" onClick={handleCancel}>
                  Annuler
                </button>
              )}
            </div>
          </form>
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
              {state.clients.map((client) => (
                <div key={client.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: '0.1rem' }}>
                        {client.name}
                      </div>
                      {client.company && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
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
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button className="btn-icon" onClick={() => handleEdit(client)} title="Modifier">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(client.id)}
                        title="Supprimer" style={{ color: 'var(--status-overdue-text)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsTab;
