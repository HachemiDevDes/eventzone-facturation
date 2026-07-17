import { CURRENCY_INFO } from '../types';
import type { Currency } from '../types';

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
}

export const calculateTotals = (
  items: { quantity: number; rate: number }[],
  taxRate: number,              // TVA rate (0, 9, or 19)
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

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tvaAmount = taxableAmount * (taxRate / 100);
  const stampDuty = applyStampDuty ? stampDutyAmount : 0;
  const total = taxableAmount + tvaAmount + stampDuty;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    tvaAmount,
    stampDuty,
    total: Math.max(0, total),
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
