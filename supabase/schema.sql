-- ============================================================================
-- FAWTARA BILLING & FACTURATION SCHEMA FOR SUPABASE
-- Compatible with PostgreSQL 15+ / Supabase
-- ============================================================================

-- 1. PROFILES (Business / Organization Billing Profiles)
-- Extend existing public.profiles if it already exists:
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS profile_name text,
  ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS wilaya text,
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS stamp text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS nis text,
  ADD COLUMN IF NOT EXISTS rc text,
  ADD COLUMN IF NOT EXISTS art text,
  ADD COLUMN IF NOT EXISTS cae text,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'DZD',
  ADD COLUMN IF NOT EXISTS default_tax_rate numeric DEFAULT 19,
  ADD COLUMN IF NOT EXISTS default_stamp_duty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stamp_duty_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Create table if it doesn't exist:
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text,
  business_type text DEFAULT 'company',
  name text,
  email text,
  phone text,
  address text,
  wilaya text,
  company text,
  logo text,
  stamp text,
  nif text,
  nis text,
  rc text,
  art text,
  cae text,
  activity text,
  default_currency text DEFAULT 'DZD',
  default_tax_rate numeric DEFAULT 19,
  default_stamp_duty boolean DEFAULT false,
  stamp_duty_amount numeric DEFAULT 0,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. BANK DETAILS
CREATE TABLE IF NOT EXISTS public.bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name text,
  account_holder text,
  account_number text,
  iban text,
  swift text,
  rib text,
  bank_address text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_details_profile_id ON public.bank_details(profile_id);
CREATE INDEX IF NOT EXISTS idx_bank_details_user_id ON public.bank_details(user_id);

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  company text,
  nif text,
  nis text,
  rc text,
  art text,
  cae text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- 4. DOCUMENTS (Invoices, Quotes, Proformas, Avoirs)
CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY,
  type text NOT NULL, -- 'invoice' | 'quote' | 'proforma' | 'avoir'
  invoice_number text NOT NULL,
  date text NOT NULL,
  due_date text NOT NULL,
  status text NOT NULL DEFAULT 'Draft', -- 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partial' | 'Cancelled'
  payment_term text DEFAULT 'Net 30',
  logo text,
  stamp text,
  sender jsonb DEFAULT '{}'::jsonb,
  sender_bank_details jsonb DEFAULT '{}'::jsonb,
  recipient jsonb DEFAULT '{}'::jsonb,
  notes text,
  settings jsonb DEFAULT '{}'::jsonb,
  source_document_id text,
  linked_avoir_id text,
  relances jsonb DEFAULT '[]'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON public.documents(date);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_document_id ON public.documents(source_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_linked_avoir_id ON public.documents(linked_avoir_id);

-- 5. LINE ITEMS
CREATE TABLE IF NOT EXISTS public.line_items (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'U',
  tax_rate numeric DEFAULT 19,
  position integer DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_line_items_document_id ON public.line_items(document_id);
CREATE INDEX IF NOT EXISTS idx_line_items_user_id ON public.line_items(user_id);

-- 6. EXPENSES (Achats & Dépenses)
CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  category text NOT NULL,
  date text NOT NULL,
  invoice_number text,
  amount_ht numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 19,
  amount_tva numeric NOT NULL DEFAULT 0,
  amount_ttc numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'Virement',
  status text DEFAULT 'Paid',
  attachment_name text,
  attachment_url text,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_profile_id ON public.expenses(profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);

-- 7. PAYMENTS (Encaissements / Règlements)
CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  document_id text REFERENCES public.documents(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  date text,
  amount numeric NOT NULL DEFAULT 0,
  method text DEFAULT 'Virement',
  reference text,
  notes text,
  attachment_name text,
  attachment_url text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_document_id ON public.payments(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_profile_id ON public.payments(profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- 8. CASH FLOW (Trésorerie & Flux manuels)
CREATE TABLE IF NOT EXISTS public.cash_flow (
  id text PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  date text NOT NULL,
  type text NOT NULL, -- 'in' | 'out'
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  bank_account_label text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_flow_profile_id ON public.cash_flow(profile_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON public.cash_flow(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_user_id ON public.cash_flow(user_id);

-- 9. TAX SETTINGS
CREATE TABLE IF NOT EXISTS public.tax_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_settings_user_id ON public.tax_settings(user_id);

-- 10. TAX DECLARATIONS (Historique des déclarations G50, IBS, etc.)
CREATE TABLE IF NOT EXISTS public.tax_declarations (
  id text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period text NOT NULL,
  period_type text NOT NULL,
  tva_collected numeric DEFAULT 0,
  tva_deductible numeric DEFAULT 0,
  tva_payable numeric DEFAULT 0,
  tva_credit numeric DEFAULT 0,
  estimated_ibs numeric DEFAULT 0,
  irg_amount numeric DEFAULT 0,
  casnos_amount numeric DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_profile_id ON public.tax_declarations(profile_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_user_id ON public.tax_declarations(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_auth_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_policy" ON public.profiles;
CREATE POLICY "profiles_authenticated_policy" ON public.profiles FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "profiles_anon_policy" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Bank Details
DROP POLICY IF EXISTS "Users can manage their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_auth_all" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_anon_all" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_authenticated_policy" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_anon_policy" ON public.bank_details;
CREATE POLICY "bank_details_authenticated_policy" ON public.bank_details FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "bank_details_anon_policy" ON public.bank_details FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. Clients
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "clients_auth_all" ON public.clients;
DROP POLICY IF EXISTS "clients_anon_all" ON public.clients;
DROP POLICY IF EXISTS "clients_authenticated_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_anon_policy" ON public.clients;
CREATE POLICY "clients_authenticated_policy" ON public.clients FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "clients_anon_policy" ON public.clients FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Documents
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
DROP POLICY IF EXISTS "documents_auth_all" ON public.documents;
DROP POLICY IF EXISTS "documents_anon_all" ON public.documents;
DROP POLICY IF EXISTS "documents_authenticated_policy" ON public.documents;
DROP POLICY IF EXISTS "documents_anon_policy" ON public.documents;
CREATE POLICY "documents_authenticated_policy" ON public.documents FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "documents_anon_policy" ON public.documents FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Line Items
DROP POLICY IF EXISTS "Users can manage their own line items" ON public.line_items;
DROP POLICY IF EXISTS "line_items_auth_all" ON public.line_items;
DROP POLICY IF EXISTS "line_items_anon_all" ON public.line_items;
DROP POLICY IF EXISTS "line_items_authenticated_policy" ON public.line_items;
DROP POLICY IF EXISTS "line_items_anon_policy" ON public.line_items;
CREATE POLICY "line_items_authenticated_policy" ON public.line_items FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "line_items_anon_policy" ON public.line_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. Expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_auth_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_anon_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_authenticated_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_anon_policy" ON public.expenses;
CREATE POLICY "expenses_authenticated_policy" ON public.expenses FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "expenses_anon_policy" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);

-- 7. Payments
DROP POLICY IF EXISTS "Users can manage their own payments" ON public.payments;
DROP POLICY IF EXISTS "payments_auth_all" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_all" ON public.payments;
DROP POLICY IF EXISTS "payments_authenticated_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_policy" ON public.payments;
CREATE POLICY "payments_authenticated_policy" ON public.payments FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "payments_anon_policy" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- 8. Cash Flow
DROP POLICY IF EXISTS "Users can manage their own cash_flow" ON public.cash_flow;
DROP POLICY IF EXISTS "cash_flow_auth_all" ON public.cash_flow;
DROP POLICY IF EXISTS "cash_flow_anon_all" ON public.cash_flow;
DROP POLICY IF EXISTS "cash_flow_authenticated_policy" ON public.cash_flow;
DROP POLICY IF EXISTS "cash_flow_anon_policy" ON public.cash_flow;
CREATE POLICY "cash_flow_authenticated_policy" ON public.cash_flow FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "cash_flow_anon_policy" ON public.cash_flow FOR ALL TO anon USING (true) WITH CHECK (true);

-- 9. Tax Settings
DROP POLICY IF EXISTS "Users can manage their own tax_settings" ON public.tax_settings;
DROP POLICY IF EXISTS "tax_settings_auth_all" ON public.tax_settings;
DROP POLICY IF EXISTS "tax_settings_anon_all" ON public.tax_settings;
DROP POLICY IF EXISTS "tax_settings_authenticated_policy" ON public.tax_settings;
DROP POLICY IF EXISTS "tax_settings_anon_policy" ON public.tax_settings;
CREATE POLICY "tax_settings_authenticated_policy" ON public.tax_settings FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "tax_settings_anon_policy" ON public.tax_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 10. Tax Declarations
DROP POLICY IF EXISTS "Users can manage their own tax_declarations" ON public.tax_declarations;
DROP POLICY IF EXISTS "tax_declarations_auth_all" ON public.tax_declarations;
DROP POLICY IF EXISTS "tax_declarations_anon_all" ON public.tax_declarations;
DROP POLICY IF EXISTS "tax_declarations_authenticated_policy" ON public.tax_declarations;
DROP POLICY IF EXISTS "tax_declarations_anon_policy" ON public.tax_declarations;
CREATE POLICY "tax_declarations_authenticated_policy" ON public.tax_declarations FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "tax_declarations_anon_policy" ON public.tax_declarations FOR ALL TO anon USING (true) WITH CHECK (true);

