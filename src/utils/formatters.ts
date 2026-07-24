import { CURRENCY_INFO } from '../types';
import type { Currency, LineItem } from '../types';

export const formatCurrency = (amount: number, currencyCode: Currency): string => {
  const info = CURRENCY_INFO[currencyCode];
  if (!info) return `${amount.toFixed(2)}`;
  
  // DZD formatting: right-aligned symbol, space-separated thousands
  if (currencyCode === 'DZD') {
    const formatted = Math.abs(amount).toLocaleString('fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${amount < 0 ? '-' : ''}${formatted} DA`;
  }
  
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${info.symbol}${amount.toFixed(2)}`;
  }
};

export interface Totals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  tvaAmount: number;
  stampDuty: number;
  total: number;
  // Mixed TVA breakdown
  tvaBreakdown: { rate: number; base: number; tva: number }[];
}

export const calculateTotals = (
  items: LineItem[],
  taxRate: number,              // Document-level TVA rate (0, 9, or 19) — used when line has no override
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  applyStampDuty: boolean,
  stampDutyAmount: number
): Totals => {
  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = subtotal * (discountValue / 100);
  } else {
    discountAmount = discountValue;
  }

  // Apply discount proportionally to each line
  const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Mixed TVA: group items by their effective tax rate
  const tvaGroups: Record<number, { base: number; tva: number }> = {};
  items.forEach((item) => {
    const effectiveRate = item.taxRate !== undefined ? item.taxRate : taxRate;
    const lineBase = item.quantity * item.rate * discountRatio;
    const lineTva = lineBase * (effectiveRate / 100);
    if (!tvaGroups[effectiveRate]) {
      tvaGroups[effectiveRate] = { base: 0, tva: 0 };
    }
    tvaGroups[effectiveRate].base += lineBase;
    tvaGroups[effectiveRate].tva += lineTva;
  });

  const tvaBreakdown = Object.entries(tvaGroups)
    .map(([rate, vals]) => ({ rate: Number(rate), base: vals.base, tva: vals.tva }))
    .sort((a, b) => a.rate - b.rate);

  const tvaAmount = tvaBreakdown.reduce((sum, g) => sum + g.tva, 0);
  const stampDuty = applyStampDuty ? stampDutyAmount : 0;
  const total = taxableAmount + tvaAmount + stampDuty;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    tvaAmount,
    stampDuty,
    total: Math.max(0, total),
    tvaBreakdown,
  };
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('fr-DZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// ─── IRG Barème Progressif Algérien (correct) ─────────────────────────────────
// Base imposable = Salaire brut − CNAS salariale (9%) − Abattement forfaitaire (min 12 000 DA/an)
export const calculateIRG = (monthlyGrossSalary: number): number => {
  if (monthlyGrossSalary <= 0) return 0;

  const annualGross = monthlyGrossSalary * 12;
  
  // Déduction CNAS salariale: 9% du salaire brut
  const cnasSalariale = annualGross * 0.09;
  
  // Abattement forfaitaire: 40% du salaire net de CNAS, minimum 12 000 DA/an
  const netAfterCnas = annualGross - cnasSalariale;
  const abattement = Math.max(netAfterCnas * 0.40, 12000);
  
  // Base imposable IRG
  const baseIRG = Math.max(0, netAfterCnas - abattement);

  // Barème progressif algérien 2024/2025
  let annualIRG = 0;
  if (baseIRG <= 240000) {
    annualIRG = 0;
  } else if (baseIRG <= 480000) {
    annualIRG = (baseIRG - 240000) * 0.23;
  } else if (baseIRG <= 960000) {
    annualIRG = (480000 - 240000) * 0.23 + (baseIRG - 480000) * 0.27;
  } else if (baseIRG <= 1920000) {
    annualIRG = (480000 - 240000) * 0.23 + (960000 - 480000) * 0.27 + (baseIRG - 960000) * 0.30;
  } else {
    annualIRG =
      (480000 - 240000) * 0.23 +
      (960000 - 480000) * 0.27 +
      (1920000 - 960000) * 0.30 +
      (baseIRG - 1920000) * 0.33;
  }

  return annualIRG;
};

// Number to words in French (for Algerian invoices which require amount in words)
const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

function numberToWordsFr(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return `moins ${numberToWordsFr(-n)}`;
  if (n < 20) return ones[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    if (ten === 7) return `soixante${one === 0 ? '' : one === 1 ? ' et onze' : `-${ones[10 + one]}`}`;
    if (ten === 9) return `quatre-vingt${one === 0 ? 's' : `-${ones[10 + one]}`}`;
    return `${tens[ten]}${one === 0 ? '' : one === 1 && ten !== 8 ? ' et un' : `-${ones[one]}`}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundreds === 1 ? '' : `${ones[hundreds]} `}cent${rest === 0 && hundreds > 1 ? 's' : ''}${rest === 0 ? '' : ` ${numberToWordsFr(rest)}`}`;
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    return `${thousands === 1 ? 'mille' : `${numberToWordsFr(thousands)} mille`}${rest === 0 ? '' : ` ${numberToWordsFr(rest)}`}`;
  }
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  return `${numberToWordsFr(millions)} million${millions > 1 ? 's' : ''}${rest === 0 ? '' : ` ${numberToWordsFr(rest)}`}`;
}

export const amountToWords = (amount: number, currency: Currency): string => {
  const intPart = Math.floor(Math.abs(amount));
  const decPart = Math.round((Math.abs(amount) - intPart) * 100);
  const currencyName = currency === 'DZD' ? 'dinars algériens' : currency;
  const centName = currency === 'DZD' ? 'centimes' : 'centimes';
  
  let result = numberToWordsFr(intPart) + ` ${currencyName}`;
  if (decPart > 0) {
    result += ` et ${numberToWordsFr(decPart)} ${centName}`;
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
};
