'use client';

import {
  calculateWeightedSplit,
  calculateExactSplit,
} from './engine/split';
import { calculateShuttleAmount } from './engine/shuttle';
import { calculateMemberBalances } from './engine/balances';
import { calculateSettlement } from './engine/settle';
import {
  Category,
  SplitMethod,
  MemberBalance,
  SuggestedTransfer,
  SettleMode,
} from './engine/types';

export interface Member {
  id: string;
  displayName: string;
  defaultWeight: number; // 1 or 2
  role: 'admin' | 'member';
  isActive: boolean;
  sortOrder: number;
  avatarColor: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountHolder?: string;
  qrImageData?: string; // base64 or url
}

export interface SessionParticipant {
  memberId: string;
  weight: number;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'badminton' | 'event';
  title?: string;
  note?: string;
  status: 'open' | 'locked';
  participants: SessionParticipant[];
  createdAt: string;
}

export interface ExpenseShareItem {
  memberId: string;
  weight?: number;
  amount: number;
}

export interface Expense {
  id: string;
  sessionId?: string;
  title: string;
  category: Category;
  amount: number;
  paidBy: string; // memberId
  splitMethod: SplitMethod;
  shuttleQty?: number;
  note?: string;
  shares: ExpenseShareItem[];
  createdAt: string;
}

export interface Transfer {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  note?: string;
  proofImageData?: string;
  createdAt: string;
  confirmedAt?: string;
  rejectReason?: string;
}

export interface GroupSettings {
  name: string;
  tubePrice: number;
  shuttlesPerTube: number;
  doneTolerance: number;
  transferRounding: number;
  treasurerMemberId: string;
  defaultSettleMode: SettleMode;
}

export interface AppState {
  settings: GroupSettings;
  currentUserMemberId: string;
  members: Member[];
  openingBalances: Record<string, number>;
  sessions: Session[];
  expenses: Expense[];
  transfers: Transfer[];
}

const STORAGE_KEY = 'lighter_badminton_app_state_v1';

// Initial verified seed data from Excel sheet 1010
export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'toan',
    displayName: 'Toàn',
    defaultWeight: 1,
    role: 'admin',
    isActive: true,
    sortOrder: 1,
    avatarColor: '#10b981', // Emerald green
    bankName: 'Techcombank',
    bankAccountNo: '190345678910',
    bankAccountHolder: 'NGUYEN THE TOAN',
  },
  {
    id: 'truong_thuy',
    displayName: 'Trường + Thủy',
    defaultWeight: 2,
    role: 'member',
    isActive: true,
    sortOrder: 2,
    avatarColor: '#3b82f6', // Blue
    bankName: 'MB Bank',
    bankAccountNo: '0987654321',
    bankAccountHolder: 'VU XUAN TRUONG',
  },
  {
    id: 'bang_tam',
    displayName: 'Băng + Tâm',
    defaultWeight: 2,
    role: 'member',
    isActive: true,
    sortOrder: 3,
    avatarColor: '#8b5cf6', // Purple
    bankName: 'Vietcombank',
    bankAccountNo: '001100456789',
    bankAccountHolder: 'NGUYEN LE BANG',
  },
  {
    id: 'tu',
    displayName: 'Tú',
    defaultWeight: 1,
    role: 'member',
    isActive: true,
    sortOrder: 4,
    avatarColor: '#f59e0b', // Amber
    bankName: 'VPBank',
    bankAccountNo: '1234567890',
    bankAccountHolder: 'TRAN ANH TU',
  },
  {
    id: 'kien',
    displayName: 'Kiên',
    defaultWeight: 1,
    role: 'member',
    isActive: true,
    sortOrder: 5,
    avatarColor: '#ec4899', // Pink
    bankName: 'TPBank',
    bankAccountNo: '0345678912',
    bankAccountHolder: 'HOANG TRUNG KIEN',
  },
  {
    id: 'ta_anh',
    displayName: 'Tạ Ánh',
    defaultWeight: 1,
    role: 'member',
    isActive: true,
    sortOrder: 6,
    avatarColor: '#06b6d4', // Cyan
    bankName: 'ACB',
    bankAccountNo: '9876543210',
    bankAccountHolder: 'TA THI ANH',
  },
  {
    id: 'quan',
    displayName: 'Quán',
    defaultWeight: 1,
    role: 'member',
    isActive: true,
    sortOrder: 7,
    avatarColor: '#64748b', // Slate
    bankName: 'VietinBank',
    bankAccountNo: '1020304050',
    bankAccountHolder: 'LE MINH QUAN',
  },
];

// Exact corrected opening balances from Sheet 1010 (Sum = 0)
export const INITIAL_OPENING_BALANCES: Record<string, number> = {
  toan: -163163,
  truong_thuy: -17144,
  bang_tam: -17142,
  tu: -8571,
  kien: 246645,
  ta_anh: 0,
  quan: -40625,
};

export const INITIAL_SETTINGS: GroupSettings = {
  name: 'Lighter Badminton',
  tubePrice: 340000,
  shuttlesPerTube: 12,
  doneTolerance: 1000,
  transferRounding: 1,
  treasurerMemberId: 'toan',
  defaultSettleMode: 'min_transactions',
};

export function getInitialState(): AppState {
  return {
    settings: INITIAL_SETTINGS,
    currentUserMemberId: 'toan',
    members: INITIAL_MEMBERS,
    openingBalances: INITIAL_OPENING_BALANCES,
    sessions: [
      {
        id: 'session-sample-1',
        date: new Date().toISOString().split('T')[0],
        type: 'badminton',
        title: 'Buổi cầu mẫu hôm nay',
        status: 'open',
        participants: [
          { memberId: 'toan', weight: 1 },
          { memberId: 'truong_thuy', weight: 2 },
          { memberId: 'bang_tam', weight: 2 },
          { memberId: 'tu', weight: 1 },
          { memberId: 'kien', weight: 1 },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    expenses: [
      {
        id: 'exp-sample-1',
        sessionId: 'session-sample-1',
        title: 'Tiền sân cầu lông',
        category: 'court',
        amount: 240000,
        paidBy: 'toan',
        splitMethod: 'weighted',
        shares: calculateWeightedSplit(240000, [
          { memberId: 'toan', weight: 1, sortOrder: 1 },
          { memberId: 'truong_thuy', weight: 2, sortOrder: 2 },
          { memberId: 'bang_tam', weight: 2, sortOrder: 3 },
          { memberId: 'tu', weight: 1, sortOrder: 4 },
          { memberId: 'kien', weight: 1, sortOrder: 5 },
        ]),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'exp-sample-2',
        sessionId: 'session-sample-1',
        title: 'Tiền cầu (3 quả)',
        category: 'shuttle',
        shuttleQty: 3,
        amount: calculateShuttleAmount(3, 340000, 12),
        paidBy: 'kien',
        splitMethod: 'weighted',
        shares: calculateWeightedSplit(calculateShuttleAmount(3, 340000, 12), [
          { memberId: 'toan', weight: 1, sortOrder: 1 },
          { memberId: 'truong_thuy', weight: 2, sortOrder: 2 },
          { memberId: 'bang_tam', weight: 2, sortOrder: 3 },
          { memberId: 'tu', weight: 1, sortOrder: 4 },
          { memberId: 'kien', weight: 1, sortOrder: 5 },
        ]),
        createdAt: new Date().toISOString(),
      },
    ],
    transfers: [],
  };
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return getInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      saveState(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local storage state:', e);
    return getInitialState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Trigger custom event so reactive hooks re-render across components
    window.dispatchEvent(new Event('badminton_store_updated'));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export function resetToSeed(): AppState {
  const s = getInitialState();
  saveState(s);
  return s;
}
