import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState, DocumentData, Client, BusinessProfile,
  LineItem, ClientInfo, InvoiceSettings, TabType, BankDetails, InvoiceStatus,
  Payment, CashFlowEntry, DocumentAttachment
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import {
  syncToSupabase, loadFromSupabase,
  deleteDocumentFromSupabase, deleteClientFromSupabase,
  deleteExpenseFromSupabase, deletePaymentFromSupabase,
  deleteCashFlowFromSupabase
} from '../lib/db';
import { calculateTotals } from '../utils/formatters';

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
  | { type: 'ADD_EXPENSE'; payload: any }
  | { type: 'UPDATE_EXPENSE'; payload: { id: string; expense: any } }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'UPDATE_TAX_SETTINGS'; payload: { profileId: string; settings: any } }
  | { type: 'SAVE_TAX_DECLARATION'; payload: any }
  | { type: 'ADD_PROFILE'; payload: BusinessProfile }
  | { type: 'UPDATE_PROFILE'; payload: { id: string; profile: Partial<BusinessProfile> } }
  | { type: 'DELETE_PROFILE'; payload: string }
  | { type: 'REORDER_PROFILES'; payload: BusinessProfile[] }
  | { type: 'SET_ACTIVE_PROFILE'; payload: string }
  | { type: 'START_NEW_DOCUMENT'; payload: { type: 'invoice' | 'quote' | 'proforma' | 'avoir', id: string, sourceDocumentId?: string } }
  | { type: 'CONVERT_QUOTE_TO_INVOICE'; payload: string }  // documentId of the quote/proforma
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'DELETE_PAYMENT'; payload: string }            // payment id
  | { type: 'ADD_CASHFLOW_ENTRY'; payload: CashFlowEntry }
  | { type: 'UPDATE_CASHFLOW_ENTRY'; payload: { id: string; entry: Partial<CashFlowEntry> } }
  | { type: 'DELETE_CASHFLOW_ENTRY'; payload: string }
  | { type: 'ADD_RELANCE'; payload: { documentId: string; level: 1 | 2 | 3; notes?: string; profileId: string } }
  | { type: 'ADD_DOCUMENT_ATTACHMENT'; payload: DocumentAttachment }
  | { type: 'DELETE_DOCUMENT_ATTACHMENT'; payload: { documentId: string; attachmentId: string } }
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
  openingBalance: 0,
});

const createNewDocument = (
  type: 'invoice' | 'quote' | 'proforma' | 'avoir',
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
    stampPlacement: {
      x: 550,
      y: 900,
      width: 150,
      height: 60,
      rotation: 0
    },
  },
});

const getInitialState = (): AppState => {
  const defaultProfile = createDefaultProfile();
  const yearYY = format(new Date(), 'yy');
  return {
    documents: [],
    clients: [],
    expenses: [],
    payments: [],
    cashFlow: [],
    taxSettings: {},
    taxDeclarations: [],
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
    activeTab: 'dashboard',
    currentDocument: createNewDocument('invoice', defaultProfile, `EZ-${yearYY}-0001`),
    editingDocumentId: null,
  };
};

const syncCurrentDoc = (state: AppState, updatedCurrentDoc: DocumentData): AppState => {
  const docExists = state.documents.some((d) => d.id === updatedCurrentDoc.id);
  const documents = docExists
    ? state.documents.map((d) => (d.id === updatedCurrentDoc.id ? updatedCurrentDoc : d))
    : state.documents;

  let clients = [...state.clients];
  const recipientName = updatedCurrentDoc.recipient.name.trim();
  if (recipientName && !state.clients.some((c) => c.name.toLowerCase() === recipientName.toLowerCase())) {
    clients.push({
      id: uuidv4(),
      name: updatedCurrentDoc.recipient.name,
      email: updatedCurrentDoc.recipient.email,
      company: updatedCurrentDoc.recipient.company,
      address: updatedCurrentDoc.recipient.address,
      phone: updatedCurrentDoc.recipient.phone || '',
      nif: updatedCurrentDoc.recipient.nif || '',
      nis: updatedCurrentDoc.recipient.nis || '',
      rc: updatedCurrentDoc.recipient.rc || '',
      art: updatedCurrentDoc.recipient.art || '',
    });
  }

  return { ...state, currentDocument: updatedCurrentDoc, documents, clients };
};

// Recompute invoice status based on payments received
const recomputeDocumentStatus = (state: AppState, documentId: string): AppState => {
  const doc = state.documents.find(d => d.id === documentId);
  if (!doc || doc.type === 'avoir' || doc.type === 'quote' || doc.type === 'proforma') return state;

  const docPayments = state.payments.filter(p => p.documentId === documentId);
  const totalPaid = docPayments.reduce((sum, p) => sum + p.amount, 0);
  
  const totals = calculateTotals(
    doc.items || [],
    doc.settings.taxRate || 0,
    doc.settings.discountType || 'percentage',
    doc.settings.discountValue || 0,
    doc.settings.applyStampDuty || false,
    doc.settings.stampDutyAmount || 0
  );
  const invoiceTotal = totals.total;

  let newStatus: InvoiceStatus = doc.status;
  if (totalPaid <= 0) {
    // Keep existing status (Sent, Draft, Overdue) — don't regress
    if (doc.status === 'Paid' || doc.status === 'Partial') {
      newStatus = 'Sent';
    }
  } else if (totalPaid >= invoiceTotal - 0.01) {
    newStatus = 'Paid';
  } else {
    newStatus = 'Partial';
  }

  return {
    ...state,
    documents: state.documents.map(d => d.id === documentId ? { ...d, status: newStatus } : d),
    currentDocument: state.currentDocument.id === documentId
      ? { ...state.currentDocument, status: newStatus }
      : state.currentDocument,
  };
};

const saveToLocalStorage = (state: AppState) => {
  try {
    localStorage.setItem('fawtara_dashboard_state', JSON.stringify(state));
  } catch (e) {}
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_CURRENT_DOCUMENT':
      return syncCurrentDoc(state, { ...state.currentDocument, ...action.payload });

    case 'UPDATE_CURRENT_SENDER':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        sender: { ...state.currentDocument.sender, ...action.payload },
      });

    case 'UPDATE_CURRENT_RECIPIENT':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        recipient: { ...state.currentDocument.recipient, ...action.payload },
      });

    case 'UPDATE_CURRENT_SETTINGS':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        settings: { ...state.currentDocument.settings, ...action.payload },
      });

    case 'ADD_CURRENT_ITEM':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        items: [
          ...state.currentDocument.items,
          { id: uuidv4(), description: '', quantity: 1, rate: 0, unit: 'pièce' },
        ],
      });

    case 'UPDATE_CURRENT_ITEM':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        items: state.currentDocument.items.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.item } : item
        ),
      });

    case 'REMOVE_CURRENT_ITEM':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        items: state.currentDocument.items.filter((item) => item.id !== action.payload),
      });

    case 'REORDER_CURRENT_ITEMS':
      return syncCurrentDoc(state, {
        ...state.currentDocument,
        items: action.payload,
      });

    case 'SAVE_DOCUMENT': {
      const docExists = state.documents.some((d) => d.id === state.currentDocument.id);
      const documents = docExists
        ? state.documents.map((d) => (d.id === state.currentDocument.id ? state.currentDocument : d))
        : [state.currentDocument, ...state.documents];
      const nextState = {
        ...state,
        documents,
        editingDocumentId: null,
        activeTab: 'dashboard' as TabType,
      };
      saveToLocalStorage(nextState);
      syncToSupabase(nextState).catch((e) => console.error('Immediate SAVE_DOCUMENT sync error:', e));
      return nextState;
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
      deleteDocumentFromSupabase(action.payload);
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.payload),
        payments: state.payments.filter((p) => p.documentId !== action.payload),
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
      deleteClientFromSupabase(action.payload);
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.payload),
      };

    case 'ADD_PROFILE': {
      const newProfile: BusinessProfile = action.payload;
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
      if (state.profiles.length <= 1) return state;
      const remaining = state.profiles.filter((p) => p.id !== action.payload);
      return {
        ...state,
        profiles: remaining,
        activeProfileId:
          state.activeProfileId === action.payload ? remaining[0].id : state.activeProfileId,
      };
    }

    case 'REORDER_PROFILES':
      return {
        ...state,
        profiles: action.payload,
        activeProfileId: action.payload[0]?.id || state.activeProfileId,
      };

    case 'SET_ACTIVE_PROFILE':
      return {
        ...state,
        activeProfileId: action.payload,
      };

    case 'START_NEW_DOCUMENT': {
      const type = action.payload.type;
      const newId = action.payload.id;
      const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];

      let docNumber: string;
      const yearYY = format(new Date(), 'yy');

      if (type === 'avoir') {
        const avoirCount = state.documents.filter((d) => d.type === 'avoir').length + 1;
        docNumber = `AV-${yearYY}-${String(avoirCount).padStart(4, '0')}`;
      } else {
        const count = state.documents.filter((d) => d.type === type).length + 1;
        docNumber = `EZ-${yearYY}-${String(count).padStart(4, '0')}`;
      }

      let baseDoc = createNewDocument(type, activeProfile, docNumber);

      // If creating an avoir from a source invoice, pre-fill from it
      if (type === 'avoir' && action.payload.sourceDocumentId) {
        const sourceDoc = state.documents.find(d => d.id === action.payload.sourceDocumentId);
        if (sourceDoc) {
          baseDoc = {
            ...baseDoc,
            recipient: { ...sourceDoc.recipient },
            items: sourceDoc.items.map(item => ({ ...item, id: uuidv4() })),
            settings: { ...sourceDoc.settings, profileId: activeProfile.id },
            sourceDocumentId: action.payload.sourceDocumentId,
            notes: `Avoir sur facture N° ${sourceDoc.invoiceNumber}`,
          };
          // Mark source document as cancelled
          return syncCurrentDoc({
            ...state,
            editingDocumentId: newId,
            activeTab: 'builder',
            documents: state.documents.map(d =>
              d.id === action.payload.sourceDocumentId
                ? { ...d, linkedAvoirId: newId, status: 'Cancelled' }
                : d
            ),
          }, { ...baseDoc, id: newId });
        }
      }

      const newDoc = { ...baseDoc, id: newId };
      return syncCurrentDoc({
        ...state,
        editingDocumentId: newId,
        activeTab: 'builder',
      }, newDoc);
    }

    case 'CONVERT_QUOTE_TO_INVOICE': {
      const sourceDoc = state.documents.find(d => d.id === action.payload);
      if (!sourceDoc) return state;
      const yearYY = format(new Date(), 'yy');
      const invoiceCount = state.documents.filter(d => d.type === 'invoice').length + 1;
      const newInvoiceNumber = `EZ-${yearYY}-${String(invoiceCount).padStart(4, '0')}`;
      const newId = uuidv4();
      const newInvoice: DocumentData = {
        ...sourceDoc,
        id: newId,
        type: 'invoice',
        invoiceNumber: newInvoiceNumber,
        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'Draft',
        sourceDocumentId: sourceDoc.id,
        items: sourceDoc.items.map(item => ({ ...item, id: uuidv4() })),
      };
      return syncCurrentDoc({
        ...state,
        editingDocumentId: newId,
        activeTab: 'builder',
        // Mark original as 'Sent' (accepted quote)
        documents: state.documents.map(d =>
          d.id === action.payload ? { ...d, status: 'Sent' as InvoiceStatus } : d
        ),
      }, newInvoice);
    }

    // ─── Payments ────────────────────────────────────────────────────────────
    case 'ADD_PAYMENT': {
      const nextState = {
        ...state,
        payments: [action.payload, ...state.payments],
      };
      const withStatus = recomputeDocumentStatus(nextState, action.payload.documentId);
      saveToLocalStorage(withStatus);
      return withStatus;
    }

    case 'DELETE_PAYMENT': {
      deletePaymentFromSupabase(action.payload);
      const payment = state.payments.find(p => p.id === action.payload);
      const nextState = {
        ...state,
        payments: state.payments.filter(p => p.id !== action.payload),
      };
      const withStatus = payment
        ? recomputeDocumentStatus(nextState, payment.documentId)
        : nextState;
      saveToLocalStorage(withStatus);
      return withStatus;
    }

    // ─── Cash Flow ────────────────────────────────────────────────────────────
    case 'ADD_CASHFLOW_ENTRY': {
      const nextState = {
        ...state,
        cashFlow: [action.payload, ...state.cashFlow],
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'UPDATE_CASHFLOW_ENTRY': {
      const nextState = {
        ...state,
        cashFlow: state.cashFlow.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload.entry } : e
        ),
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'DELETE_CASHFLOW_ENTRY': {
      deleteCashFlowFromSupabase(action.payload);
      const nextState = {
        ...state,
        cashFlow: state.cashFlow.filter(e => e.id !== action.payload),
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    // ─── Attachments ──────────────────────────────────────────────────────────
    case 'ADD_DOCUMENT_ATTACHMENT': {
      const attachment = action.payload;
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === attachment.documentId
            ? { ...d, attachments: [attachment, ...(d.attachments || [])] }
            : d
        ),
        currentDocument: state.currentDocument.id === attachment.documentId
          ? { ...state.currentDocument, attachments: [attachment, ...(state.currentDocument.attachments || [])] }
          : state.currentDocument,
      };
    }

    case 'DELETE_DOCUMENT_ATTACHMENT': {
      const { documentId, attachmentId } = action.payload;
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === documentId
            ? { ...d, attachments: (d.attachments || []).filter(a => a.id !== attachmentId) }
            : d
        ),
        currentDocument: state.currentDocument.id === documentId
          ? { ...state.currentDocument, attachments: (state.currentDocument.attachments || []).filter(a => a.id !== attachmentId) }
          : state.currentDocument,
      };
    }

    // ─── Relances ─────────────────────────────────────────────────────────────
    case 'ADD_RELANCE': {
      const { documentId, level, notes, profileId } = action.payload;
      const relance = {
        id: uuidv4(),
        documentId,
        profileId,
        date: format(new Date(), 'yyyy-MM-dd'),
        level,
        notes,
      };
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === documentId
            ? { ...d, relances: [...(d.relances || []), relance] }
            : d
        ),
      };
    }

    case 'ADD_EXPENSE': {
      const nextState = {
        ...state,
        expenses: [action.payload, ...state.expenses],
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'UPDATE_EXPENSE': {
      const nextState = {
        ...state,
        expenses: state.expenses.map((exp) =>
          exp.id === action.payload.id ? { ...exp, ...action.payload.expense } : exp
        ),
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'DELETE_EXPENSE': {
      deleteExpenseFromSupabase(action.payload);
      const nextState = {
        ...state,
        expenses: state.expenses.filter((exp) => exp.id !== action.payload),
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'UPDATE_TAX_SETTINGS': {
      const nextState = {
        ...state,
        taxSettings: {
          ...state.taxSettings,
          [action.payload.profileId]: {
            ...(state.taxSettings[action.payload.profileId] || {}),
            ...action.payload.settings,
          },
        },
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'SAVE_TAX_DECLARATION': {
      const nextState = {
        ...state,
        taxDeclarations: [action.payload, ...state.taxDeclarations],
      };
      saveToLocalStorage(nextState);
      return nextState;
    }

    case 'LOAD_STATE': {
      const loaded = action.payload as any;
      const initial = getInitialState();

      if (!loaded.profiles) {
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
          expenses: loaded.expenses || [],
          payments: loaded.payments || [],
          cashFlow: loaded.cashFlow || [],
          taxSettings: loaded.taxSettings || {},
          taxDeclarations: loaded.taxDeclarations || [],
          profiles: [migratedProfile],
          activeProfileId: migratedProfile.id,
        };
      }

      // ─── Cloud is the single source of truth ─────────────────────────────────
      // We no longer merge with localStorage to prevent stale local data from
      // overriding real cloud data and causing different numbers per device.
      const mergedProfiles: BusinessProfile[] = loaded.profiles?.length > 0 ? loaded.profiles : initial.profiles;
      const activeProfileId: string = loaded.activeProfileId || mergedProfiles[0]?.id || initial.activeProfileId;
      const activeProfile = mergedProfiles.find(p => p.id === activeProfileId) || mergedProfiles[0];

      const docs: DocumentData[] = loaded.documents || [];
      const clients: Client[] = loaded.clients || [];
      const expenses: any[] = loaded.expenses || [];
      const payments: any[] = loaded.payments || [];
      const cashFlow: any[] = loaded.cashFlow || [];
      const taxSettings: any = loaded.taxSettings || {};
      const taxDeclarations: any[] = loaded.taxDeclarations || [];

      const nextCount = docs.filter((d: DocumentData) => d.type === 'invoice').length + 1;
      const yearYY = format(new Date(), 'yy');
      const freshDoc = createNewDocument('invoice', activeProfile, `EZ-${yearYY}-${String(nextCount).padStart(4, '0')}`);

      return {
        ...initial,
        documents: docs,
        clients: clients,
        expenses: expenses,
        payments: payments,
        cashFlow: cashFlow,
        taxSettings: taxSettings,
        taxDeclarations: taxDeclarations,
        profiles: mergedProfiles,
        activeProfileId,
        activeTab: 'dashboard',
        editingDocumentId: null,
        currentDocument: freshDoc,
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
  isLoaded: boolean;
}

const InvoiceContext = createContext<InvoiceContextProps | undefined>(undefined);

export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  const [isLoaded, setIsLoaded] = useState(false);
  // Track whether the initial load just happened, so we don't immediately
  // sync the just-loaded Supabase data right back to Supabase (wasted call + race).
  const justLoadedRef = React.useRef(false);

  // ── Load from Supabase (with localStorage fallback & line-item merge) ─────
  useEffect(() => {
    const initializeData = async () => {
      let localSaved: AppState | null = null;
      try {
        const savedRaw = localStorage.getItem('fawtara_dashboard_state');
        if (savedRaw) {
          localSaved = JSON.parse(savedRaw);
        }
      } catch (e) {
        console.error('Failed to parse localStorage state:', e);
      }

      try {
        // Always try Supabase first — it's the primary source of truth
        const cloudData = await loadFromSupabase();
        if (cloudData && cloudData.profiles && cloudData.profiles.length > 0) {
          let finalData: AppState = { ...(cloudData as AppState) };

          // Merge safety: If localStorage has local documents with MORE items or unsynced edits,
          // merge them so newly added articles are NEVER discarded on refresh!
          if (localSaved && localSaved.documents && Array.isArray(localSaved.documents)) {
            const mergedDocs = finalData.documents.map((cloudDoc) => {
              const localDoc = localSaved!.documents.find((d) => d.id === cloudDoc.id);
              if (localDoc && (localDoc.items?.length || 0) > (cloudDoc.items?.length || 0)) {
                return { ...cloudDoc, items: localDoc.items };
              }
              return cloudDoc;
            });

            // Also check for local docs saved locally but not yet in cloud
            const missingLocalDocs = localSaved.documents.filter(
              (localDoc) => !finalData.documents.some((d) => d.id === localDoc.id)
            );

            finalData.documents = [...mergedDocs, ...missingLocalDocs];

            // Preserve active working draft / editing session if present
            if (localSaved.editingDocumentId && localSaved.currentDocument) {
              finalData.editingDocumentId = localSaved.editingDocumentId;
              finalData.currentDocument = localSaved.currentDocument;
            }
          }

          justLoadedRef.current = true;
          dispatch({ type: 'LOAD_STATE', payload: finalData });
          setIsLoaded(true);

          // Push merged data to Supabase if any local additions existed
          syncToSupabase(finalData).catch(e => console.error('Post-load sync error:', e));
          return;
        }
      } catch (e) {
        console.error('Supabase load failed, falling back to localStorage:', e);
      }

      // Fallback: use localStorage only if Supabase is unreachable
      if (localSaved) {
        justLoadedRef.current = true;
        dispatch({ type: 'LOAD_STATE', payload: localSaved });
      }
      setIsLoaded(true);
    };
    initializeData();
  }, []);

  // ── Always persist to localStorage on any state change ────────────────
  useEffect(() => {
    if (!isLoaded) return;
    saveToLocalStorage(state);
  }, [state, isLoaded]);

  // ── Sync to Supabase (fast 300ms debounce) ───────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    // Skip the very first state change after LOAD_STATE if no merged changes
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      syncToSupabase(state).catch(e => console.error('Supabase sync failed', e));
      window.dispatchEvent(new Event('invoice_saved'));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [state, isLoaded]);

  const activeProfile =
    state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];

  return (
    <InvoiceContext.Provider value={{ state, dispatch, activeProfile, isLoaded }}>
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
