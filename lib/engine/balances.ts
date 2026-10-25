import { MemberBalance, TransferRecord } from './types';

export interface ExpenseRecord {
  id: string;
  amount: number;
  paidBy: string;
  shares: { memberId: string; amount: number }[];
}

/**
 * Calculates continuous member balances from opening balances, expenses, and confirmed transfers.
 * 
 * balance(m) = opening(m) + paid(m) - owed(m) + sent(m) - received(m)
 * 
 * When balance > 0: Member is owed money ("Nhận tiền" / Được nhận lại)
 * When balance < 0: Member owes money ("Chuyển tiền" / Cần chuyển đi)
 */
export function calculateMemberBalances(
  allMemberIds: string[],
  openingBalances: Record<string, number>,
  expenses: ExpenseRecord[],
  transfers: TransferRecord[]
): Record<string, MemberBalance> {
  const result: Record<string, MemberBalance> = {};

  // Initialize all members
  for (const memberId of allMemberIds) {
    result[memberId] = {
      memberId,
      openingBalance: openingBalances[memberId] ?? 0,
      totalPaid: 0,
      totalOwed: 0,
      totalSent: 0,
      totalReceived: 0,
      balance: 0,
    };
  }

  // Aggregate expenses
  for (const exp of expenses) {
    if (result[exp.paidBy]) {
      result[exp.paidBy].totalPaid += exp.amount;
    }
    for (const share of exp.shares) {
      if (result[share.memberId]) {
        result[share.memberId].totalOwed += share.amount;
      }
    }
  }

  // Aggregate confirmed transfers only
  for (const t of transfers) {
    if (t.status === 'confirmed') {
      if (result[t.fromMemberId]) {
        result[t.fromMemberId].totalSent += t.amount;
      }
      if (result[t.toMemberId]) {
        result[t.toMemberId].totalReceived += t.amount;
      }
    }
  }

  // Compute net balance for each member
  for (const memberId of allMemberIds) {
    const mb = result[memberId];
    mb.balance =
      mb.openingBalance +
      mb.totalPaid -
      mb.totalOwed +
      mb.totalSent -
      mb.totalReceived;
  }

  return result;
}

/**
 * Checks whether the total balance across all members sums to 0
 */
export function checkBalanceSumInvariant(
  balances: Record<string, MemberBalance>
): { isValid: boolean; sum: number } {
  const sum = Object.values(balances).reduce((acc, mb) => acc + mb.balance, 0);
  return {
    isValid: sum === 0,
    sum,
  };
}
