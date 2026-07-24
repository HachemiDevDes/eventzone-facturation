export type Currency = 'DZD' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'MAD' | 'TND';
export type DocumentType = 'invoice' | 'quote' | 'proforma' | 'avoir';
export type PaymentTerm = 'Due on receipt' | 'Net 15' | 'Net 30' | 'Net 60' | 'Custom';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partial' | 'Cancelled';
export type TabType = 'dashboard' | 'builder' | 'clients' | 'achats' | 'taxes' | 'tresorerie' | 'settings';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';
export type PaymentMethod = 'Espèces' | 'Virement' | 'Chèque' | 'Carte';

// ─── Payment (Encaissement tracé sur une facture) ─────────────────────────────
export interface Payment {
  id: string;
  documentId: string;    // linked invoice id
  profileId: string;
  date: string;          // ISO date string
  amount: number;        // DZD amount received
  method: PaymentMethod;
  reference?: string;    // Cheque number, virement ref, etc.
  notes?: string;
}

// ─── Cash Flow Entry (Flux de trésorerie manuel) ─────────────────────────────
export interface CashFlowEntry {
  id: string;
  profileId: string;
  date: string;
  type: 'in' | 'out';
  category: string;      // Salaires, Loyer, Banque, etc.
  description: string;
  amount: number;
  bankAccountLabel?: string;
}

// ─── Relance (Historique de relances client) ──────────────────────────────────
export interface Relance {
  id: string;
  documentId: string;
  profileId: string;
  date: string;
  level: 1 | 2 | 3;     // 1=1ère relance, 2=2ème, 3=Mise en demeure
  notes?: string;
}

export interface Expense {
  id: string;
  profileId: string;
  supplier: string;
  category: string;
  date: string;
  invoiceNumber: string;
  amountHT: number;
  taxRate: number; // 0, 9, 19
  amountTVA: number;
  amountTTC: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  attachmentName?: string;
  attachmentUrl?: string; // base64 or file URL
  notes?: string;
}

export interface TaxSettings {
  tvaRegime: 'encaissements' | 'debits'; // Encaissements (on payment) vs Débits (on invoice emission)
  g50Periodicity: 'monthly' | 'quarterly';
  ibsRate: 19 | 23 | 26; // 19% (Production/BTP), 23% (Services/Default), 26% (Import-revente)
  isStartupLabelActive: boolean;
  startupLabelExpiryDate?: string;
  managerMonthlySalary: number; // For IRG calculation
  casnosDeclaredAmount: number; // Annual/Quarterly CASNOS declaration amount
  nonDeductibleCharges: number; // Charges réintégrées pour IBS
  customCategories: string[];
}

export interface TaxDeclaration {
  id: string;
  profileId: string;
  period: string; // e.g. "2026-07" or "2026-Q3"
  periodType: 'monthly' | 'quarterly' | 'yearly';
  tvaCollected: number;
  tvaDeductible: number;
  tvaPayable: number;
  tvaCredit: number;
  estimatedIBS: number;
  irgAmount: number;
  casnosAmount: number;
  createdAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  unit?: string;           // Unit of measure (pièce, heure, kg, etc.)
  taxRate?: number;        // Per-line tax rate override
}

export interface ClientInfo {
  name: string;
  email: string;
  address: string;
  company: string;
  phone?: string;
  nif?: string;            // Numéro d'Identification Fiscale
  nis?: string;            // Numéro d'Identification Statistique
  rc?: string;             // Registre de Commerce
  art?: string;            // Article d'Imposition
  cae?: string;            // Carte d'Auto-Entrepreneur (N°C.A.E)
}

export interface Client extends ClientInfo {
  id: string;
}

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string;           // Some Algerian banks provide IBAN
  swift?: string;
  rib?: string;            // Relevé d'Identité Bancaire (Algeria specific)
  bankAddress?: string;
}

export type BusinessType = 'auto-entrepreneur' | 'company';

export interface BusinessProfile {
  id: string;
  profileName: string;     // e.g. "Main Business", "Freelance"
  businessType: BusinessType; // 'auto-entrepreneur' | 'company'
  name: string;            // Owner/contact name
  email: string;
  phone: string;
  address: string;
  wilaya: string;          // Wilaya (Algerian province)
  company: string;         // Trade name / Nom commercial
  logo: string | null;
  stamp: string | null;
  // Algerian Business Registration Fields
  nif: string;             // Numéro d'Identification Fiscale (19 digits)
  nis: string;             // Numéro d'Identification Statistique
  rc: string;              // Registre de Commerce (e.g. 16/00-12345B26)
  art: string;             // Article d'Imposition — companies only
  cae: string;             // Carte d'Auto-Entrepreneur (N°C.A.E) — auto-entrepreneurs only
  activity: string;        // Business activity description
  // Bank Details
  bankDetails: BankDetails[];
  // Default Invoice Settings
  defaultCurrency: Currency;
  defaultTaxRate: number;  // TVA rate (0, 9, 19 %)
  defaultStampDuty: boolean; // Droit de timbre
  stampDutyAmount: number;   // Fixed stamp duty amount in DZD
  // Opening bank balance for cash flow
  openingBalance?: number;
}

export interface StampPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface InvoiceSettings {
  currency: Currency;
  taxRate: number;         // TVA percentage (0, 9, or 19%)
  applyStampDuty: boolean;
  stampDutyAmount: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  showStamp: boolean;
  profileId: string;       // Which business profile to use
  stampPlacement?: StampPlacement;
}

export interface DocumentData {
  id: string;
  type: DocumentType;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentTerm: PaymentTerm;
  logo: string | null;
  stamp: string | null;
  sender: ClientInfo;
  senderBankDetails?: BankDetails;
  recipient: ClientInfo;
  items: LineItem[];
  notes: string;
  settings: InvoiceSettings;
  // Avoir / linking fields
  sourceDocumentId?: string;  // For avoirs: the invoice being credited
  linkedAvoirId?: string;     // For invoices: the avoir that cancelled it
  // Relances history
  relances?: Relance[];
}

export interface AppState {
  documents: DocumentData[];
  clients: Client[];
  expenses: Expense[];
  payments: Payment[];           // NEW: encaissements tracés
  cashFlow: CashFlowEntry[];     // NEW: flux de trésorerie manuels
  taxSettings: Record<string, TaxSettings>; // keyed by profileId
  taxDeclarations: TaxDeclaration[];
  profiles: BusinessProfile[];         // Array of business profiles
  activeProfileId: string;             // ID of currently active profile
  activeTab: TabType;
  currentDocument: DocumentData;
  editingDocumentId: string | null;
}

// Algerian Wilayas
export const ALGERIA_WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
  'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
  'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
] as const;

// Algerian TVA (VAT) rates
export const ALGERIA_TVA_RATES = [
  { label: 'Exonéré (0%)', value: 0 },
  { label: 'Réduit (9%)', value: 9 },
  { label: 'Normal (19%)', value: 19 },
];

// Currency display map
export const CURRENCY_INFO: Record<Currency, { symbol: string; name: string; locale: string }> = {
  DZD: { symbol: 'DA', name: 'Dinar Algérien', locale: 'ar-DZ' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'fr-FR' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  MAD: { symbol: 'DH', name: 'Dirham Marocain', locale: 'fr-MA' },
  TND: { symbol: 'DT', name: 'Dinar Tunisien', locale: 'fr-TN' },
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Fournitures de bureau',
  'Prestations de service',
  'Matériel technique/événementiel',
  'Location de salle/matériel',
  'Marketing & publicité',
  'Abonnements logiciels',
  'Transport & déplacement',
  'Sous-traitance',
  'Autre',
];

export const CASHFLOW_CATEGORIES_IN = [
  'Encaissement client',
  'Subvention / Aide',
  'Remboursement',
  'Apport en capital',
  'Autre entrée',
];

export const CASHFLOW_CATEGORIES_OUT = [
  'Loyer',
  'Salaires',
  'Charges sociales (CNAS/CASNOS)',
  'Impôts & taxes',
  'Fournisseurs',
  'Transport & déplacement',
  'Marketing & publicité',
  'Équipement & matériel',
  'Sous-traitance',
  'Frais bancaires',
  'Autre sortie',
];

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  tvaRegime: 'encaissements',
  g50Periodicity: 'monthly',
  ibsRate: 23,
  isStartupLabelActive: false,
  managerMonthlySalary: 0,
  casnosDeclaredAmount: 0,
  nonDeductibleCharges: 0,
  customCategories: DEFAULT_EXPENSE_CATEGORIES,
};
