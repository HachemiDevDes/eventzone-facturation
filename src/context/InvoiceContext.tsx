import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState, DocumentData, Client, BusinessProfile,
  LineItem, ClientInfo, InvoiceSettings, TabType, BankDetails, InvoiceStatus
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import { syncToSupabase, loadFromSupabase } from '../lib/db';

type Action =
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_CURRENT_DOCUMENT'; payload: Partial<DocumentData> }
  | { type: 'UPDATE_CURRENT_SENDER'; payload: Partial<ClientInfo> }
  | { type: 'UPDATE_CURRENT_RECIPIENT'; payload: Partial<ClientInfo> }
  | { type: 'UPDATE_CURRENT_SETTINGS'; payload: Partial<InvoiceSettings> }
  | { type: 'ADD_CURRENT_ITEM' }
  | { type: 'UPDATE_CURRENT_ITEM'; payload: { id: string; item: Partial<LineItem> } }
  | { type: 'REMOVE_CURRENT_ITEM'; payload: string }
  | { type: 'REORDER_CURRENT_ITEMS'; payload: LineItem[] }
  | { type: 'SAVE_DOCUMENT' }
  | { type: 'EDIT_DOCUMENT'; payload: string }
  | { type: 'UPDATE_DOCUMENT_STATUS'; payload: { id: string; status: InvoiceStatus } }
  | { type: 'DELETE_DOCUMENT'; payload: string }
  | { type: 'ADD_CLIENT'; payload: Omit<Client, 'id'> }
  | { type: 'UPDATE_CLIENT'; payload: { id: string; client: Partial<Client> } }
  | { type: 'DELETE_CLIENT'; payload: string }
  | { type: 'ADD_PROFILE'; payload: Omit<BusinessProfile, 'id'> }
  | { type: 'UPDATE_PROFILE'; payload: { id: string; profile: Partial<BusinessProfile> } }
  | { type: 'DELETE_PROFILE'; payload: string }
  | { type: 'SET_ACTIVE_PROFILE'; payload: string }
  | { type: 'START_NEW_DOCUMENT'; payload: 'invoice' | 'quote' | 'proforma' }
  | { type: 'LOAD_STATE'; payload: AppState };

const defaultBankDetails: BankDetails = {
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  iban: '',
  swift: '',
  rib: '',
  bankAddress: '',
};

const createDefaultProfile = (): BusinessProfile => ({
  id: uuidv4(),
  profileName: 'Mon Entreprise',
  businessType: 'company',
  name: '',
  email: '',
  phone: '',
  address: '',
  wilaya: 'Alger',
  company: '',
  logo: null,
  stamp: null,
  nif: '',
  nis: '',
  rc: '',
  art: '',
  cae: '',
  activity: '',
  bankDetails: [{ ...defaultBankDetails }],
  defaultCurrency: 'DZD',
  defaultTaxRate: 19,
  defaultStampDuty: true,
  stampDutyAmount: 1000,
});

const createNewDocument = (
  type: 'invoice' | 'quote' | 'proforma',
  profile: BusinessProfile,
  invoiceNumber: string
): DocumentData => ({
  id: uuidv4(),
  type,
  invoiceNumber,
  date: format(new Date(), 'yyyy-MM-dd'),
  dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  status: 'Draft',
  paymentTerm: 'Net 30',
  logo: profile.logo,
  stamp: profile.stamp,
  sender: {
    name: profile.name,
    email: profile.email,
    company: profile.company,
    address: profile.address + (profile.wilaya ? `, ${profile.wilaya}` : ''),
    phone: profile.phone,
    nif: profile.nif,
    nis: profile.nis,
    rc: profile.rc,
    art: profile.art,
    cae: profile.cae,
  },
  senderBankDetails: profile.bankDetails[0],
  recipient: {
    name: '',
    email: '',
    company: '',
    address: '',
    phone: '',
    nif: '',
    nis: '',
    rc: '',
    art: '',
    cae: '',
  },
  items: [{ id: uuidv4(), description: '', quantity: 1, rate: 0, unit: 'pièce' }],
  notes: '',
  settings: {
    currency: profile.defaultCurrency,
    // Auto-entrepreneurs are under IFU regime: exempt from TVA
    taxRate: profile.businessType === 'auto-entrepreneur' ? 0 : profile.defaultTaxRate,
    applyStampDuty: profile.defaultStampDuty,
    stampDutyAmount: profile.stampDutyAmount,
    discountType: 'percentage',
    discountValue: 0,
    showStamp: false,
    profileId: profile.id,
  },
});

const getInitialState = (): AppState => {
  const defaultProfile = createDefaultProfile();
  return {
    documents: [],
    clients: [],
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
    activeTab: 'dashboard',
    currentDocument: createNewDocument('invoice', defaultProfile, 'FAC-0001'),
    editingDocumentId: null,
  };
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_CURRENT_DOCUMENT':
      return {
        ...state,
        currentDocument: { ...state.currentDocument, ...action.payload },
      };

    case 'UPDATE_CURRENT_SENDER':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          sender: { ...state.currentDocument.sender, ...action.payload },
        },
      };

    case 'UPDATE_CURRENT_RECIPIENT':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          recipient: { ...state.currentDocument.recipient, ...action.payload },
        },
      };

    case 'UPDATE_CURRENT_SETTINGS':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          settings: { ...state.currentDocument.settings, ...action.payload },
        },
      };

    case 'ADD_CURRENT_ITEM':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          items: [
            ...state.currentDocument.items,
            { id: uuidv4(), description: '', quantity: 1, rate: 0, unit: 'pièce' },
          ],
        },
      };

    case 'UPDATE_CURRENT_ITEM':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          items: state.currentDocument.items.map((item) =>
            item.id === action.payload.id ? { ...item, ...action.payload.item } : item
          ),
        },
      };

    case 'REMOVE_CURRENT_ITEM':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          items: state.currentDocument.items.filter((item) => item.id !== action.payload),
        },
      };

    case 'REORDER_CURRENT_ITEMS':
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          items: action.payload,
        },
      };

    case 'SAVE_DOCUMENT': {
      const docExists = state.documents.some((d) => d.id === state.currentDocument.id);
      let updatedDocs;
      if (docExists) {
        updatedDocs = state.documents.map((d) =>
          d.id === state.currentDocument.id ? state.currentDocument : d
        );
      } else {
        updatedDocs = [state.currentDocument, ...state.documents];
      }

      // Automatically add recipient to client list if not exists
      let updatedClients = [...state.clients];
      const recipientName = state.currentDocument.recipient.name.trim();
      if (recipientName && !state.clients.some((c) => c.name.toLowerCase() === recipientName.toLowerCase())) {
        updatedClients.push({
          id: uuidv4(),
          name: state.currentDocument.recipient.name,
          email: state.currentDocument.recipient.email,
          company: state.currentDocument.recipient.company,
          address: state.currentDocument.recipient.address,
          phone: state.currentDocument.recipient.phone || '',
          nif: state.currentDocument.recipient.nif || '',
          nis: state.currentDocument.recipient.nis || '',
          rc: state.currentDocument.recipient.rc || '',
          art: state.currentDocument.recipient.art || '',
        });
      }

      return {
        ...state,
        documents: updatedDocs,
        clients: updatedClients,
        editingDocumentId: null,
        activeTab: 'dashboard',
      };
    }

    case 'EDIT_DOCUMENT': {
      const doc = state.documents.find((d) => d.id === action.payload);
      if (!doc) return state;
      return {
        ...state,
        currentDocument: { ...doc },
        editingDocumentId: doc.id,
        activeTab: 'builder',
      };
    }

    case 'DELETE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.payload),
      };

    case 'UPDATE_DOCUMENT_STATUS':
      return {
        ...state,
        documents: state.documents.map((d) =>
          d.id === action.payload.id ? { ...d, status: action.payload.status } : d
        ),
      };

    case 'ADD_CLIENT': {
      const newClient: Client = {
        id: uuidv4(),
        ...action.payload,
      };
      return {
        ...state,
        clients: [...state.clients, newClient],
      };
    }

    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.client } : c
        ),
      };

    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.payload),
      };

    case 'ADD_PROFILE': {
      const newProfile: BusinessProfile = {
        id: uuidv4(),
        ...action.payload,
      };
      return {
        ...state,
        profiles: [...state.profiles, newProfile],
        activeProfileId: newProfile.id,
      };
    }

    case 'UPDATE_PROFILE': {
      const existingProfile = state.profiles.find(p => p.id === action.payload.id);
      if (!existingProfile) return state;
      const updatedProfile: BusinessProfile = { ...existingProfile, ...action.payload.profile } as BusinessProfile;
      return {
        ...state,
        profiles: state.profiles.map((p) =>
          p.id === action.payload.id ? updatedProfile : p
        ),
        // Sync the current document if it's a Draft and we're updating the active profile
        currentDocument: (state.activeProfileId === action.payload.id && state.currentDocument.status === 'Draft')
          ? {
              ...state.currentDocument,
              logo: updatedProfile.logo,
              sender: {
                name: updatedProfile.name,
                email: updatedProfile.email,
                company: updatedProfile.company,
                address: updatedProfile.address + (updatedProfile.wilaya ? `, ${updatedProfile.wilaya}` : ''),
                phone: updatedProfile.phone,
                nif: updatedProfile.nif,
                nis: updatedProfile.nis,
                rc: updatedProfile.rc,
                art: updatedProfile.art,
                cae: updatedProfile.cae,
              },
              senderBankDetails: updatedProfile.bankDetails[0],
            }
          : state.currentDocument
      };
    }

    case 'DELETE_PROFILE': {
      if (state.profiles.length <= 1) return state; // Can't delete last profile
      const remaining = state.profiles.filter((p) => p.id !== action.payload);
      return {
        ...state,
        profiles: remaining,
        activeProfileId:
          state.activeProfileId === action.payload ? remaining[0].id : state.activeProfileId,
      };
    }

    case 'SET_ACTIVE_PROFILE':
      return {
        ...state,
        activeProfileId: action.payload,
      };

    case 'START_NEW_DOCUMENT': {
      const type = action.payload;
      const count = state.documents.filter((d) => d.type === type).length + 1;
      const prefix = type === 'invoice' ? 'FAC' : type === 'quote' ? 'DEV' : 'PRO';
      const docNumber = `${prefix}-${String(count).padStart(4, '0')}`;
      const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
      return {
        ...state,
        currentDocument: createNewDocument(type, activeProfile, docNumber),
        editingDocumentId: null,
        activeTab: 'builder',
      };
    }

    case 'LOAD_STATE': {
      // Migrate old state shape if needed (e.g. old companyProfile)
      const loaded = action.payload as any;
      const initial = getInitialState();

      if (!loaded.profiles) {
        // Migrate from old single-profile shape
        const migratedProfile = createDefaultProfile();
        if (loaded.companyProfile) {
          Object.assign(migratedProfile, {
            name: loaded.companyProfile.name || '',
            email: loaded.companyProfile.email || '',
            company: loaded.companyProfile.company || '',
            address: loaded.companyProfile.address || '',
            logo: loaded.companyProfile.logo || null,
          });
        }
        return {
          ...initial,
          documents: loaded.documents || [],
          clients: loaded.clients || [],
          profiles: [migratedProfile],
          activeProfileId: migratedProfile.id,
        };
      }

      // Always merge with initial state so required fields are never undefined.
      // loadFromSupabase() returns only a Partial<AppState> — without activeTab,
      // currentDocument or editingDocumentId — so we must never use it as full state.
      const mergedProfiles: BusinessProfile[] = loaded.profiles?.length > 0 ? loaded.profiles : initial.profiles;
      const activeProfileId: string = loaded.activeProfileId || mergedProfiles[0]?.id || initial.activeProfileId;
      const activeProfile = mergedProfiles.find(p => p.id === activeProfileId) || mergedProfiles[0];
      // Merge documents by ID to prevent data loss.
      // If Supabase sync is failing, local state (state.documents) is newer.
      const cloudDocs: DocumentData[] = loaded.documents || [];
      const localDocs = state.documents || [];
      
      const mergedDocsMap = new Map();
      cloudDocs.forEach(d => mergedDocsMap.set(d.id, d));
      localDocs.forEach(d => mergedDocsMap.set(d.id, d)); // Local overrides cloud
      
      const docs: DocumentData[] = Array.from(mergedDocsMap.values());

      // Merge clients similarly
      const cloudClients = loaded.clients || [];
      const localClients = state.clients || [];
      const mergedClientsMap = new Map();
      cloudClients.forEach((c: Client) => mergedClientsMap.set(c.id, c));
      localClients.forEach((c: Client) => mergedClientsMap.set(c.id, c));
      const clients = Array.from(mergedClientsMap.values());
      // Build a fresh currentDocument from the active profile
      const nextCount = docs.filter((d: DocumentData) => d.type === 'invoice').length + 1;
      const freshDoc = createNewDocument('invoice', activeProfile, `FAC-${String(nextCount).padStart(4, '0')}`);

      return {
        ...initial,
        documents: docs,
        clients: clients,
        profiles: mergedProfiles,
        activeProfileId,
        activeTab: 'dashboard',
        editingDocumentId: null,
        currentDocument: loaded.currentDocument || freshDoc,
      };
    }

    default:
      return state;
  }
};

interface InvoiceContextProps {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  activeProfile: BusinessProfile;
}

const InvoiceContext = createContext<InvoiceContextProps | undefined>(undefined);

export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  const [isLoaded, setIsLoaded] = useState(false);

  // Load state on mount.
  // Strategy: localStorage-first (instant, no crash risk), then Supabase in background.
  useEffect(() => {
    const initializeData = async () => {
      // 1. Load from localStorage immediately — this always has a valid full AppState.
      const saved = localStorage.getItem('fawtara_dashboard_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        } catch (e) {
          console.error('Failed to parse localStorage state', e);
        }
      }

      // 2. Try to load from Supabase in background and merge if we get more documents.
      try {
        const cloudData = await loadFromSupabase();
        if (cloudData && cloudData.documents && cloudData.documents.length > 0) {
          // Cloud has documents — merge them into state.
          // We dispatch LOAD_STATE which now safely merges with getInitialState().
          dispatch({ type: 'LOAD_STATE', payload: cloudData as AppState });
        } else if (!saved) {
          // No local data AND no cloud data — just set isLoaded (use default state).
        }
      } catch (e) {
        console.error('Supabase load failed (using localStorage):', e);
      } finally {
        setIsLoaded(true);
      }
    };
    initializeData();
  }, []);

  // Autosave
  useEffect(() => {
    if (!isLoaded) return; // Wait until initial load is finished

    // Save to local storage INSTANTLY so no data is ever lost on quick refreshes
    try {
      localStorage.setItem('fawtara_dashboard_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }

    // Debounce the Supabase network sync
    const timeoutId = setTimeout(() => {
      syncToSupabase(state).catch(e => console.error('Supabase sync failed', e));
      window.dispatchEvent(new Event('invoice_saved'));
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [state, isLoaded]);

  const activeProfile =
    state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];

  return (
    <InvoiceContext.Provider value={{ state, dispatch, activeProfile }}>
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoice = () => {
  const context = useContext(InvoiceContext);
  if (context === undefined) {
    throw new Error('useInvoice must be used within an InvoiceProvider');
  }
  return context;
};
