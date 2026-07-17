import { supabase } from './supabase';
import type { AppState, BusinessProfile, Client, DocumentData } from '../types';

// Convert AppState to Supabase tables
export const syncToSupabase = async (state: AppState) => {
  // We don't sync the active tab or current editing state, just the data

  // 1. Sync Profiles
  for (const profile of state.profiles) {
    const { bankDetails, ...profileData } = profile;
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

    if (pErr) console.error('Error syncing profile:', pErr);

    for (const bank of bankDetails) {
      await supabase.from('bank_details').upsert({
        profile_id: profileData.id,
        bank_name: bank.bankName,
        account_holder: bank.accountHolder,
        account_number: bank.accountNumber,
        iban: bank.iban,
        swift: bank.swift,
        rib: bank.rib,
        bank_address: bank.bankAddress
      });
    }
  }

  // 2. Sync Clients
  for (const client of state.clients) {
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
    if (cErr) console.error('Error syncing client:', cErr);
  }

  // 3. Sync Documents
  for (const doc of state.documents) {
    const { items, ...docData } = doc;
    const { error: dErr } = await supabase.from('documents').upsert({
      id: docData.id,
      type: docData.type,
      invoice_number: docData.invoiceNumber,
      date: docData.date,
      due_date: docData.dueDate,
      status: docData.status,
      payment_term: docData.paymentTerm,
      logo: docData.logo,
      sender: docData.sender,
      sender_bank_details: docData.senderBankDetails,
      recipient: docData.recipient,
      notes: docData.notes,
      settings: docData.settings
    });
    if (dErr) console.error('Error syncing document:', dErr);

    // Sync Line Items
    if (!dErr) {
      // First delete existing items to handle removals cleanly
      await supabase.from('line_items').delete().eq('document_id', doc.id);
      if (items.length > 0) {
        await supabase.from('line_items').insert(
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
      }
    }
  }
};

export const loadFromSupabase = async (): Promise<Partial<AppState> | null> => {
  const { data: profilesData } = await supabase.from('profiles').select('*, bank_details(*)');
  const { data: clientsData } = await supabase.from('clients').select('*');
  const { data: docsData } = await supabase.from('documents').select('*, line_items(*)');

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

  return {
    profiles,
    clients,
    documents,
    activeProfileId: profiles[0]?.id
  };
};
