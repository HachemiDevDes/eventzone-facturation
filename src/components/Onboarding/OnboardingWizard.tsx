import React, { useState, useEffect } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  FileText,
  CreditCard,
  Landmark,
  Sparkles,
  AlertCircle,
  Plus,
  LayoutDashboard,
  LogOut,
  Upload,
  Trash2,
  Lock,
  Wallet,
  X
} from 'lucide-react';
import type { BusinessType, Currency, BusinessProfile, BankDetails } from '../../types';
import { ALGERIA_WILAYAS, ALGERIA_TVA_RATES } from '../../types';
import { supabase } from '../../lib/supabase';

const POPULAR_ALGERIAN_BANKS = [
  'BNA',
  'CPA',
  'BEA',
  'BDL',
  'BADR',
  'CNEP Banque',
  'Algérie Poste (CCP)',
  'Société Générale Algérie',
  'BNP Paribas El Djazaïr',
  'Al Baraka Bank',
  'AGB (Gulf Bank)',
  'Natixis Algérie',
  'Banque Al Salam',
];

interface OnboardingWizardProps {
  onComplete?: () => void;
  isModalMode?: boolean; // if launched from settings as a review
}

export default function OnboardingWizard({ onComplete, isModalMode = false }: OnboardingWizardProps) {
  const { state, dispatch, activeProfile } = useInvoice();
  const navigate = useNavigate();

  // Current Step: 1, 2, 3, or 4
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State initialized from activeProfile or sensible defaults
  const [businessType, setBusinessType] = useState<BusinessType>(activeProfile?.businessType || 'company');
  const [company, setCompany] = useState(activeProfile?.company || '');
  const [name, setName] = useState(activeProfile?.name || '');
  const [email, setEmail] = useState(activeProfile?.email || '');
  const [phone, setPhone] = useState(activeProfile?.phone || '');
  const [wilaya, setWilaya] = useState(activeProfile?.wilaya || 'Alger');
  const [address, setAddress] = useState(activeProfile?.address || '');
  const [activity, setActivity] = useState(activeProfile?.activity || '');
  const [logo, setLogo] = useState<string | null>(activeProfile?.logo || null);

  // Fiscal Details
  const [nif, setNif] = useState(activeProfile?.nif || '');
  const [rc, setRc] = useState(activeProfile?.rc || '');
  const [nis, setNis] = useState(activeProfile?.nis || '');
  const [art, setArt] = useState(activeProfile?.art || '');
  const [cae, setCae] = useState(activeProfile?.cae || '');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>(activeProfile?.defaultCurrency || 'DZD');
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(
    activeProfile?.businessType === 'auto-entrepreneur' ? 0 : (activeProfile?.defaultTaxRate ?? 19)
  );
  const [defaultStampDuty, setDefaultStampDuty] = useState<boolean>(activeProfile?.defaultStampDuty ?? true);
  const [stampDutyAmount, setStampDutyAmount] = useState<number>(activeProfile?.stampDutyAmount ?? 1000);

  // Bank & Financial Details
  const currentBank = activeProfile?.bankDetails?.[0];
  const [bankName, setBankName] = useState(currentBank?.bankName || '');
  const [accountHolder, setAccountHolder] = useState(currentBank?.accountHolder || activeProfile?.company || activeProfile?.name || '');
  const [accountNumber, setAccountNumber] = useState(currentBank?.accountNumber || '');
  const [rib, setRib] = useState(currentBank?.rib || '');
  const [iban, setIban] = useState(currentBank?.iban || '');
  const [swift, setSwift] = useState(currentBank?.swift || '');
  const [bankAddress, setBankAddress] = useState(currentBank?.bankAddress || '');
  const [openingBalance, setOpeningBalance] = useState<number>(activeProfile?.openingBalance ?? 0);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate user email & full name from Supabase session if empty
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        setEmail((prev) => prev || user.email || '');
        const metaName = user.user_metadata?.name || user.user_metadata?.full_name;
        if (metaName) {
          setName((prev) => prev || metaName);
          setCompany((prev) => prev || metaName);
        }
      }
    });
  }, []);

  // When company or name changes, automatically suggest account holder if not yet filled
  useEffect(() => {
    if (!accountHolder) {
      if (businessType === 'company' && company.trim()) {
        setAccountHolder(company.trim());
      } else if (name.trim()) {
        setAccountHolder(name.trim());
      }
    }
  }, [company, name, businessType, accountHolder]);

  // Adjust tax rate when switching structure
  const handleBusinessTypeChange = (type: BusinessType) => {
    setBusinessType(type);
    if (type === 'auto-entrepreneur') {
      setDefaultTaxRate(0);
    } else {
      setDefaultTaxRate(19);
    }
    setErrors({});
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Step Validation logic
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (businessType === 'company' && !company.trim()) {
        newErrors.company = "La raison sociale de l'entreprise est obligatoire.";
      }
      if (!name.trim()) {
        newErrors.name = businessType === 'company' ? "Le nom du gérant est obligatoire." : "Votre nom complet est obligatoire.";
      }
      if (!email.trim() || !email.includes('@')) {
        newErrors.email = "Une adresse email valide est obligatoire.";
      }
      if (!phone.trim()) {
        newErrors.phone = "Le numéro de téléphone est obligatoire.";
      }
      if (!wilaya.trim()) {
        newErrors.wilaya = "Veuillez sélectionner votre wilaya.";
      }
    }

    if (step === 2) {
      if (!nif.trim()) {
        newErrors.nif = "Le Numéro d'Identification Fiscale (NIF) est obligatoire.";
      } else if (nif.trim().length < 9) {
        newErrors.nif = "Le NIF semble trop court (généralement 15 ou 20 chiffres).";
      }

      if (businessType === 'company') {
        if (!rc.trim()) {
          newErrors.rc = "Le numéro de Registre de Commerce (RC) est obligatoire pour une entreprise.";
        }
      } else {
        if (!cae.trim()) {
          newErrors.cae = "Le numéro de Carte d'Auto-Entrepreneur (C.A.E) est obligatoire.";
        }
      }
    }

    if (step === 3) {
      if (!bankName.trim()) {
        newErrors.bankName = "Veuillez indiquer le nom de votre banque ou CCP.";
      }
      if (!accountHolder.trim()) {
        newErrors.accountHolder = "Le nom du titulaire du compte est obligatoire.";
      }
      if (!rib.trim() && !accountNumber.trim()) {
        newErrors.rib = "Le RIB ou le numéro de compte est obligatoire pour recevoir vos paiements.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      if (currentStep < 4) {
        setCurrentStep((prev) => (prev + 1) as any);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBack = () => {
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveAndComplete = async (action: 'first_invoice' | 'dashboard') => {
    setIsSubmitting(true);

    const primaryBank: BankDetails = {
      bankName: bankName.trim(),
      accountHolder: accountHolder.trim(),
      accountNumber: accountNumber.trim() || rib.trim(),
      rib: rib.trim(),
      iban: iban.trim(),
      swift: swift.trim(),
      bankAddress: bankAddress.trim(),
    };

    const updatedProfile: Partial<BusinessProfile> = {
      profileName: company.trim() || name.trim() || 'Mon Entreprise',
      businessType,
      company: company.trim(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      wilaya: wilaya.trim(),
      address: address.trim(),
      activity: activity.trim(),
      logo,
      nif: nif.trim(),
      rc: rc.trim(),
      nis: nis.trim(),
      art: art.trim(),
      cae: cae.trim(),
      defaultCurrency,
      defaultTaxRate: businessType === 'auto-entrepreneur' ? 0 : defaultTaxRate,
      defaultStampDuty,
      stampDutyAmount,
      openingBalance,
      bankDetails: [primaryBank],
      onboardingCompleted: true,
    };

    const targetProfileId = activeProfile?.id || state.profiles[0]?.id;

    if (targetProfileId) {
      dispatch({
        type: 'UPDATE_PROFILE',
        payload: {
          id: targetProfileId,
          profile: updatedProfile,
        },
      });

      // Synchronize current document sender & bank details if status is draft
      dispatch({
        type: 'SET_CURRENT_DOCUMENT',
        payload: {
          logo: logo,
          sender: {
            name: name.trim(),
            email: email.trim(),
            company: company.trim(),
            address: address.trim() + (wilaya ? `, ${wilaya}` : ''),
            phone: phone.trim(),
            nif: nif.trim(),
            nis: nis.trim(),
            rc: rc.trim(),
            art: art.trim(),
            cae: cae.trim(),
          },
          senderBankDetails: primaryBank,
          settings: {
            ...state.currentDocument.settings,
            currency: defaultCurrency,
            taxRate: businessType === 'auto-entrepreneur' ? 0 : defaultTaxRate,
            applyStampDuty: defaultStampDuty,
            stampDutyAmount,
          },
        },
      });
    }

    if (onComplete) {
      onComplete();
    }

    setIsSubmitting(false);

    if (action === 'first_invoice') {
      const newId = crypto.randomUUID();
      dispatch({ type: 'START_NEW_DOCUMENT', payload: { type: 'invoice', id: newId } });
      navigate(`/builder/${newId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        localStorage.removeItem(`fawtara_dashboard_state_${session.user.id}`);
      }
      localStorage.removeItem('fawtara_dashboard_state');
    } catch (e) {
      console.warn('Error clearing localStorage on logout:', e);
    }
    await supabase.auth.signOut();
    window.location.reload();
  };

  // Progress percentage
  const progressPercent = currentStep === 1 ? 25 : currentStep === 2 ? 50 : currentStep === 3 ? 75 : 100;

  return (
    <div className="onboarding-container" style={{
      minHeight: '100vh',
      backgroundColor: 'var(--surface-2, #F4F4F5)',
      fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-1, #0F172A)',
    }}>
      {/* Top Navbar */}
      <header style={{
        background: 'var(--bg, #FFFFFF)',
        borderBottom: '1px solid var(--border, #E2E8F0)',
        padding: '0.9rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'var(--accent, #D4F252)',
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm, 6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(212,242,82,0.4)',
          }}>
            <FileText size={18} color="#0F172A" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Fawtara</span>
              <span style={{
                background: 'var(--accent-muted, #EBF9B2)',
                color: 'var(--text-1, #0F172A)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--r-full, 9999px)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>
                Configuration requise
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3, #64748B)' }}>
              Complétez vos informations pour débloquer la plateforme et créer vos factures
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {email && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-3, #64748B)',
              background: 'var(--surface, #FAFAFA)',
              border: '1px solid var(--border, #E2E8F0)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--r-full, 9999px)',
            }} className="no-mobile">
              {email}
            </div>
          )}
          {isModalMode && onComplete ? (
            <button
              onClick={onComplete}
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', gap: '0.35rem' }}
              title="Fermer l'assistant"
            >
              <X size={14} />
              <span>Fermer</span>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', gap: '0.35rem', color: 'var(--text-3, #64748B)' }}
              title="Changer de compte ou quitter"
            >
              <LogOut size={14} />
              <span>Déconnexion</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        maxWidth: '820px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem 1.25rem 4rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        {/* Progress & Stepper Bar */}
        <div style={{
          background: 'var(--bg, #FFFFFF)',
          borderRadius: 'var(--r-lg, 14px)',
          border: '1px solid var(--border, #E2E8F0)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
        }}>
          {/* Progress track */}
          <div style={{
            height: 6,
            background: 'var(--surface-2, #F4F4F5)',
            borderRadius: 'var(--r-full, 9999px)',
            overflow: 'hidden',
            marginBottom: '1.25rem',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'var(--accent, #D4F252)',
              transition: 'width 300ms ease',
              borderRadius: 'var(--r-full, 9999px)',
            }} />
          </div>

          {/* Stepper items */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
          }}>
            {[
              { num: 1, title: 'Profil & Structure', desc: 'Identité juridique', icon: Building2 },
              { num: 2, title: 'Fiscalité & Factures', desc: 'NIF & régime fiscal', icon: FileText },
              { num: 3, title: 'Coordonnées Bancaires', desc: 'Détails financiers', icon: Landmark },
              { num: 4, title: 'Prêt à facturer', desc: 'Récapitulatif & départ', icon: Sparkles },
            ].map((s) => {
              const isPast = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    opacity: isCurrent ? 1 : isPast ? 0.9 : 0.45,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-full, 9999px)',
                    background: isPast
                      ? 'var(--text-1, #0F172A)'
                      : isCurrent
                      ? 'var(--accent, #D4F252)'
                      : 'var(--surface-2, #F4F4F5)',
                    color: isPast
                      ? '#FFFFFF'
                      : isCurrent
                      ? 'var(--text-1, #0F172A)'
                      : 'var(--text-4, #94A3B8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                    border: isCurrent ? '2px solid var(--text-1, #0F172A)' : '1px solid transparent',
                  }}>
                    {isPast ? <CheckCircle2 size={16} color="#FFFFFF" /> : <Icon size={14} />}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }} className="no-mobile">
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: isCurrent ? 700 : 600,
                      color: isCurrent ? 'var(--text-1, #0F172A)' : 'var(--text-3, #64748B)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-4, #94A3B8)', whiteSpace: 'nowrap' }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Error Banner if any */}
        {Object.keys(errors).length > 0 && (
          <div style={{
            background: '#FFF1F2',
            border: '1px solid #FECDD3',
            borderRadius: 'var(--r-md, 10px)',
            padding: '0.85rem 1.15rem',
            color: '#BE123C',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.84rem',
            animation: 'fadeIn 0.2s ease',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Veuillez renseigner les champs obligatoires manquants :</strong>
              <div style={{ marginTop: '0.2rem', fontSize: '0.78rem' }}>
                {Object.values(errors).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Profil & Structure */}
        {currentStep === 1 && (
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3, #64748B)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Étape 1 sur 4
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                Structure & Coordonnées de votre activité
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3, #64748B)', marginTop: '0.25rem' }}>
                Choisissez votre statut juridique en Algérie et renseignez vos informations de contact.
              </p>
            </div>

            {/* Structure Type Select */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Type de structure juridique</span>
                <span className="badge-required">Obligatoire</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Entreprise */}
                <button
                  type="button"
                  onClick={() => handleBusinessTypeChange('company')}
                  style={{
                    border: `2px solid ${businessType === 'company' ? 'var(--text-1, #0F172A)' : 'var(--border, #E2E8F0)'}`,
                    borderRadius: 'var(--r-md, 10px)',
                    padding: '1.25rem',
                    background: businessType === 'company' ? 'var(--accent-muted, #EBF9B2)' : 'var(--bg, #FFFFFF)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--t-base)',
                    position: 'relative',
                  }}
                >
                  {businessType === 'company' && (
                    <div style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'var(--text-1, #0F172A)',
                      color: '#FFFFFF',
                      width: 20,
                      height: 20,
                      borderRadius: 'var(--r-full, 9999px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={13} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--r-sm, 6px)',
                      background: businessType === 'company' ? 'var(--accent, #D4F252)' : 'var(--surface-2, #F4F4F5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Building2 size={16} color="var(--text-1, #0F172A)" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Entreprise / Société</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-2, #334155)', lineHeight: 1.5 }}>
                    SARL, EURL, SPA, SNC, Profession libérale · Assujettie à la TVA · Exige NIF & Registre de Commerce (RC).
                  </div>
                </button>

                {/* Auto-entrepreneur */}
                <button
                  type="button"
                  onClick={() => handleBusinessTypeChange('auto-entrepreneur')}
                  style={{
                    border: `2px solid ${businessType === 'auto-entrepreneur' ? 'var(--text-1, #0F172A)' : 'var(--border, #E2E8F0)'}`,
                    borderRadius: 'var(--r-md, 10px)',
                    padding: '1.25rem',
                    background: businessType === 'auto-entrepreneur' ? 'var(--accent-muted, #EBF9B2)' : 'var(--bg, #FFFFFF)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--t-base)',
                    position: 'relative',
                  }}
                >
                  {businessType === 'auto-entrepreneur' && (
                    <div style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'var(--text-1, #0F172A)',
                      color: '#FFFFFF',
                      width: 20,
                      height: 20,
                      borderRadius: 'var(--r-full, 9999px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={13} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--r-sm, 6px)',
                      background: businessType === 'auto-entrepreneur' ? 'var(--accent, #D4F252)' : 'var(--surface-2, #F4F4F5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <User size={16} color="var(--text-1, #0F172A)" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Auto-Entrepreneur</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-2, #334155)', lineHeight: 1.5 }}>
                    Statut officiel ANAE (Loi 22-23) · Régime IFU (0% TVA) · Exige NIF & Carte d'Auto-Entrepreneur (N° C.A.E).
                  </div>
                </button>
              </div>
            </div>

            {/* Names & Contact Grid */}
            <div className="grid-2">
              {businessType === 'company' ? (
                <div className="form-group">
                  <label className="form-label">
                    <span>Raison sociale / Nom de l'entreprise</span>
                    <span className="badge-required">Obligatoire</span>
                  </label>
                  <input
                    className={errors.company ? 'input-error' : ''}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: SARL Eventzone, Tech Horizon..."
                  />
                  {errors.company && <span className="error-message">{errors.company}</span>}
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    <span>Nom commercial ou Studio</span>
                    <span className="badge-optional">Optionnel</span>
                  </label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Mon Studio Freelance..."
                  />
                  <span className="form-hint">Nom d'enseigne affiché sur vos devis et factures</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <span>{businessType === 'company' ? 'Nom et prénom du gérant' : 'Votre nom et prénom complet'}</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <input
                  className={errors.name ? 'input-error' : ''}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mohamed Benali"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  <span>Email professionnel</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <input
                  type="email"
                  className={errors.email ? 'input-error' : ''}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@monentreprise.dz"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Numéro de téléphone</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <input
                  className={errors.phone ? 'input-error' : ''}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 0555 12 34 56 ou 021 00 00 00"
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  <span>Wilaya</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <select
                  value={wilaya}
                  onChange={(e) => setWilaya(e.target.value)}
                  className={errors.wilaya ? 'input-error' : ''}
                >
                  {ALGERIA_WILAYAS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                {errors.wilaya && <span className="error-message">{errors.wilaya}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Secteur d'activité</span>
                  <span className="badge-optional">Optionnel</span>
                </label>
                <input
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Ex: Prestations IT, Design, Commerce, BTP..."
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Adresse du siège / domicile</span>
                <span className="badge-optional">Optionnel</span>
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="Ex: 04 Rue Didouche Mourad, Alger Centre"
              />
            </div>

            {/* Logo Upload Zone */}
            <div className="form-group">
              <label className="form-label">
                <span>Logo de facturation</span>
                <span className="badge-optional">Optionnel</span>
              </label>
              {logo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface, #FAFAFA)', padding: '0.75rem 1rem', borderRadius: 'var(--r-sm, 6px)', border: '1px solid var(--border, #E2E8F0)' }}>
                  <img
                    src={logo}
                    alt="Logo preview"
                    style={{ maxHeight: 48, maxWidth: 140, objectFit: 'contain' }}
                  />
                  <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-2, #334155)' }}>
                    Logo prêt pour vos factures
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setLogo(null)}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Trash2 size={13} />
                    <span>Retirer</span>
                  </button>
                </div>
              ) : (
                <div className="upload-zone" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    id="onboarding-logo-file"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="onboarding-logo-file" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={22} color="var(--text-3, #64748B)" style={{ margin: '0 auto 0.4rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-1, #0F172A)', fontSize: '0.85rem' }}>
                      Cliquer pour uploader votre logo
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4, #94A3B8)', marginTop: '0.15rem' }}>
                      PNG, JPG ou SVG (max 2 Mo) · Vous pourrez aussi l'ajouter plus tard
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Fiscalité & Factures */}
        {currentStep === 2 && (
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3, #64748B)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Étape 2 sur 4
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                Identification Fiscale & Paramètres de Facturation
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3, #64748B)', marginTop: '0.25rem' }}>
                Ces identifiants garantissent la validité légale et fiscale de vos factures en Algérie.
              </p>
            </div>

            {/* Context Notice Banner */}
            {businessType === 'company' ? (
              <div style={{
                background: 'var(--accent-muted, #EBF9B2)',
                border: '1px solid var(--accent, #D4F252)',
                borderRadius: 'var(--r-md, 10px)',
                padding: '1rem',
                fontSize: '0.82rem',
                color: 'var(--text-1, #0F172A)',
                lineHeight: 1.5,
              }}>
                <strong>Obligation légale (Code de Commerce & DGI) :</strong> Toute facture émise par une entreprise en Algérie doit obligatoirement mentionner le <strong>NIF</strong> et le numéro de <strong>Registre de Commerce (RC)</strong>. Le NIS et l'Article d'Imposition sont recommandés.
              </div>
            ) : (
              <div style={{
                background: 'var(--accent-muted, #EBF9B2)',
                border: '1px solid var(--accent, #D4F252)',
                borderRadius: 'var(--r-md, 10px)',
                padding: '1rem',
                fontSize: '0.82rem',
                color: 'var(--text-1, #0F172A)',
                lineHeight: 1.5,
              }}>
                <strong>Régime Auto-Entrepreneur (Loi 22-23 & Art. 282 ter du CGI) :</strong> Vous bénéficiez du régime de l'IFU (Impôt Forfaitaire Unique) à 0.5% ou 5% et êtes <strong>exonéré de TVA (0%)</strong>. Vos factures comporteront automatiquement la mention légale obligatoire. Le NIF et le N° C.A.E sont indispensables.
              </div>
            )}

            {/* Fiscal Identifiers Fields */}
            {businessType === 'company' ? (
              <>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      <span>NIF — Numéro d'Identification Fiscale</span>
                      <span className="badge-required">Obligatoire</span>
                    </label>
                    <input
                      className={errors.nif ? 'input-error' : ''}
                      value={nif}
                      onChange={(e) => setNif(e.target.value)}
                      placeholder="Ex: 002616124370413 (15 ou 20 chiffres)"
                      maxLength={25}
                    />
                    <span className="form-hint">Attribué par la Direction Générale des Impôts (DGI)</span>
                    {errors.nif && <span className="error-message">{errors.nif}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>RC — Registre de Commerce</span>
                      <span className="badge-required">Obligatoire</span>
                    </label>
                    <input
                      className={errors.rc ? 'input-error' : ''}
                      value={rc}
                      onChange={(e) => setRc(e.target.value)}
                      placeholder="Ex: 16/00-1234567B26"
                    />
                    <span className="form-hint">Délivré par le CNRC</span>
                    {errors.rc && <span className="error-message">{errors.rc}</span>}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      <span>NIS — Numéro d'Identification Statistique</span>
                      <span className="badge-optional">Optionnel</span>
                    </label>
                    <input
                      value={nis}
                      onChange={(e) => setNis(e.target.value)}
                      placeholder="Ex: 000000000000000"
                    />
                    <span className="form-hint">Délivré par l'ONS</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>Article d'Imposition (Art. Imp.)</span>
                      <span className="badge-optional">Optionnel</span>
                    </label>
                    <input
                      value={art}
                      onChange={(e) => setArt(e.target.value)}
                      placeholder="Ex: 16010000000"
                    />
                    <span className="form-hint">Délivré par votre recette des impôts</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <span>NIF — Numéro d'Identification Fiscale</span>
                    <span className="badge-required">Obligatoire</span>
                  </label>
                  <input
                    className={errors.nif ? 'input-error' : ''}
                    value={nif}
                    onChange={(e) => setNif(e.target.value)}
                    placeholder="Ex: 10346010080510202280"
                    maxLength={25}
                  />
                  <span className="form-hint">NIF personnel obtenu auprès de la DGI</span>
                  {errors.nif && <span className="error-message">{errors.nif}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>N° C.A.E — Carte d'Auto-Entrepreneur</span>
                    <span className="badge-required">Obligatoire</span>
                  </label>
                  <input
                    className={errors.cae ? 'input-error' : ''}
                    value={cae}
                    onChange={(e) => setCae(e.target.value)}
                    placeholder="Ex: ANAE-2024-00123"
                  />
                  <span className="form-hint">Délivré par l'Agence Nationale de l'Auto-Entrepreneur</span>
                  {errors.cae && <span className="error-message">{errors.cae}</span>}
                </div>
              </div>
            )}

            {/* Invoicing Defaults */}
            <div style={{
              borderTop: '1px solid var(--border, #E2E8F0)',
              paddingTop: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-1, #0F172A)' }}>
                Paramètres par défaut des factures
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <span>Devise de facturation</span>
                    <span className="badge-required">Obligatoire</span>
                  </label>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value as Currency)}
                  >
                    <option value="DZD">DZD — Dinar Algérien (DA)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="USD">USD — Dollar Américain ($)</option>
                    <option value="GBP">GBP — Livre Sterling (£)</option>
                    <option value="CAD">CAD — Dollar Canadien (C$)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>Taux de TVA par défaut</span>
                    <span className="badge-required">Obligatoire</span>
                  </label>
                  {businessType === 'auto-entrepreneur' ? (
                    <div style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--r-sm, 6px)',
                      background: 'var(--surface-2, #F4F4F5)',
                      border: '1.5px solid var(--border, #E2E8F0)',
                      fontSize: '0.85rem',
                      color: 'var(--text-3, #64748B)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <Lock size={14} />
                      <span>Exonéré (0%) — Régime IFU légal</span>
                    </div>
                  ) : (
                    <select
                      value={defaultTaxRate}
                      onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
                    >
                      {ALGERIA_TVA_RATES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Stamp Duty Toggle */}
              <div style={{
                background: 'var(--surface, #FAFAFA)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--r-sm, 6px)',
                border: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={defaultStampDuty}
                    onChange={(e) => setDefaultStampDuty(e.target.checked)}
                    style={{ width: 'auto', accentColor: 'var(--text-1, #0F172A)' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1, #0F172A)' }}>
                      Droit de timbre fiscal par défaut (Paiements en espèces)
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4, #94A3B8)' }}>
                      Ajoute automatiquement le timbre fiscal si le mode de paiement sélectionné est en espèces.
                    </div>
                  </div>
                </label>
                {defaultStampDuty && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      value={stampDutyAmount}
                      onChange={(e) => setStampDutyAmount(Number(e.target.value))}
                      style={{ width: 90, textAlign: 'right' }}
                      min="0"
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-3, #64748B)' }}>DA</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Coordonnées Bancaires & Financières (MANDATORY) */}
        {currentStep === 3 && (
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3, #64748B)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Étape 3 sur 4
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                Coordonnées Bancaires & Détails Financiers
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3, #64748B)', marginTop: '0.25rem' }}>
                Indispensable pour votre première facture : vos clients doivent savoir où verser leurs règlements (par virement bancaire ou chèque).
              </p>
            </div>

            {/* Importance explanation banner */}
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 'var(--r-md, 10px)',
              padding: '0.9rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.82rem',
              color: '#166534',
            }}>
              <CreditCard size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Ces coordonnées apparaissent au bas de chaque facture émise.</strong> Elles permettent également d'automatiser le rapprochement des encaissements et la trésorerie.
              </div>
            </div>

            {/* Quick Bank Selection Pills */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Établissement bancaire ou CCP</span>
                <span className="badge-required">Obligatoire</span>
              </label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                marginBottom: '0.75rem',
              }}>
                {POPULAR_ALGERIAN_BANKS.map((b) => {
                  const isSelected = bankName.toLowerCase() === b.toLowerCase();
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBankName(b)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 'var(--r-full, 9999px)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: isSelected ? 'var(--text-1, #0F172A)' : 'var(--surface-2, #F4F4F5)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-2, #334155)',
                        border: `1px solid ${isSelected ? 'var(--text-1, #0F172A)' : 'var(--border, #E2E8F0)'}`,
                        cursor: 'pointer',
                        transition: 'var(--t-fast)',
                      }}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
              <input
                className={errors.bankName ? 'input-error' : ''}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Sélectionnez ci-dessus ou saisissez le nom de votre banque..."
              />
              {errors.bankName && <span className="error-message">{errors.bankName}</span>}
            </div>

            {/* Titulaire & RIB */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  <span>Titulaire du compte</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <input
                  className={errors.accountHolder ? 'input-error' : ''}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Ex: SARL Eventzone ou Mohamed Benali"
                />
                <span className="form-hint">Nom exact sur votre Relevé d'Identité Bancaire</span>
                {errors.accountHolder && <span className="error-message">{errors.accountHolder}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>RIB (Relevé d'Identité Bancaire)</span>
                  <span className="badge-required">Obligatoire</span>
                </label>
                <input
                  className={errors.rib ? 'input-error' : ''}
                  value={rib}
                  onChange={(e) => {
                    setRib(e.target.value);
                    if (!accountNumber) setAccountNumber(e.target.value);
                  }}
                  placeholder="Ex: 001 00234 1234567890 12 (20 chiffres) ou CCP"
                />
                <span className="form-hint">Code banque (3) + Agence (5) + N° compte (10) + Clé (2)</span>
                {errors.rib && <span className="error-message">{errors.rib}</span>}
              </div>
            </div>

            {/* Optional Financial Details */}
            <div style={{
              background: 'var(--surface, #FAFAFA)',
              borderRadius: 'var(--r-md, 10px)',
              border: '1px solid var(--border, #E2E8F0)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-2, #334155)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wallet size={15} />
                <span>Détails bancaires complémentaires & Trésorerie (Optionnel)</span>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <span>IBAN (si disponible)</span>
                    <span className="badge-optional">Optionnel</span>
                  </label>
                  <input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="Ex: DZ51 0010 0234 1234 5678 9012"
                  />
                  <span className="form-hint">Requis pour les virements transfrontaliers</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>Code SWIFT / BIC</span>
                    <span className="badge-optional">Optionnel</span>
                  </label>
                  <input
                    value={swift}
                    onChange={(e) => setSwift(e.target.value)}
                    placeholder="Ex: BNAADZALXXX"
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <span>Agence bancaire de domiciliation</span>
                    <span className="badge-optional">Optionnel</span>
                  </label>
                  <input
                    value={bankAddress}
                    onChange={(e) => setBankAddress(e.target.value)}
                    placeholder="Ex: Agence Didouche Mourad (Code 00140)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>Solde d'ouverture initial de trésorerie (DA)</span>
                    <span className="badge-optional">Optionnel</span>
                  </label>
                  <input
                    type="number"
                    value={openingBalance || ''}
                    onChange={(e) => setOpeningBalance(Math.max(0, Number(e.target.value)))}
                    placeholder="Ex: 500000"
                    min="0"
                  />
                  <span className="form-hint">Point de départ de calcul pour le module Trésorerie</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation & Lancement */}
        {currentStep === 4 && (
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Header / Celebration */}
            <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
              <div style={{
                background: 'var(--accent, #D4F252)',
                width: 56,
                height: 56,
                borderRadius: 'var(--r-md, 10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--text-1, #0F172A)',
                boxShadow: '0 4px 14px rgba(212,242,82,0.5)',
              }}>
                <Sparkles size={28} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                Votre profil financier est prêt !
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-3, #64748B)', maxWidth: '540px', margin: '0.45rem auto 0', lineHeight: 1.5 }}>
                Toutes les informations nécessaires à l'émission de factures valides et au suivi de vos paiements sont enregistrées.
              </p>
            </div>

            {/* Summary Review Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Identity Card */}
              <div style={{
                background: 'var(--surface, #FAFAFA)',
                border: '1px solid var(--border, #E2E8F0)',
                borderRadius: 'var(--r-md, 10px)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-2, #334155)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={15} />
                    <span>Identité & Fiscalité</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--r-full, 9999px)',
                    background: businessType === 'company' ? 'var(--text-1, #0F172A)' : 'var(--accent, #D4F252)',
                    color: businessType === 'company' ? '#FFFFFF' : 'var(--text-1, #0F172A)',
                  }}>
                    {businessType === 'company' ? 'Entreprise' : 'Auto-Entrepreneur'}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Raison / Nom : </span>
                    <strong style={{ color: 'var(--text-1, #0F172A)' }}>{company || name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Responsable : </span>
                    <span>{name}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Contact : </span>
                    <span>{phone} · {email}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Wilaya : </span>
                    <span>{wilaya}</span>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border, #E2E8F0)', paddingTop: '0.4rem' }}>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>NIF : </span>
                    <strong style={{ letterSpacing: '0.04em' }}>{nif}</strong>
                  </div>
                  {businessType === 'company' ? (
                    <div>
                      <span style={{ color: 'var(--text-4, #94A3B8)' }}>RC : </span>
                      <span>{rc}</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ color: 'var(--text-4, #94A3B8)' }}>N° C.A.E : </span>
                      <span>{cae}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial & Banking Card */}
              <div style={{
                background: 'var(--surface, #FAFAFA)',
                border: '1px solid var(--border, #E2E8F0)',
                borderRadius: 'var(--r-md, 10px)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-2, #334155)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Landmark size={15} />
                    <span>Détails Financiers & Banque</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--r-full, 9999px)',
                    background: '#ECFDF5',
                    color: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    <CheckCircle2 size={11} />
                    <span>Prêt</span>
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Établissement : </span>
                    <strong style={{ color: 'var(--text-1, #0F172A)' }}>{bankName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Titulaire : </span>
                    <span>{accountHolder}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>RIB / Compte : </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rib || accountNumber}</span>
                  </div>
                  {iban && (
                    <div>
                      <span style={{ color: 'var(--text-4, #94A3B8)' }}>IBAN : </span>
                      <span style={{ fontFamily: 'monospace' }}>{iban}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed var(--border, #E2E8F0)', paddingTop: '0.4rem' }}>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Devise : </span>
                    <span>{defaultCurrency}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-4, #94A3B8)' }}>Régime TVA : </span>
                    <span>{businessType === 'auto-entrepreneur' ? 'Exonéré (0% IFU)' : `${defaultTaxRate}%`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSaveAndComplete('first_invoice')}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(212,242,82,0.4)',
                }}
              >
                <Plus size={18} />
                <span>Créer ma première facture maintenant</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleSaveAndComplete('dashboard')}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <LayoutDashboard size={16} />
                <span>Accéder au tableau de bord</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons (Steps 1 to 3) */}
        {currentStep < 4 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.5rem',
          }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              style={{
                opacity: currentStep === 1 ? 0.35 : 1,
                cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                gap: '0.4rem',
              }}
            >
              <ArrowLeft size={16} />
              <span>Précédent</span>
            </button>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #64748B)' }}>
              Étape {currentStep} sur 4
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              style={{ gap: '0.4rem', padding: '0.65rem 1.4rem' }}
            >
              <span>Continuer</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* Global CSS helper styles for onboarding */}
      <style>{`
        .badge-required {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.12rem 0.4rem;
          border-radius: var(--r-full, 9999px);
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FCA5A5;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .badge-optional {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.12rem 0.4rem;
          border-radius: var(--r-full, 9999px);
          background: var(--surface-2, #F4F4F5);
          color: var(--text-4, #94A3B8);
          border: 1px solid var(--border, #E2E8F0);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .input-error {
          border-color: #EF4444 !important;
          background: #FFF5F5 !important;
        }
        .error-message {
          font-size: 0.72rem;
          color: #DC2626;
          font-weight: 500;
          margin-top: 0.2rem;
        }
        @media (max-width: 640px) {
          .no-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
