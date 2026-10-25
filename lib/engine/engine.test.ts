import { describe, it, expect } from 'vitest';
import { calculateWeightedSplit, calculateExactSplit } from './split';
import { calculateShuttleAmount } from './shuttle';
import { calculateMemberBalances, checkBalanceSumInvariant } from './balances';
import { calculateSettlement } from './settle';

describe('Engine Unit Tests - Golden Test Cases (TC1 - TC8)', () => {
  // TC1: Sheet 274
  it('TC1: Sheet 274 (3 members, weight 1, Toàn paid all)', () => {
    const participants = [
      { memberId: 'Toan', weight: 1, sortOrder: 1 },
      { memberId: 'Tu', weight: 1, sortOrder: 2 },
      { memberId: 'Kien', weight: 1, sortOrder: 3 },
    ];

    const courtShares = calculateWeightedSplit(136500, participants);
    expect(courtShares.reduce((s, c) => s + c.amount, 0)).toBe(136500);
    expect(courtShares.map((c) => c.amount)).toEqual([45500, 45500, 45500]);

    const waterShares = calculateWeightedSplit(45000, participants);
    expect(waterShares.map((c) => c.amount)).toEqual([15000, 15000, 15000]);

    const foodShares = calculateWeightedSplit(143000, participants);
    expect(foodShares.reduce((s, c) => s + c.amount, 0)).toBe(143000);
    // 143000 / 3 = 47666.6667 -> 2 people get 47667, 1 gets 47666
    expect(foodShares.map((c) => c.amount)).toEqual([47667, 47667, 47666]);

    const expenses = [
      { id: '1', amount: 136500, paidBy: 'Toan', shares: courtShares },
      { id: '2', amount: 45000, paidBy: 'Toan', shares: waterShares },
      { id: '3', amount: 143000, paidBy: 'Toan', shares: foodShares },
    ];

    const balances = calculateMemberBalances(
      ['Toan', 'Tu', 'Kien'],
      {},
      expenses,
      []
    );

    expect(balances['Toan'].balance).toBe(216333);
    expect(balances['Tu'].balance).toBe(-108167);
    expect(balances['Kien'].balance).toBe(-108166);
    expect(checkBalanceSumInvariant(balances).isValid).toBe(true);
  });

  // TC2: Sheet 1209
  it('TC2: Sheet 1209 (Session 12/09 with couples weight 2)', () => {
    const participants = [
      { memberId: 'Toan', weight: 1, sortOrder: 1 },
      { memberId: 'TruongThuy', weight: 2, sortOrder: 2 },
      { memberId: 'BangTam', weight: 2, sortOrder: 3 },
      { memberId: 'Tu', weight: 1, sortOrder: 4 },
      { memberId: 'Kien', weight: 1, sortOrder: 5 },
      { memberId: 'Thai', weight: 1, sortOrder: 6 },
      { memberId: 'Thao', weight: 1, sortOrder: 7 },
      { memberId: 'Phan', weight: 1, sortOrder: 8 },
    ];

    const courtShares = calculateWeightedSplit(345000, participants);
    expect(courtShares.find((c) => c.memberId === 'Toan')?.amount).toBe(34500);
    expect(courtShares.find((c) => c.memberId === 'TruongThuy')?.amount).toBe(69000);
    expect(courtShares.reduce((s, c) => s + c.amount, 0)).toBe(345000);

    const shuttleAmt = calculateShuttleAmount(8, 340000, 12);
    expect(shuttleAmt).toBe(226667);

    const shuttleShares = calculateWeightedSplit(shuttleAmt, participants);
    expect(shuttleShares.find((c) => c.memberId === 'Toan')?.amount).toBe(22667);
    expect(shuttleShares.find((c) => c.memberId === 'TruongThuy')?.amount).toBe(45333);
    expect(shuttleShares.reduce((s, c) => s + c.amount, 0)).toBe(226667);
  });

  // TC3: Sheet 2609 Row 28 (Small group, couple counts as 1 share)
  it('TC3: Small group custom shares (couple counts as weight 1)', () => {
    const participants = [
      { memberId: 'Toan', weight: 1 },
      { memberId: 'TruongThuy', weight: 1 }, // Only 1 person drank
      { memberId: 'Tu', weight: 1 },
      { memberId: 'Kien', weight: 1 },
      { memberId: 'Quan', weight: 1 },
    ];

    const waterShares = calculateWeightedSplit(60000, participants);
    expect(waterShares.map((c) => c.amount)).toEqual([12000, 12000, 12000, 12000, 12000]);
  });

  // TC4: Exact split validation
  it('TC4: Exact split matches exactly and rejects invalid sum', () => {
    const valid = calculateExactSplit(172000, {
      Toan: 43000,
      TruongThuy: 43000,
      Tu: 43000,
      Quan: 43000,
    });
    expect(valid.length).toBe(4);
    expect(valid.reduce((s, c) => s + c.amount, 0)).toBe(172000);

    expect(() =>
      calculateExactSplit(172000, {
        Toan: 40000,
        TruongThuy: 40000,
      })
    ).toThrow();
  });

  // TC5: Personal 2-person debt
  it('TC5: Personal debt (Toan paid food for Kien)', () => {
    const shares = calculateExactSplit(35000, { Kien: 35000 });
    const exp = [{ id: 'p1', amount: 35000, paidBy: 'Toan', shares }];
    const balances = calculateMemberBalances(['Toan', 'Kien'], {}, exp, []);

    expect(balances['Toan'].balance).toBe(35000);
    expect(balances['Kien'].balance).toBe(-35000);
    expect(checkBalanceSumInvariant(balances).isValid).toBe(true);
  });

  // TC6: Settlement optimization
  it('TC6: Settlement algorithms (min_transactions vs via_treasurer)', () => {
    const balances = {
      A: 300000,
      B: 100000,
      C: -250000,
      D: -150000,
    };

    // Greedy min_transactions
    const minTx = calculateSettlement(balances, { mode: 'min_transactions' });
    expect(minTx.length).toBe(3);
    expect(minTx).toEqual([
      { fromMemberId: 'C', toMemberId: 'A', amount: 250000 },
      { fromMemberId: 'D', toMemberId: 'A', amount: 50000 },
      { fromMemberId: 'D', toMemberId: 'B', amount: 100000 },
    ]);

    // Via treasurer (A is treasurer)
    const viaA = calculateSettlement(balances, {
      mode: 'via_treasurer',
      treasurerMemberId: 'A',
    });
    expect(viaA).toEqual([
      { fromMemberId: 'C', toMemberId: 'A', amount: 250000 },
      { fromMemberId: 'D', toMemberId: 'A', amount: 150000 },
      { fromMemberId: 'A', toMemberId: 'B', amount: 100000 },
    ]);
  });

  // TC7: Invariant property test
  it('TC7: Invariant balance sum across members is always 0', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const participants = members.map((m, i) => ({ memberId: m, weight: (i % 2) + 1 }));
    const expenses = [
      { id: '1', amount: 250000, paidBy: 'm1', shares: calculateWeightedSplit(250000, participants) },
      { id: '2', amount: 85000, paidBy: 'm2', shares: calculateWeightedSplit(85000, participants) },
      { id: '3', amount: 140000, paidBy: 'm3', shares: calculateWeightedSplit(140000, participants) },
      { id: '4', amount: 33333, paidBy: 'm4', shares: calculateWeightedSplit(33333, participants) },
    ];
    const balances = calculateMemberBalances(members, {}, expenses, []);
    expect(checkBalanceSumInvariant(balances).isValid).toBe(true);
  });

  // TC8: Transfer status effects
  it('TC8: Only confirmed transfers affect balance; pending/rejected do not', () => {
    const members = ['A', 'B'];
    const exp = [
      {
        id: '1',
        amount: 100000,
        paidBy: 'A',
        shares: [
          { memberId: 'A', amount: 50000 },
          { memberId: 'B', amount: 50000 },
        ],
      },
    ];

    // Initial: A is +50000, B is -50000
    const b0 = calculateMemberBalances(members, {}, exp, []);
    expect(b0['A'].balance).toBe(50000);
    expect(b0['B'].balance).toBe(-50000);

    // Pending transfer
    const bPending = calculateMemberBalances(members, {}, exp, [
      { fromMemberId: 'B', toMemberId: 'A', amount: 50000, status: 'pending' },
    ]);
    expect(bPending['A'].balance).toBe(50000);
    expect(bPending['B'].balance).toBe(-50000);

    // Rejected transfer
    const bRejected = calculateMemberBalances(members, {}, exp, [
      { fromMemberId: 'B', toMemberId: 'A', amount: 50000, status: 'rejected' },
    ]);
    expect(bRejected['A'].balance).toBe(50000);
    expect(bRejected['B'].balance).toBe(-50000);

    // Confirmed transfer
    const bConfirmed = calculateMemberBalances(members, {}, exp, [
      { fromMemberId: 'B', toMemberId: 'A', amount: 50000, status: 'confirmed' },
    ]);
    expect(bConfirmed['A'].balance).toBe(0);
    expect(bConfirmed['B'].balance).toBe(0);
  });
});
