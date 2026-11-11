import { ExpenseCategory, UnitType } from '../types';

/**
 * Format currency in Algerian Dinars (دج)
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 دج';
  }
  // Formatted with commas or thin spaces as customary in Algeria
  const formatted = new Intl.NumberFormat('fr-DZ', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

  return `${formatted} دج`;
}

/**
 * Format weights in Arabic (e.g. 1.250 كغ or 450 غ)
 */
export function formatQuantityWithUnit(qty: number, unit: UnitType): string {
  if (unit === 'kg') {
    if (qty < 1 && qty > 0) {
      const grams = Math.round(qty * 1000);
      return `${grams} غرام (${qty.toFixed(3)} كغ)`;
    }
    return `${qty.toFixed(3).replace(/\.?0+$/, '')} كغ`;
  }
  if (unit === 'gram') {
    return `${qty} غرام`;
  }
  if (unit === 'liter') {
    return `${qty} لتر`;
  }
  if (unit === 'box') {
    return `${qty} علبة`;
  }
  if (unit === 'pack') {
    return `${qty} حزمة`;
  }
  return `${qty} قطعة`;
}

/**
 * Arabic unit display names
 */
export const UNIT_LABELS: Record<UnitType, string> = {
  piece: 'قطعة',
  kg: 'كيلوغرام (كغ)',
  gram: 'غرام',
  liter: 'لتر',
  box: 'علبة',
  pack: 'حزمة/باقة',
};

/**
 * Arabic Expense category display names
 */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: 'كهرباء وسونلغاز',
  packaging: 'أكياس وتغليف',
  transport: 'نقل وشحن بضائع',
  rent: 'كراء المحل',
  wages: 'أجور وتكاليف عمال',
  maintenance: 'صيانة ومعدات',
  waste: 'توالف ومصاريف هدر',
  other: 'مصاريف متنوعة',
};

/**
 * Format date in localized Algerian/Arabic readable format
 */
export function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

/**
 * Calculate line item total safely with rounding
 */
export function calculateItemTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity * 100) / 100;
}

/**
 * Calculate cost safely
 */
export function calculateItemCost(purchasePrice: number, quantity: number): number {
  return Math.round(purchasePrice * quantity * 100) / 100;
}
