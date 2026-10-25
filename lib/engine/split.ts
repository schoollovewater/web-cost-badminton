import { Participant, ExpenseShare } from './types';

/**
 * Calculates fair expense shares using the Largest Remainder Method (Hamilton-Hare method).
 * Guarantees that the sum of all shares equals the exact total amount down to 1 VND.
 */
export function calculateWeightedSplit(
  amount: number,
  participants: Participant[]
): ExpenseShare[] {
  if (participants.length === 0) {
    throw new Error('Participants list cannot be empty');
  }
  if (amount <= 0) {
    return participants.map((p) => ({
      memberId: p.memberId,
      weight: p.weight,
      amount: 0,
    }));
  }

  const totalWeight = participants.reduce((sum, p) => sum + Math.max(1, p.weight), 0);
  if (totalWeight <= 0) {
    throw new Error('Total weight must be greater than zero');
  }

  // Calculate base integer share and remainder fraction for each participant
  interface Item {
    memberId: string;
    weight: number;
    base: number;
    rem: number;
    originalIndex: number;
    sortOrder: number;
  }

  const items: Item[] = participants.map((p, idx) => {
    const w = Math.max(1, p.weight);
    // Use BigInt or exact integer division to prevent floating point quirks
    const rawNumerator = BigInt(amount) * BigInt(w);
    const totalWBig = BigInt(totalWeight);
    const base = Number(rawNumerator / totalWBig);
    const rem = Number(rawNumerator % totalWBig); // Integer remainder fraction

    return {
      memberId: p.memberId,
      weight: w,
      base,
      rem,
      originalIndex: idx,
      sortOrder: p.sortOrder ?? idx,
    };
  });

  const sumBase = items.reduce((sum, item) => sum + item.base, 0);
  const remainingDong = amount - sumBase; // R extra dong to distribute (0 <= R < participants.length)

  // Sort items by remainder descending; tie-break by sortOrder ascending, then originalIndex ascending
  const sortedIndices = items
    .map((item, idx) => idx)
    .sort((a, b) => {
      const itemA = items[a];
      const itemB = items[b];
      if (itemB.rem !== itemA.rem) {
        return itemB.rem - itemA.rem; // Higher remainder fraction gets priority
      }
      if (itemA.sortOrder !== itemB.sortOrder) {
        return itemA.sortOrder - itemB.sortOrder;
      }
      return itemA.originalIndex - itemB.originalIndex;
    });

  // Distribute 1 VND to the top R participants
  for (let i = 0; i < remainingDong; i++) {
    const targetIdx = sortedIndices[i];
    items[targetIdx].base += 1;
  }

  // Double check sum invariant
  const verifiedSum = items.reduce((sum, item) => sum + item.base, 0);
  if (verifiedSum !== amount) {
    throw new Error(`Split invariant failed: sum ${verifiedSum} !== total ${amount}`);
  }

  return items.map((item) => ({
    memberId: item.memberId,
    weight: item.weight,
    amount: item.base,
  }));
}

/**
 * Validates and processes exact amount splits
 */
export function calculateExactSplit(
  amount: number,
  exactShares: Record<string, number>
): ExpenseShare[] {
  let total = 0;
  const result: ExpenseShare[] = [];

  for (const [memberId, shareAmount] of Object.entries(exactShares)) {
    if (shareAmount < 0) {
      throw new Error(`Share for member ${memberId} cannot be negative`);
    }
    total += shareAmount;
    result.push({
      memberId,
      amount: shareAmount,
    });
  }

  if (total !== amount) {
    throw new Error(
      `Tổng số tiền chia (${total.toLocaleString('vi-VN')}đ) không khớp với số tiền khoản chi (${amount.toLocaleString('vi-VN')}đ)`
    );
  }

  return result;
}
