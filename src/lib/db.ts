import { supabase } from './supabase';
import type { AppState, BusinessProfile, Client, DocumentData } from '../types';

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

// Convert AppState to Supabase tables & local backup
export const syncToSupabase = async (state: AppState) => {
  notifyLog('Démarrage de la synchronisation...');
  
  // 1. Sync Profiles
  for (const profile of state.profiles) {
    const { bankDetails, ...profileData } = profile;
    notifyLog(`Upsert profile: ${profileData.id}`);
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
      stamp_duty_amount: profileData.stampDutyAmount
    });

    if (pErr) notifyError('profiles', pErr);

    if (!pErr) {
      // Prevent duplication bug: delete old bank details before inserting the new one
      const { error: delBankErr } = await supabase.from('bank_details').delete().eq('profile_id', profileData.id);
      if (delBankErr) notifyError('bank_details (delete)', delBankErr);
      
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
          bank_address: bank.bankAddress
        });
        if (bErr) notifyError('bank_details', bErr);
      }
    }
  }

  // 2. Sync Clients
  for (const client of state.clients) {
    notifyLog(`Upsert client: ${client.id}`);
    const { error: cErr } = await supabase.from('clients').upsert({
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
      cae: client.cae
    });
    if (cErr) notifyError('clients', cErr);
  }

  // 3. Sync Documents
  for (const doc of state.documents) {
    const { items, ...docData } = doc;
    notifyLog(`Upsert document: ${docData.invoiceNumber} (${docData.id})`);
    
    const { data: { session } } = await supabase.auth.getSession();
    
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
      ...(session?.user?.id ? { user_id: session.user.id } : {})
    });
    
    if (dErr) notifyError('documents', dErr);
    else notifyLog(`Document ${docData.invoiceNumber} success!`);

    // Sync Line Items
    if (!dErr) {
      notifyLog(`Deleting old line_items for doc ${doc.id}`);
      const { error: delErr } = await supabase.from('line_items').delete().eq('document_id', doc.id);
      if (delErr) notifyError('line_items (delete)', delErr);

      if (items.length > 0) {
        notifyLog(`Inserting ${items.length} line_items for doc ${doc.id}`);
        const { error: iErr } = await supabase.from('line_items').insert(
          items.map((item, index) => ({
            id: item.id,
            document_id: doc.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            unit: item.unit,
            tax_rate: item.taxRate,
            position: index
          }))
        );
        if (iErr) notifyError('line_items (insert)', iErr);
      }
    }
  }
  
  // 4. Sync Expenses
  if (state.expenses && state.expenses.length > 0) {
    for (const exp of state.expenses) {
      notifyLog(`Upsert expense: ${exp.supplier} (${exp.id})`);
      const { error: eErr } = await supabase.from('expenses').upsert({
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
      });
      if (eErr) console.warn('Supabase Expenses sync warning:', eErr.message);
    }
  }

  // 5. Sync Payments ─ THE KEY FIX: persist payments to cloud so all devices see the same totals
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const userId = authSession?.user?.id;

  if (state.payments && state.payments.length > 0) {
    for (const payment of state.payments) {
      notifyLog(`Upsert payment: ${payment.id}`);
      const { error: payErr } = await supabase.from('payments').upsert({
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
      if (payErr) console.warn('Supabase Payments sync warning:', payErr.message);
    }
  }

  // 6. Sync Cash Flow entries
  if (state.cashFlow && state.cashFlow.length > 0) {
    for (const entry of state.cashFlow) {
      notifyLog(`Upsert cashflow: ${entry.id}`);
      const { error: cfErr } = await supabase.from('cash_flow').upsert({
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
      if (cfErr) console.warn('Supabase CashFlow sync warning:', cfErr.message);
    }
  }

  // 7. Sync Tax Settings & Declarations (stored as JSON rows keyed by profileId)
  if (state.taxSettings) {
    for (const [profileId, settings] of Object.entries(state.taxSettings)) {
      const { error: tsErr } = await supabase.from('tax_settings').upsert({
        profile_id: profileId,
        settings: settings,
      });
      if (tsErr) console.warn('Supabase TaxSettings sync warning:', tsErr.message);
    }
  }

  if (state.taxDeclarations && state.taxDeclarations.length > 0) {
    for (const decl of state.taxDeclarations) {
      const { error: tdErr } = await supabase.from('tax_declarations').upsert({
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
      });
      if (tdErr) console.warn('Supabase TaxDeclarations sync warning:', tdErr.message);
    }
  }

  notifyLog('Synchronisation terminée.');
};

export const loadFromSupabase = async (): Promise<Partial<AppState> | null> => {
  const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('*, bank_details(*)');
  if (profilesErr) console.error('Supabase Profiles Error:', profilesErr);

  const { data: clientsData, error: clientsErr } = await supabase.from('clients').select('*');
  if (clientsErr) console.error('Supabase Clients Error:', clientsErr);

  // Try fetching expenses from Supabase
  let cloudExpenses: any[] = [];
  try {
    const { data: expData, error: expErr } = await supabase.from('expenses').select('*');
    if (!expErr && expData) {
      cloudExpenses = expData.map((e: any) => ({
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
    }
  } catch (err) {
    console.warn('Expenses table fetch error:', err);
  }

  // Fetch Payments from Supabase
  let cloudPayments: any[] = [];
  try {
    const { data: payData, error: payErr } = await supabase.from('payments').select('*');
    if (!payErr && payData) {
      cloudPayments = payData.map((p: any) => ({
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
    }
  } catch (err) {
    console.warn('Payments table fetch error:', err);
  }

  // Fetch Cash Flow from Supabase
  let cloudCashFlow: any[] = [];
  try {
    const { data: cfData, error: cfErr } = await supabase.from('cash_flow').select('*');
    if (!cfErr && cfData) {
      cloudCashFlow = cfData.map((e: any) => ({
        id: e.id,
        profileId: e.profile_id,
        date: e.date,
        type: e.type,
        category: e.category,
        description: e.description,
        amount: Number(e.amount) || 0,
        bankAccountLabel: e.bank_account_label,
      }));
    }
  } catch (err) {
    console.warn('CashFlow table fetch error:', err);
  }

  // Fetch Tax Settings from Supabase
  let cloudTaxSettings: Record<string, any> = {};
  try {
    const { data: tsData, error: tsErr } = await supabase.from('tax_settings').select('*');
    if (!tsErr && tsData) {
      tsData.forEach((row: any) => {
        cloudTaxSettings[row.profile_id] = row.settings;
      });
    }
  } catch (err) {
    console.warn('TaxSettings table fetch error:', err);
  }

  // Fetch Tax Declarations from Supabase
  let cloudTaxDeclarations: any[] = [];
  try {
    const { data: tdData, error: tdErr } = await supabase.from('tax_declarations').select('*');
    if (!tdErr && tdData) {
      cloudTaxDeclarations = tdData.map((d: any) => ({
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
    }
  } catch (err) {
    console.warn('TaxDeclarations table fetch error:', err);
  }

  // Try joined query first for documents
  let docsData: any[] | null = null;
  const { data: joinedDocs, error: joinedDocsErr } = await supabase.from('documents').select('*, line_items(*)');
  
  if (joinedDocsErr) {
    console.error('Supabase Documents Join Error (falling back to separate queries):', joinedDocsErr);
    const { data: rawDocs, error: rawDocsErr } = await supabase.from('documents').select('*');
    if (rawDocsErr) console.error('Supabase Raw Documents Error:', rawDocsErr);
    
    const { data: allItems, error: itemsErr } = await supabase.from('line_items').select('*');
    if (itemsErr) console.error('Supabase Line Items Error:', itemsErr);

    if (rawDocs) {
      docsData = rawDocs.map(d => ({
        ...d,
        line_items: allItems ? allItems.filter(i => i.document_id === d.id) : []
      }));
    }
  } else {
    docsData = joinedDocs;
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
    items: (d.line_items || []).sort((a: any, b: any) => a.position - b.position).map((i: any) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      unit: i.unit,
      taxRate: i.tax_rate
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
};
