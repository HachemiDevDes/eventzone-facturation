import React, { useState } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { Plus, Building2, CreditCard, ChevronDown, ChevronUp, User, CheckCircle2 } from 'lucide-react';
import type { BusinessProfile, BankDetails } from '../../types';
import { ALGERIA_WILAYAS, ALGERIA_TVA_RATES } from '../../types';
import { supabase } from '../../lib/supabase';

const EMPTY_BANK: BankDetails = {
  bankName: '', accountHolder: '', accountNumber: '', iban: '', swift: '', rib: '', bankAddress: '',
};

const EMPTY_PROFILE: Omit<BusinessProfile, 'id'> = {
  profileName: 'Nouveau profil',
  businessType: 'company',
  name: '', email: '', phone: '', address: '', wilaya: 'Alger',
  company: '', logo: null, stamp: null,
  nif: '', nis: '', rc: '', art: '', cae: '', activity: '',
  bankDetails: [{ ...EMPTY_BANK }],
  defaultCurrency: 'DZD',
  defaultTaxRate: 19,
  defaultStampDuty: true,
  stampDutyAmount: 1000,
};

const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  openSection: string;
  toggleSection: (s: string) => void;
}> = ({ id, title, icon, children, openSection, toggleSection }) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
    <button
      type="button"
      onClick={() => toggleSection(id)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.25rem', width: '100%', background: openSection === id ? 'var(--surface)' : 'transparent',
        borderBottom: openSection === id ? '1px solid var(--border)' : 'none',
        fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{icon} {title}</div>
      {openSection === id ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
    </button>
    {openSection === id && (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {children}
      </div>
    )}
  </div>
);

const ProfileForm: React.FC<{
  profile: Omit<BusinessProfile, 'id'>;
  onChange: (updated: Omit<BusinessProfile, 'id'>) => void;
  onDelete?: () => void;
}> = ({ profile, onChange, onDelete }) => {
  const [openSection, setOpenSection] = useState<string>('general');
  const toggleSection = (s: string) => setOpenSection((prev) => (prev === s ? '' : s));

  const handleField = (field: keyof typeof profile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  const handleBankField = (bankIndex: number, field: keyof BankDetails, value: string) => {
    const banks = [...profile.bankDetails];
    banks[bankIndex] = { ...banks[bankIndex], [field]: value };
    onChange({ ...profile, bankDetails: banks });
  };



  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onChange({ ...profile, logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onChange({ ...profile, stamp: reader.result as string });
    reader.readAsDataURL(file);
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ── Business Type Toggle ─────────────────── */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-4)', marginBottom: '0.75rem' }}>
          Type de structure
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {/* Auto-entrepreneur */}
          <button
            type="button"
            onClick={() => {
              // Update both fields simultaneously so they don't overwrite each other
              onChange({
                ...profile,
                businessType: 'auto-entrepreneur',
                defaultTaxRate: 0
              });
            }}
            style={{
              border: `2px solid ${profile.businessType === 'auto-entrepreneur' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              padding: '1rem',
              background: profile.businessType === 'auto-entrepreneur' ? 'var(--accent-muted)' : 'var(--bg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--t-base)',
              position: 'relative',
            }}
          >
            {profile.businessType === 'auto-entrepreneur' && (
              <CheckCircle2 size={15} color="var(--text-2)" style={{ position: 'absolute', top: 10, right: 10 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: profile.businessType === 'auto-entrepreneur' ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color="var(--text-2)" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>Auto-Entrepreneur</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              Régime IFU · Non assujetti à la TVA · NIF + N° C.A.E
            </div>
          </button>

          {/* Company */}
          <button
            type="button"
            onClick={() => handleField('businessType', 'company')}
            style={{
              border: `2px solid ${profile.businessType === 'company' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              padding: '1rem',
              background: profile.businessType === 'company' ? 'var(--accent-muted)' : 'var(--bg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--t-base)',
              position: 'relative',
            }}
          >
            {profile.businessType === 'company' && (
              <CheckCircle2 size={15} color="var(--text-2)" style={{ position: 'absolute', top: 10, right: 10 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: profile.businessType === 'company' ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={14} color="var(--text-2)" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>Entreprise</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              SARL, EURL, SNC… · Assujettie TVA · Tous identifiants fiscaux
            </div>
          </button>
        </div>
      </div>

      {/* Profile Name */}
      <div className="form-group">
        <label className="form-label">Nom du profil</label>
        <input value={profile.profileName} onChange={(e) => handleField('profileName', e.target.value)}
          placeholder="Ex: Mon Entreprise Principale" />
      </div>

      <Section id="general" title={profile.businessType === 'auto-entrepreneur' ? 'Informations personnelles' : "Informations de l'entreprise"} icon={profile.businessType === 'auto-entrepreneur' ? <User size={15} /> : <Building2 size={15} />} openSection={openSection} toggleSection={toggleSection}>
        <div className="grid-2">
          {profile.businessType === 'company' && (
            <div className="form-group">
              <label className="form-label">Raison sociale</label>
              <input value={profile.company} onChange={(e) => handleField('company', e.target.value)} placeholder="ACME SARL" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{profile.businessType === 'auto-entrepreneur' ? 'Nom complet *' : 'Nom du gérant'}</label>
            <input value={profile.name} onChange={(e) => handleField('name', e.target.value)}
              placeholder={profile.businessType === 'auto-entrepreneur' ? 'Prénom Nom' : 'Mohamed Benali'} />
          </div>
          {profile.businessType === 'auto-entrepreneur' && (
            <div className="form-group">
              <label className="form-label">Nom commercial (optionnel)</label>
              <input value={profile.company} onChange={(e) => handleField('company', e.target.value)} placeholder="Mon Studio, ..." />
            </div>
          )}
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" value={profile.email} onChange={(e) => handleField('email', e.target.value)} placeholder="contact@exemple.dz" />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input value={profile.phone} onChange={(e) => handleField('phone', e.target.value)} placeholder="0555 00 00 00" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Adresse</label>
          <textarea value={profile.address} onChange={(e) => handleField('address', e.target.value)} rows={2}
            placeholder="123 Rue de la République" />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Wilaya</label>
            <select value={profile.wilaya} onChange={(e) => handleField('wilaya', e.target.value)}>
              {ALGERIA_WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Secteur d'activité</label>
            <input value={profile.activity} onChange={(e) => handleField('activity', e.target.value)}
              placeholder={profile.businessType === 'auto-entrepreneur' ? 'Développement web, graphisme, ...' : 'Commerce de détail, BTP, ...'} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Logo {profile.businessType === 'auto-entrepreneur' ? '/ Photo professionnelle' : "de l'entreprise"}</label>
          {profile.logo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img src={profile.logo} alt="Logo" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 4 }} />
              <button type="button" className="btn btn-danger" onClick={() => handleField('logo', null)}>Supprimer</button>
            </div>
          ) : (
            <div className="upload-zone">
              <input type="file" accept="image/*" onChange={handleLogoUpload} id={`logo-${profile.profileName}`} style={{ display: 'none' }} />
              <label htmlFor={`logo-${profile.profileName}`} style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.25rem' }}>Cliquer pour uploader</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>PNG, JPG, SVG — max 2MB</div>
              </label>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Cachet / Signature</label>
          {profile.stamp ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img src={profile.stamp} alt="Stamp" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 4 }} />
              <button type="button" className="btn btn-danger" onClick={() => handleField('stamp', null)}>Supprimer</button>
            </div>
          ) : (
            <div className="upload-zone">
              <input type="file" accept="image/*" onChange={handleStampUpload} id={`stamp-${profile.profileName}`} style={{ display: 'none' }} />
              <label htmlFor={`stamp-${profile.profileName}`} style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.25rem' }}>Cliquer pour uploader le cachet</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Idéalement PNG transparent — max 2MB</div>
              </label>
            </div>
          )}
        </div>
      </Section>

      <Section id="fiscal" title="Identification fiscale" icon={<span style={{ fontSize: '1rem' }}>🇩🇿</span>} openSection={openSection} toggleSection={toggleSection}>
        {profile.businessType === 'auto-entrepreneur' ? (
          /* ── Auto-Entrepreneur: NIF + N°C.A.E only ── */
          <>
            <div style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong>Régime Auto-Entrepreneur (IFU)</strong> · En tant qu'auto-entrepreneur, vous n'êtes pas assujetti à la TVA. Vos factures porteront la mention <em>«&nbsp;Non assujetti à la TVA — Art. 282 ter du CGI&nbsp;»</em>. Seuls le NIF et le N° C.A.E sont requis.
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">NIF — Numéro d'Identification Fiscale *</label>
                <input value={profile.nif} onChange={(e) => handleField('nif', e.target.value)} placeholder="000000000000000000 0" maxLength={20} />
                <span className="form-hint">Obtenu auprès de la DGI · 19 chiffres + 1 clé</span>
              </div>
              <div className="form-group">
                <label className="form-label">N° C.A.E — Carte d'Auto-Entrepreneur *</label>
                <input value={profile.cae} onChange={(e) => handleField('cae', e.target.value)} placeholder="Ex: 123456789" />
                <span className="form-hint">Délivré par l'ANAE</span>
              </div>
            </div>
          </>
        ) : (
          /* ── Company: all fields ── */
          <>
            <div style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-2)' }}>
              Ces informations apparaissent sur chaque facture et sont obligatoires pour toute entreprise algérienne assujettie à la TVA.
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">NIF — Numéro d'Identification Fiscale</label>
                <input value={profile.nif} onChange={(e) => handleField('nif', e.target.value)} placeholder="000000000000000000 0" maxLength={20} />
                <span className="form-hint">19 chiffres + 1 clé de contrôle</span>
              </div>
              <div className="form-group">
                <label className="form-label">NIS — Numéro d'Identification Statistique</label>
                <input value={profile.nis} onChange={(e) => handleField('nis', e.target.value)} placeholder="000000000000000" />
              </div>
              <div className="form-group">
                <label className="form-label">Registre de Commerce (RC)</label>
                <input value={profile.rc} onChange={(e) => handleField('rc', e.target.value)} placeholder="16/00-XXXXX B26" />
              </div>
              <div className="form-group">
                <label className="form-label">Article d'Imposition (Art.)</label>
                <input value={profile.art} onChange={(e) => handleField('art', e.target.value)} placeholder="XXXXXXXXXX" />
                <span className="form-hint">Délivré par votre recette des impôts</span>
              </div>
            </div>
          </>
        )}
      </Section>

      <Section id="defaults" title="Paramètres par défaut" icon={<span style={{ fontSize: '1rem' }}>⚙️</span>} openSection={openSection} toggleSection={toggleSection}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Devise par défaut</label>
            <select value={profile.defaultCurrency} onChange={(e) => handleField('defaultCurrency', e.target.value as any)}>
              <option value="DZD">DZD — Dinar Algérien</option>
              <option value="USD">USD — Dollar US</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Livre Sterling</option>
              <option value="MAD">MAD — Dirham Marocain</option>
              <option value="TND">TND — Dinar Tunisien</option>
            </select>
          </div>
          {profile.businessType === 'auto-entrepreneur' ? (
            <div className="form-group">
              <label className="form-label">Taux TVA</label>
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: 'var(--r-sm)',
                background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                fontSize: '0.82rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ fontSize: '0.75rem' }}>🔒</span>
                Exonéré (0%) — Régime IFU
              </div>
              <span className="form-hint">Non assujetti à la TVA · Art. 282 ter du CGI</span>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Taux TVA par défaut</label>
              <select value={profile.defaultTaxRate} onChange={(e) => handleField('defaultTaxRate', Number(e.target.value))}>
                {ALGERIA_TVA_RATES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.defaultStampDuty}
              onChange={(e) => handleField('defaultStampDuty', e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-2)' }}>
              Appliquer le droit de timbre par défaut
            </span>
          </label>
          {profile.defaultStampDuty && (
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={profile.stampDutyAmount}
                onChange={(e) => handleField('stampDutyAmount', Number(e.target.value))}
                style={{ width: 100 }}
                min="0"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-4)', whiteSpace: 'nowrap' }}>DA</span>
            </div>
          )}
        </div>
      </Section>

      <Section id="banks" title="Compte bancaire" icon={<CreditCard size={15} />} openSection={openSection} toggleSection={toggleSection}>
        <div style={{ padding: '0.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Banque</label>
                <input value={profile.bankDetails[0]?.bankName || ''} onChange={(e) => handleBankField(0, 'bankName', e.target.value)}
                  placeholder="BNA, CPA, BEA, CNEP, ..." />
              </div>
              <div className="form-group">
                <label className="form-label">Titulaire du compte</label>
                <input value={profile.bankDetails[0]?.accountHolder || ''} onChange={(e) => handleBankField(0, 'accountHolder', e.target.value)}
                  placeholder="Nom complet" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Numéro de compte</label>
                <input value={profile.bankDetails[0]?.accountNumber || ''} onChange={(e) => handleBankField(0, 'accountNumber', e.target.value)}
                  placeholder="00X XXXXX XXXXXXXXXX XX" />
              </div>
              <div className="form-group">
                <label className="form-label">RIB (Relevé d'Identité Bancaire)</label>
                <input value={profile.bankDetails[0]?.rib || ''} onChange={(e) => handleBankField(0, 'rib', e.target.value)}
                  placeholder="XXXX XXXX XXXX XXXX XXXX XXXX XXX" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">IBAN (si disponible)</label>
                <input value={profile.bankDetails[0]?.iban || ''} onChange={(e) => handleBankField(0, 'iban', e.target.value)}
                  placeholder="DZ XXXX XXXX..." />
              </div>
              <div className="form-group">
                <label className="form-label">Code SWIFT / BIC</label>
                <input value={profile.bankDetails[0]?.swift || ''} onChange={(e) => handleBankField(0, 'swift', e.target.value)}
                  placeholder="BNAADZXX" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse de l'agence bancaire</label>
              <input value={profile.bankDetails[0]?.bankAddress || ''} onChange={(e) => handleBankField(0, 'bankAddress', e.target.value)}
                placeholder="Agence d'Alger-Centre" />
            </div>
          </div>
        </div>
      </Section>

      <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>Supprimer ce profil</button>
        )}
      </div>
    </div>
  );
};

const SettingsTab: React.FC = () => {
  const { state, dispatch, activeProfile } = useInvoice();
  const [editingProfileId, setEditingProfileId] = useState<string>(activeProfile?.id || state.profiles[0]?.id);

  const profileBeingEdited = state.profiles.find((p) => p.id === editingProfileId) || state.profiles[0];

  const handleSelectProfile = (id: string) => {
    setEditingProfileId(id);
  };

  const handleUpdateProfile = (updated: Omit<BusinessProfile, 'id'>) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: { id: profileBeingEdited.id, profile: updated } });
  };

  const handleDeleteProfile = async () => {
    if (state.profiles.length <= 1) {
      alert('Vous devez conserver au moins un profil.');
      return;
    }
    if (window.confirm('Supprimer ce profil définitivement ?')) {
      const profileIdToDelete = profileBeingEdited.id;
      dispatch({ type: 'DELETE_PROFILE', payload: profileIdToDelete });
      
      const remaining = state.profiles.filter((p) => p.id !== profileIdToDelete);
      if (remaining.length > 0) {
        setEditingProfileId(remaining[0].id);
      }

      // Delete from Supabase
      try {
        await supabase.from('bank_details').delete().eq('profile_id', profileIdToDelete);
        await supabase.from('profiles').delete().eq('id', profileIdToDelete);
      } catch (err) {
        console.error('Error deleting profile from Supabase:', err);
      }
    }
  };

  const handleCreateProfile = () => {
    // Generate empty profile but with 'Nouveau profil' name
    const newProfile = { ...EMPTY_PROFILE, id: crypto.randomUUID() };
    dispatch({ type: 'ADD_PROFILE', payload: newProfile });
    setEditingProfileId(newProfile.id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Gérez vos profils d'entreprise et informations bancaires</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateProfile}>
          <Plus size={14} /> Nouveau profil
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Profile Selector Sidebar */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-4)', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            Profils
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {state.profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProfile(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: editingProfileId === p.id ? 'var(--accent-muted)' : 'transparent',
                  color: editingProfileId === p.id ? 'var(--text-1)' : 'var(--text-3)',
                  fontWeight: editingProfileId === p.id ? 700 : 500,
                  fontSize: '0.82rem', width: '100%',
                  transition: 'var(--t-fast)',
                }}
              >
                <div className="profile-avatar" style={{ width: 24, height: 24, fontSize: '0.65rem', flexShrink: 0 }}>
                  {(p.company || p.name || 'P').charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.company || p.name || p.profileName}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', fontWeight: 400 }}>{p.profileName}</div>
                </div>
              </button>
            ))}
            <button
              onClick={handleCreateProfile}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem',
                borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'transparent',
                color: 'var(--text-4)',
                fontSize: '0.82rem', width: '100%', marginTop: '0.25rem', transition: 'var(--t-fast)',
              }}
            >
              <Plus size={14} /> Nouveau profil
            </button>
          </div>
        </div>

        {/* Form */}
        <div>
          <ProfileForm
            key={editingProfileId}
            profile={profileBeingEdited}
            onChange={handleUpdateProfile}
            onDelete={state.profiles.length > 1 ? handleDeleteProfile : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
