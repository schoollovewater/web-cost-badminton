import { SuggestedTransfer } from './types';

/**
 * Format integer VND with dots, e.g. 216333 -> "216.333đ"
 */
export function formatVND(amount: number, showSign: boolean = false): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('vi-VN') + 'đ';
  
  if (showSign) {
    if (amount > 0) return '+' + formatted;
    if (isNegative) return '-' + formatted;
  }
  return isNegative ? '-' + formatted : formatted;
}

/**
 * Format ISO date string or Date object to dd/MM/yyyy
 */
export function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface SummaryMessageParams {
  date: string;
  totalShares: number;
  expenses: {
    title: string;
    amount: number;
    paidByName: string;
  }[];
  costPerShare?: number;
  transfers: {
    fromName: string;
    toName: string;
    amount: number;
  }[];
  appUrl?: string;
}

/**
 * Generate plain-text message with clean emoji ready to paste into Zalo or Messenger
 */
export function generateZaloSummary(params: SummaryMessageParams): string {
  const { date, totalShares, expenses, costPerShare, transfers, appUrl } = params;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  let msg = `🏸 TỔNG KẾT CẦU LÔNG ${date} (${totalShares} suất)\n`;
  msg += `Tổng chi phí: ${formatVND(totalAmount)}\n`;
  
  if (expenses.length > 0) {
    for (const exp of expenses) {
      msg += `• ${exp.title}: ${formatVND(exp.amount)} (${exp.paidByName} trả)\n`;
    }
  }

  if (costPerShare) {
    msg += `👉 Trung bình mỗi suất: ${formatVND(costPerShare)}\n`;
  }

  if (transfers.length > 0) {
    msg += `\n💸 THANH TOÁN:\n`;
    for (const t of transfers) {
      msg += `• ${t.fromName} ➜ ${t.toName}: ${formatVND(t.amount)}\n`;
    }
  }

  if (appUrl) {
    msg += `\n📲 Chi tiết & mã QR: ${appUrl}\n`;
  }

  return msg.trim();
}
