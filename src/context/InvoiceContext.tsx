import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState, DocumentData, Client, BusinessProfile,
  LineItem, ClientInfo, InvoiceSettings, TabType, BankDetails, InvoiceStatus,
  Payment, CashFlowEntry
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
  | { type: 'ADD_EXPENSE'; payload: any }
  | { type: 'UPDATE_EXPENSE'; payload: { id: string; expense: any } }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'UPDATE_TAX_SETTINGS'; payload: { profileId: string; settings: any } }
  | { type: 'SAVE_TAX_DECLARATION'; payload: any }
  | { type: 'ADD_PROFILE'; payload: BusinessProfile }
  | { type: 'UPDATE_PROFILE'; payload: { id: string; profile: Partial<BusinessProfile> } }
  | { type: 'DELETE_PROFILE'; payload: string }
  | { type: 'SET_ACTIVE_PROFILE'; payload: string }
  | { type: 'START_NEW_DOCUMENT'; payload: { type: 'invoice' | 'quote' | 'proforma' | 'avoir', id: string, sourceDocumentId?: string } }
  | { type: 'CONVERT_QUOTE_TO_INVOICE'; payload: string }  // documentId of the quote/proforma
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'DELETE_PAYMENT'; payload: string }            // payment id
  | { type: 'ADD_CASHFLOW_ENTRY'; payload: CashFlowEntry }
  | { type: 'UPDATE_CASHFLOW_ENTRY'; payload: { id: string; entry: Partial<CashFlowEntry> } }
  | { type: 'DELETE_CASHFLOW_ENTRY'; payload: string }
  | { type: 'ADD_RELANCE'; payload: { documentId: string; level: 1 | 2 | 3; notes?: string; profileId: string } }
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
    : [updatedCurrentDoc, ...state.documents];

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
  
  // Calculate invoice total
  const subtotal = doc.items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const discountAmt = doc.settings.discountType === 'percentage'
    ? subtotal * (doc.settings.discountValue / 100)
    : doc.settings.discountValue;
  const taxableAmt = Math.max(0, subtotal - discountAmt);
  const tvaAmt = taxableAmt * ((doc.settings.taxRate || 0) / 100);
  const stampDuty = doc.settings.applyStampDuty ? (doc.settings.stampDutyAmount || 0) : 0;
  const invoiceTotal = taxableAmt + tvaAmt + stampDuty;

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
      return {
        ...state,
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
      const nextState = {
        ...state,
        cashFlow: state.cashFlow.filter(e => e.id !== action.payload),
      };
      saveToLocalStorage(nextState);
      return nextState;
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

      const mergedProfiles: BusinessProfile[] = loaded.profiles?.length > 0 ? loaded.profiles : initial.profiles;
      const activeProfileId: string = loaded.activeProfileId || mergedProfiles[0]?.id || initial.activeProfileId;
      const activeProfile = mergedProfiles.find(p => p.id === activeProfileId) || mergedProfiles[0];
      
      const cloudDocs: DocumentData[] = loaded.documents || [];
      const localDocs = state.documents || [];
      const mergedDocsMap = new Map();
      cloudDocs.forEach(d => mergedDocsMap.set(d.id, d));
      localDocs.forEach(d => mergedDocsMap.set(d.id, d));
      const docs: DocumentData[] = Array.from(mergedDocsMap.values());

      const cloudClients = loaded.clients || [];
      const localClients = state.clients || [];
      const mergedClientsMap = new Map();
      cloudClients.forEach((c: Client) => mergedClientsMap.set(c.id, c));
      localClients.forEach((c: Client) => mergedClientsMap.set(c.id, c));
      const clients = Array.from(mergedClientsMap.values());

      // Backup from localStorage
      let backupExpenses: any[] = [];
      let backupTaxSettings: any = {};
      let backupTaxDeclarations: any[] = [];
      let backupPayments: any[] = [];
      let backupCashFlow: any[] = [];
      try {
        const savedStr = localStorage.getItem('fawtara_dashboard_state');
        if (savedStr) {
          const parsed = JSON.parse(savedStr);
          if (parsed.expenses) backupExpenses = parsed.expenses;
          if (parsed.taxSettings) backupTaxSettings = parsed.taxSettings;
          if (parsed.taxDeclarations) backupTaxDeclarations = parsed.taxDeclarations;
          if (parsed.payments) backupPayments = parsed.payments;
          if (parsed.cashFlow) backupCashFlow = parsed.cashFlow;
        }
      } catch (e) {}

      // Merge expenses
      const cloudExpenses = loaded.expenses || [];
      const localExpenses = state.expenses || [];
      const mergedExpensesMap = new Map();
      backupExpenses.forEach((e: any) => mergedExpensesMap.set(e.id, e));
      localExpenses.forEach((e: any) => mergedExpensesMap.set(e.id, e));
      cloudExpenses.forEach((e: any) => mergedExpensesMap.set(e.id, e));
      const expenses = Array.from(mergedExpensesMap.values());

      // Merge payments
      const cloudPayments = loaded.payments || [];
      const localPayments = state.payments || [];
      const mergedPaymentsMap = new Map();
      backupPayments.forEach((p: any) => mergedPaymentsMap.set(p.id, p));
      localPayments.forEach((p: any) => mergedPaymentsMap.set(p.id, p));
      cloudPayments.forEach((p: any) => mergedPaymentsMap.set(p.id, p));
      const payments = Array.from(mergedPaymentsMap.values());

      // Merge cash flow entries
      const cloudCashFlow = loaded.cashFlow || [];
      const localCashFlow = state.cashFlow || [];
      const mergedCFMap = new Map();
      backupCashFlow.forEach((e: any) => mergedCFMap.set(e.id, e));
      localCashFlow.forEach((e: any) => mergedCFMap.set(e.id, e));
      cloudCashFlow.forEach((e: any) => mergedCFMap.set(e.id, e));
      const cashFlow = Array.from(mergedCFMap.values());

      const taxSettings = {
        ...backupTaxSettings,
        ...(state.taxSettings || {}),
        ...(loaded.taxSettings || {}),
      };

      const cloudTaxDecs = loaded.taxDeclarations || [];
      const localTaxDecs = state.taxDeclarations || [];
      const mergedTaxDecsMap = new Map();
      backupTaxDeclarations.forEach((d: any) => mergedTaxDecsMap.set(d.id, d));
      localTaxDecs.forEach((d: any) => mergedTaxDecsMap.set(d.id, d));
      cloudTaxDecs.forEach((d: any) => mergedTaxDecsMap.set(d.id, d));
      const taxDeclarations = Array.from(mergedTaxDecsMap.values());

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
  isLoaded: boolean;
}

const InvoiceContext = createContext<InvoiceContextProps | undefined>(undefined);

export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      const saved = localStorage.getItem('fawtara_dashboard_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        } catch (e) {
          console.error('Failed to parse localStorage state', e);
        }
      }

      try {
        const cloudData = await loadFromSupabase();
        if (cloudData && cloudData.documents && cloudData.documents.length > 0) {
          dispatch({ type: 'LOAD_STATE', payload: cloudData as AppState });
        }
      } catch (e) {
        console.error('Supabase load failed (using localStorage):', e);
      } finally {
        setIsLoaded(true);
      }
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('fawtara_dashboard_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
    const timeoutId = setTimeout(() => {
      syncToSupabase(state).catch(e => console.error('Supabase sync failed', e));
      window.dispatchEvent(new Event('invoice_saved'));
    }, 1000);
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
