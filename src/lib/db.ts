import { supabase } from './supabase';
import type { AppState, BusinessProfile, Client, DocumentData, Expense, Payment, CashFlowEntry } from '../types';

// Helper to dispatch sync errors to the UI
const notifyError = (table: string, err: any) => {
  console.error(`Error syncing ${table}:`, err);
  window.dispatchEvent(new CustomEvent('sync_error', { 
    detail: `Erreur ${table}: ${err.message || JSON.stringify(err)}` 
  }));
};

const notifyLog = (message: string) => {
  console.log('Sync:', message);
  window.dispatchEvent(new CustomEvent('sync_log', { detail: message }));
};

// ─── Atomic Entity Sync Functions ───────────────────────────────────────────

export const saveProfileToSupabase = async (profile: BusinessProfile, position: number = 0) => {
  const { bankDetails, ...profileData } = profile;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error: pErr } = await supabase.from('profiles').upsert({
    id: profileData.id,
    profile_name: profileData.profileName,
    business_type: profileData.businessType,
    name: profileData.name,
    email: profileData.email,
    phone: profileData.phone,
    address: profileData.address,
    wilaya: profileData.wilaya,
    company: profileData.company,
    logo: profileData.logo,
    stamp: profileData.stamp,
    nif: profileData.nif,
    nis: profileData.nis,
    rc: profileData.rc,
    art: profileData.art,
    cae: profileData.cae,
    activity: profileData.activity,
    default_currency: profileData.defaultCurrency,
    default_tax_rate: profileData.defaultTaxRate,
    default_stamp_duty: profileData.defaultStampDuty,
    stamp_duty_amount: profileData.stampDutyAmount,
    position,
    ...(userId ? { user_id: userId } : {}),
  });

  if (pErr) {
    notifyError('profiles', pErr);
    return;
  }

  await supabase.from('bank_details').delete().eq('profile_id', profileData.id);
  const bank = bankDetails[0];
  if (bank) {
    const { error: bErr } = await supabase.from('bank_details').insert({
      profile_id: profileData.id,
      bank_name: bank.bankName,
      account_holder: bank.accountHolder,
      account_number: bank.accountNumber,
      iban: bank.iban,
      swift: bank.swift,
      rib: bank.rib,
      bank_address: bank.bankAddress,
      ...(userId ? { user_id: userId } : {}),
    });
    if (bErr) notifyError('bank_details', bErr);
  }
};

export const saveClientToSupabase = async (client: Client) => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error } = await supabase.from('clients').upsert({
    id: client.id,
    name: client.name,
    email: client.email,
    address: client.address,
    company: client.company,
    phone: client.phone,
    nif: client.nif,
    nis: client.nis,
    rc: client.rc,
    art: client.art,
    cae: client.cae,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) notifyError('clients', error);
};

export const saveDocumentToSupabase = async (doc: DocumentData) => {
  const { items, ...docData } = doc;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error: dErr } = await supabase.from('documents').upsert({
    id: docData.id,
    type: docData.type,
    invoice_number: docData.invoiceNumber,
    date: docData.date,
    due_date: docData.dueDate,
    status: docData.status,
    payment_term: docData.paymentTerm,
    logo: docData.logo,
    stamp: docData.stamp,
    sender: docData.sender,
    sender_bank_details: docData.senderBankDetails,
    recipient: docData.recipient,
    notes: docData.notes,
    settings: docData.settings,
    source_document_id: docData.sourceDocumentId || null,
    linked_avoir_id: docData.linkedAvoirId || null,
    relances: docData.relances || [],
    attachments: docData.attachments || [],
    ...(userId ? { user_id: userId } : {})
  });

  if (dErr) {
    notifyError('documents', dErr);
    return;
  }

  // Sync line items: delete old ones and insert new ones
  await supabase.from('line_items').delete().eq('document_id', doc.id);
  if (items && items.length > 0) {
    const { error: iErr } = await supabase.from('line_items').insert(
      items.map((item, index) => ({
        id: item.id,
        document_id: doc.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        unit: item.unit,
        tax_rate: item.taxRate,
        position: index,
        ...(userId ? { user_id: userId } : {}),
      }))
    );
    if (iErr) notifyError('line_items', iErr);
  }
};

export const saveExpenseToSupabase = async (exp: Expense) => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error } = await supabase.from('expenses').upsert({
    id: exp.id,
    profile_id: exp.profileId,
    supplier: exp.supplier,
    category: exp.category,
    date: exp.date,
    invoice_number: exp.invoiceNumber,
    amount_ht: exp.amountHT,
    tax_rate: exp.taxRate,
    amount_tva: exp.amountTVA,
    amount_ttc: exp.amountTTC,
    payment_method: exp.paymentMethod,
    status: exp.status,
    attachment_name: exp.attachmentName || null,
    attachment_url: exp.attachmentUrl || null,
    notes: exp.notes || null,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) console.warn('Supabase Expense sync warning:', error.message);
};

export const savePaymentToSupabase = async (payment: Payment) => {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const userId = authSession?.user?.id;
  const { error } = await supabase.from('payments').upsert({
    id: payment.id,
    document_id: payment.documentId,
    profile_id: payment.profileId,
    date: payment.date,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference || null,
    notes: payment.notes || null,
    attachment_name: payment.attachmentName || null,
    attachment_url: payment.attachmentUrl || null,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) console.warn('Supabase Payment sync warning:', error.message);
};

export const saveCashFlowToSupabase = async (entry: CashFlowEntry) => {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const userId = authSession?.user?.id;
  const { error } = await supabase.from('cash_flow').upsert({
    id: entry.id,
    profile_id: entry.profileId,
    date: entry.date,
    type: entry.type,
    category: entry.category,
    description: entry.description,
    amount: entry.amount,
    bank_account_label: entry.bankAccountLabel || null,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) console.warn('Supabase CashFlow sync warning:', error.message);
};

export const saveTaxSettingsToSupabase = async (profileId: string, settings: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error } = await supabase.from('tax_settings').upsert({
    profile_id: profileId,
    settings: settings,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) console.warn('Supabase TaxSettings sync warning:', error.message);
};

export const saveTaxDeclarationToSupabase = async (decl: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const { error } = await supabase.from('tax_declarations').upsert({
    id: decl.id,
    profile_id: decl.profileId,
    period: decl.period,
    period_type: decl.periodType,
    tva_collected: decl.tvaCollected,
    tva_deductible: decl.tvaDeductible,
    tva_payable: decl.tvaPayable,
    tva_credit: decl.tvaCredit,
    estimated_ibs: decl.estimatedIBS,
    irg_amount: decl.irgAmount,
    casnos_amount: decl.casnosAmount,
    created_at: decl.createdAt,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) console.warn('Supabase TaxDeclaration sync warning:', error.message);
};

// ─── Batched Full State Sync ───────────────────────────────────────────────

export const syncToSupabase = async (state: AppState) => {
  notifyLog('Démarrage de la synchronisation optimisée...');

  try {
    // 1. Sync Profiles in parallel
    await Promise.all(state.profiles.map((profile, idx) => saveProfileToSupabase(profile, idx)));

    // 2. Sync Clients in parallel
    await Promise.all(state.clients.map((client) => saveClientToSupabase(client)));

    // 3. Sync Documents in parallel chunks
    await Promise.all(state.documents.map((doc) => saveDocumentToSupabase(doc)));

    // 4. Sync Expenses in parallel
    if (state.expenses && state.expenses.length > 0) {
      await Promise.all(state.expenses.map((exp) => saveExpenseToSupabase(exp)));
    }

    // 5. Sync Payments in parallel
    if (state.payments && state.payments.length > 0) {
      await Promise.all(state.payments.map((payment) => savePaymentToSupabase(payment)));
    }

    // 6. Sync Cash Flow in parallel
    if (state.cashFlow && state.cashFlow.length > 0) {
      await Promise.all(state.cashFlow.map((entry) => saveCashFlowToSupabase(entry)));
    }

    // 7. Sync Tax Settings & Declarations
    if (state.taxSettings) {
      await Promise.all(
        Object.entries(state.taxSettings).map(([profileId, settings]) =>
          saveTaxSettingsToSupabase(profileId, settings)
        )
      );
    }

    if (state.taxDeclarations && state.taxDeclarations.length > 0) {
      await Promise.all(state.taxDeclarations.map((decl) => saveTaxDeclarationToSupabase(decl)));
    }

    notifyLog('Synchronisation terminée avec succès.');
  } catch (err) {
    console.error('Erreur globale syncToSupabase:', err);
  }
};

export const deleteDocumentFromSupabase = async (id: string) => {
  try {
    await supabase.from('line_items').delete().eq('document_id', id);
    await supabase.from('payments').delete().eq('document_id', id);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) notifyError('documents (delete)', error);
  } catch (e) {
    console.error('deleteDocumentFromSupabase error:', e);
  }
};

export const deleteClientFromSupabase = async (id: string) => {
  try {
    await supabase.from('clients').delete().eq('id', id);
  } catch (e) {
    console.error('deleteClientFromSupabase error:', e);
  }
};

export const deleteExpenseFromSupabase = async (id: string) => {
  try {
    await supabase.from('expenses').delete().eq('id', id);
  } catch (e) {
    console.error('deleteExpenseFromSupabase error:', e);
  }
};

export const deletePaymentFromSupabase = async (id: string) => {
  try {
    await supabase.from('payments').delete().eq('id', id);
  } catch (e) {
    console.error('deletePaymentFromSupabase error:', e);
  }
};

export const deleteCashFlowFromSupabase = async (id: string) => {
  try {
    await supabase.from('cash_flow').delete().eq('id', id);
  } catch (e) {
    console.error('deleteCashFlowFromSupabase error:', e);
  }
};

export const loadFromSupabase = async (): Promise<Partial<AppState> | null> => {
  try {
    const [
      { data: profilesData, error: profilesErr },
      { data: clientsData, error: clientsErr },
      { data: expData, error: expErr },
      { data: payData, error: payErr },
      { data: cfData, error: cfErr },
      { data: tsData, error: tsErr },
      { data: tdData, error: tdErr },
      joinedDocsResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, bank_details(*)')
        .order('position', { ascending: true, nullsFirst: false }),
      supabase.from('clients').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('cash_flow').select('*'),
      supabase.from('tax_settings').select('*'),
      supabase.from('tax_declarations').select('*'),
      supabase.from('documents').select('*, line_items(*)'),
    ]);

    if (profilesErr) console.error('Supabase Profiles Error:', profilesErr);
    if (clientsErr) console.error('Supabase Clients Error:', clientsErr);
    if (expErr) console.warn('Supabase Expenses Error:', expErr);
    if (payErr) console.warn('Supabase Payments Error:', payErr);
    if (cfErr) console.warn('Supabase CashFlow Error:', cfErr);
    if (tsErr) console.warn('Supabase TaxSettings Error:', tsErr);
    if (tdErr) console.warn('Supabase TaxDeclarations Error:', tdErr);

    let docsData: any[] | null = null;
    if (joinedDocsResult.error) {
      console.error('Supabase Documents Join Error (falling back to separate queries):', joinedDocsResult.error);
      const [rawDocsRes, allItemsRes] = await Promise.all([
        supabase.from('documents').select('*'),
        supabase.from('line_items').select('*'),
      ]);
      if (rawDocsRes.data) {
        docsData = rawDocsRes.data.map((d) => ({
          ...d,
          line_items: allItemsRes.data ? allItemsRes.data.filter((i) => i.document_id === d.id) : [],
        }));
      }
    } else {
      docsData = joinedDocsResult.data;
    }

    if (!profilesData || profilesData.length === 0) {
      return null; // Database is empty
    }

  const profiles: BusinessProfile[] = profilesData.map((p: any) => ({
    id: p.id,
    profileName: p.profile_name,
    businessType: p.business_type,
    name: p.name,
    email: p.email,
    phone: p.phone,
    address: p.address,
    wilaya: p.wilaya,
    company: p.company,
    logo: p.logo,
    stamp: p.stamp,
    nif: p.nif,
    nis: p.nis,
    rc: p.rc,
    art: p.art,
    cae: p.cae,
    activity: p.activity,
    defaultCurrency: p.default_currency,
    defaultTaxRate: p.default_tax_rate,
    defaultStampDuty: p.default_stamp_duty,
    stampDutyAmount: p.stamp_duty_amount,
    bankDetails: (p.bank_details || []).map((b: any) => ({
      bankName: b.bank_name,
      accountHolder: b.account_holder,
      accountNumber: b.account_number,
      iban: b.iban,
      swift: b.swift,
      rib: b.rib,
      bankAddress: b.bank_address
    }))
  }));

  const clients: Client[] = (clientsData || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    address: c.address,
    company: c.company,
    phone: c.phone,
    nif: c.nif,
    nis: c.nis,
    rc: c.rc,
    art: c.art,
    cae: c.cae
  }));

  const cloudExpenses: Expense[] = (expData || []).map((e: any) => ({
    id: e.id,
    profileId: e.profile_id,
    supplier: e.supplier,
    category: e.category,
    date: e.date,
    invoiceNumber: e.invoice_number,
    amountHT: Number(e.amount_ht) || 0,
    taxRate: Number(e.tax_rate) || 0,
    amountTVA: Number(e.amount_tva) || 0,
    amountTTC: Number(e.amount_ttc) || 0,
    paymentMethod: e.payment_method,
    status: e.status,
    attachmentName: e.attachment_name,
    attachmentUrl: e.attachment_url,
    notes: e.notes,
  }));

  const cloudPayments: Payment[] = (payData || []).map((p: any) => ({
    id: p.id,
    documentId: p.document_id,
    profileId: p.profile_id,
    date: p.date,
    amount: Number(p.amount) || 0,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    attachmentName: p.attachment_name,
    attachmentUrl: p.attachment_url,
  }));

  const cloudCashFlow: CashFlowEntry[] = (cfData || []).map((e: any) => ({
    id: e.id,
    profileId: e.profile_id,
    date: e.date,
    type: e.type,
    category: e.category,
    description: e.description,
    amount: Number(e.amount) || 0,
    bankAccountLabel: e.bank_account_label,
  }));

  const cloudTaxSettings: Record<string, any> = {};
  (tsData || []).forEach((row: any) => {
    cloudTaxSettings[row.profile_id] = row.settings;
  });

  const cloudTaxDeclarations: any[] = (tdData || []).map((d: any) => ({
    id: d.id,
    profileId: d.profile_id,
    period: d.period,
    periodType: d.period_type,
    tvaCollected: Number(d.tva_collected) || 0,
    tvaDeductible: Number(d.tva_deductible) || 0,
    tvaPayable: Number(d.tva_payable) || 0,
    tvaCredit: Number(d.tva_credit) || 0,
    estimatedIBS: Number(d.estimated_ibs) || 0,
    irgAmount: Number(d.irg_amount) || 0,
    casnosAmount: Number(d.casnos_amount) || 0,
    createdAt: d.created_at,
  }));

  const documents: DocumentData[] = (docsData || []).map((d: any) => ({
    id: d.id,
    type: d.type,
    invoiceNumber: d.invoice_number,
    date: d.date,
    dueDate: d.due_date,
    status: d.status,
    paymentTerm: d.payment_term,
    logo: d.logo,
    stamp: d.stamp,
    sender: d.sender,
    senderBankDetails: d.sender_bank_details,
    recipient: d.recipient,
    notes: d.notes,
    settings: d.settings,
    sourceDocumentId: d.source_document_id || undefined,
    linkedAvoirId: d.linked_avoir_id || undefined,
    relances: d.relances || [],
    attachments: d.attachments || [],
    items: (d.line_items || []).sort((a: any, b: any) => a.position - b.position).map((i: any) => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity) || 0,
      rate: Number(i.rate) || 0,
      unit: i.unit,
      taxRate: i.tax_rate != null ? Number(i.tax_rate) : undefined
    }))
  }));

  // Cloud is the single source of truth — return everything from Supabase
  return {
    profiles,
    clients,
    documents,
    expenses: cloudExpenses,
    payments: cloudPayments,
    cashFlow: cloudCashFlow,
    taxSettings: cloudTaxSettings,
    taxDeclarations: cloudTaxDeclarations,
    activeProfileId: profiles[0]?.id
  };
  } catch (err) {
    console.error('Erreur loadFromSupabase:', err);
    return null;
  }
};

