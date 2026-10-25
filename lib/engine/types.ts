/**
 * Core Types for the Badminton Cost-Sharing Engine
 */

export type SplitMethod = 'weighted' | 'exact' | 'shuttle';

export type Category = 
  | 'court'       // Tiền sân
  | 'shuttle'     // Tiền cầu
  | 'drink'       // Nước uống
  | 'food'        // Ăn uống
  | 'transport'   // Đi lại (taxi/xe)
  | 'gift'        // Quà tặng/hoa/sự kiện
  | 'personal'    // Nợ riêng 2 người
  | 'other';      // Khác

export interface Participant {
  memberId: string;
  weight: number;      // e.g. 1 for single, 2 for couples
  sortOrder?: number;
}

export interface ExpenseShare {
  memberId: string;
  weight?: number;
  amount: number;      // Integer VND
}

export interface ExpenseInput {
  id?: string;
  amount: number;      // Integer VND
  paidBy: string;      // memberId
  splitMethod: SplitMethod;
  participants: Participant[]; // For weighted or shuttle
  exactShares?: Record<string, number>; // For exact method
  shuttleQty?: number;
  tubePrice?: number;
  shuttlesPerTube?: number;
}

export interface TransferRecord {
  id?: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface MemberBalance {
  memberId: string;
  openingBalance: number;
  totalPaid: number;      // Total amount this member paid for expenses
  totalOwed: number;      // Total amount this member owes for expense shares
  totalSent: number;      // Confirmed transfers sent to others
  totalReceived: number;  // Confirmed transfers received from others
  balance: number;        // > 0: To receive (nhận lại), < 0: Must pay (chuyển đi)
}

export interface SuggestedTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export type SettleMode = 'min_transactions' | 'via_treasurer';
