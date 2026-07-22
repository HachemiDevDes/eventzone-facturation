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
  
  try {
    localStorage.setItem('fawtara_full_state', JSON.stringify({
      expenses: state.expenses,
      taxSettings: state.taxSettings,
      taxDeclarations: state.taxDeclarations,
    }));
  } catch (e) {
    console.warn('LocalStorage backup error:', e);
  }
  
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
    
    // Add user_id if we have a session, just in case they added a user_id column
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
      ...(session?.user?.id ? { user_id: session.user.id } : {}) // Attempt to satisfy RLS
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
  
  // 4. Sync Expenses (if expenses table exists)
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

  // Try joined query first
  let docsData: any[] | null = null;
  const { data: joinedDocs, error: joinedDocsErr } = await supabase.from('documents').select('*, line_items(*)');
  
  if (joinedDocsErr) {
    console.error('Supabase Documents Join Error (falling back to separate queries):', joinedDocsErr);
    // Fallback if foreign key is missing
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

  let localFullState: any = {};
  try {
    const raw = localStorage.getItem('fawtara_dashboard_state') || localStorage.getItem('fawtara_full_state');
    if (raw) localFullState = JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }

  // Merge cloud and local expenses
  const localExpenses: any[] = localFullState.expenses || [];
  const mergedExpensesMap = new Map();
  localExpenses.forEach((e: any) => mergedExpensesMap.set(e.id, e));
  cloudExpenses.forEach((e: any) => mergedExpensesMap.set(e.id, e));

  return {
    profiles,
    clients,
    documents,
    expenses: Array.from(mergedExpensesMap.values()),
    taxSettings: localFullState.taxSettings || {},
    taxDeclarations: localFullState.taxDeclarations || [],
    activeProfileId: profiles[0]?.id
  };
};
