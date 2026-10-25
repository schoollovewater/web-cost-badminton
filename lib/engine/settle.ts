import { SuggestedTransfer, SettleMode } from './types';

export interface SettleOptions {
  mode?: SettleMode;
  treasurerMemberId?: string;
  doneTolerance?: number; // default 1000 VND
  roundingUnit?: number;  // 1 = no rounding, 1000 = round to 1000
}

/**
 * Suggests debt settlement transactions.
 * Mode 'min_transactions': Greedy debt simplification (minimum transfer count)
 * Mode 'via_treasurer': All debtors pay the treasurer; treasurer pays all creditors
 */
export function calculateSettlement(
  balances: Record<string, number>,
  options: SettleOptions = {}
): SuggestedTransfer[] {
  const {
    mode = 'min_transactions',
    treasurerMemberId,
    doneTolerance = 1000,
    roundingUnit = 1,
  } = options;

  if (mode === 'via_treasurer') {
    if (!treasurerMemberId) {
      throw new Error('treasurerMemberId is required when settling via treasurer');
    }
    const transfers: SuggestedTransfer[] = [];

    // All debtors pay treasurer
    for (const [memberId, balance] of Object.entries(balances)) {
      if (memberId !== treasurerMemberId && balance <= -doneTolerance) {
        const rawAmt = Math.abs(balance);
        const amount = roundAmount(rawAmt, roundingUnit);
        if (amount > 0) {
          transfers.push({
            fromMemberId: memberId,
            toMemberId: treasurerMemberId,
            amount,
          });
        }
      }
    }

    // Treasurer pays all creditors
    for (const [memberId, balance] of Object.entries(balances)) {
      if (memberId !== treasurerMemberId && balance >= doneTolerance) {
        const amount = roundAmount(balance, roundingUnit);
        if (amount > 0) {
          transfers.push({
            fromMemberId: treasurerMemberId,
            toMemberId: memberId,
            amount,
          });
        }
      }
    }

    return transfers;
  }

  // Default mode: min_transactions (Greedy matching)
  interface Party {
    memberId: string;
    amount: number; // positive number representing what to give or receive
  }

  const creditors: Party[] = [];
  const debtors: Party[] = [];

  for (const [memberId, balance] of Object.entries(balances)) {
    if (balance >= doneTolerance) {
      creditors.push({ memberId, amount: balance });
    } else if (balance <= -doneTolerance) {
      debtors.push({ memberId, amount: Math.abs(balance) });
    }
  }

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
  debtors.sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));

  const transfers: SuggestedTransfer[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const cred = creditors[cIdx];
    const deb = debtors[dIdx];

    const matchAmount = Math.min(cred.amount, deb.amount);
    const finalAmount = roundAmount(matchAmount, roundingUnit);

    if (finalAmount > 0) {
      transfers.push({
        fromMemberId: deb.memberId,
        toMemberId: cred.memberId,
        amount: finalAmount,
      });
    }

    cred.amount -= matchAmount;
    deb.amount -= matchAmount;

    if (cred.amount < doneTolerance) {
      cIdx++;
    }
    if (deb.amount < doneTolerance) {
      dIdx++;
    }
  }

  return transfers;
}

function roundAmount(amt: number, unit: number): number {
  if (unit <= 1) return amt;
  return Math.round(amt / unit) * unit;
}
