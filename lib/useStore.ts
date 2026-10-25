'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppState,
  loadState,
  saveState,
  resetToSeed,
  Member,
  Session,
  Expense,
  Transfer,
} from './store';
import { calculateMemberBalances } from './engine/balances';
import { calculateSettlement } from './engine/settle';
import { calculateWeightedSplit, calculateExactSplit } from './engine/split';
import { calculateShuttleAmount } from './engine/shuttle';
import { SplitMethod, Category, SettleMode } from './engine/types';

export function useStore() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    // Sync state on mount and when custom event fires
    const sync = () => {
      setState(loadState());
    };
    window.addEventListener('badminton_store_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('badminton_store_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const currentMember = useMemo(() => {
    return (
      state.members.find((m) => m.id === state.currentUserMemberId) ||
      state.members[0]
    );
  }, [state.members, state.currentUserMemberId]);

  const allMemberIds = useMemo(() => {
    return state.members.map((m) => m.id);
  }, [state.members]);

  const balances = useMemo(() => {
    const rawExpenses = state.expenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      paidBy: e.paidBy,
      shares: e.shares,
    }));

    const rawTransfers = state.transfers.map((t) => ({
      id: t.id,
      fromMemberId: t.fromMemberId,
      toMemberId: t.toMemberId,
      amount: t.amount,
      status: t.status,
    }));

    return calculateMemberBalances(
      allMemberIds,
      state.openingBalances,
      rawExpenses,
      rawTransfers
    );
  }, [allMemberIds, state.openingBalances, state.expenses, state.transfers]);

  const suggestedTransfers = useMemo(() => {
    const balanceMap: Record<string, number> = {};
    for (const [id, mb] of Object.entries(balances)) {
      balanceMap[id] = mb.balance;
    }

    return calculateSettlement(balanceMap, {
      mode: state.settings.defaultSettleMode,
      treasurerMemberId: state.settings.treasurerMemberId,
      doneTolerance: state.settings.doneTolerance,
      roundingUnit: state.settings.transferRounding,
    });
  }, [balances, state.settings]);

  // Switch acting user
  const switchUser = useCallback(
    (memberId: string) => {
      updateState((prev) => ({
        ...prev,
        currentUserMemberId: memberId,
      }));
    },
    [updateState]
  );

  // Create new session with automatic expenses
  const createSession = useCallback(
    (params: {
      date: string;
      title?: string;
      note?: string;
      participants: { memberId: string; weight: number }[];
      courtCost?: { amount: number; paidBy: string };
      shuttleCost?: { qty: number; paidBy: string; tubePrice?: number };
      otherCosts?: { title: string; category: Category; amount: number; paidBy: string }[];
    }) => {
      const sessionId = 'session-' + Date.now();
      const newSession: Session = {
        id: sessionId,
        date: params.date,
        type: 'badminton',
        title: params.title || `Buổi cầu ngày ${params.date}`,
        note: params.note,
        status: 'open',
        participants: params.participants,
        createdAt: new Date().toISOString(),
      };

      const newExpenses: Expense[] = [];

      // 1. Court cost
      if (params.courtCost && params.courtCost.amount > 0) {
        newExpenses.push({
          id: 'exp-' + Date.now() + '-court',
          sessionId,
          title: 'Tiền sân cầu lông',
          category: 'court',
          amount: params.courtCost.amount,
          paidBy: params.courtCost.paidBy,
          splitMethod: 'weighted',
          shares: calculateWeightedSplit(
            params.courtCost.amount,
            params.participants
          ),
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Shuttle cost
      if (params.shuttleCost && params.shuttleCost.qty > 0) {
        const tubePrice =
          params.shuttleCost.tubePrice || state.settings.tubePrice;
        const totalShuttleAmt = calculateShuttleAmount(
          params.shuttleCost.qty,
          tubePrice,
          state.settings.shuttlesPerTube
        );

        newExpenses.push({
          id: 'exp-' + Date.now() + '-shuttle',
          sessionId,
          title: `Tiền cầu (${params.shuttleCost.qty} quả)`,
          category: 'shuttle',
          shuttleQty: params.shuttleCost.qty,
          amount: totalShuttleAmt,
          paidBy: params.shuttleCost.paidBy,
          splitMethod: 'shuttle',
          shares: calculateWeightedSplit(totalShuttleAmt, params.participants),
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Other costs
      if (params.otherCosts) {
        params.otherCosts.forEach((item, idx) => {
          if (item.amount > 0) {
            newExpenses.push({
              id: 'exp-' + Date.now() + '-other-' + idx,
              sessionId,
              title: item.title,
              category: item.category,
              amount: item.amount,
              paidBy: item.paidBy,
              splitMethod: 'weighted',
              shares: calculateWeightedSplit(item.amount, params.participants),
              createdAt: new Date().toISOString(),
            });
          }
        });
      }

      updateState((prev) => ({
        ...prev,
        sessions: [newSession, ...prev.sessions],
        expenses: [...newExpenses, ...prev.expenses],
      }));

      return sessionId;
    },
    [state.settings, updateState]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      updateState((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== sessionId),
        expenses: prev.expenses.filter((e) => e.sessionId !== sessionId),
      }));
    },
    [updateState]
  );

  const lockSession = useCallback(
    (sessionId: string) => {
      updateState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, status: 'locked' } : s
        ),
      }));
    },
    [updateState]
  );

  // Add individual expense
  const createExpense = useCallback(
    (expenseInput: {
      sessionId?: string;
      title: string;
      category: Category;
      amount: number;
      paidBy: string;
      splitMethod: SplitMethod;
      participants?: { memberId: string; weight: number }[];
      exactShares?: Record<string, number>;
      note?: string;
    }) => {
      let shares: { memberId: string; weight?: number; amount: number }[] = [];

      if (expenseInput.splitMethod === 'exact' && expenseInput.exactShares) {
        shares = calculateExactSplit(
          expenseInput.amount,
          expenseInput.exactShares
        );
      } else {
        const parts = expenseInput.participants ||
          state.members.map((m) => ({ memberId: m.id, weight: m.defaultWeight }));
        shares = calculateWeightedSplit(expenseInput.amount, parts);
      }

      const newExp: Expense = {
        id: 'exp-' + Date.now(),
        sessionId: expenseInput.sessionId,
        title: expenseInput.title,
        category: expenseInput.category,
        amount: expenseInput.amount,
        paidBy: expenseInput.paidBy,
        splitMethod: expenseInput.splitMethod,
        note: expenseInput.note,
        shares,
        createdAt: new Date().toISOString(),
      };

      updateState((prev) => ({
        ...prev,
        expenses: [newExp, ...prev.expenses],
      }));

      return newExp.id;
    },
    [state.members, updateState]
  );

  const deleteExpense = useCallback(
    (expenseId: string) => {
      updateState((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
    },
    [updateState]
  );

  // Transfers
  const createTransfer = useCallback(
    (params: {
      fromMemberId: string;
      toMemberId: string;
      amount: number;
      note?: string;
      proofImageData?: string;
    }) => {
      const newTransfer: Transfer = {
        id: 'transfer-' + Date.now(),
        fromMemberId: params.fromMemberId,
        toMemberId: params.toMemberId,
        amount: params.amount,
        status: 'pending',
        note: params.note,
        proofImageData: params.proofImageData,
        createdAt: new Date().toISOString(),
      };

      updateState((prev) => ({
        ...prev,
        transfers: [newTransfer, ...prev.transfers],
      }));

      return newTransfer.id;
    },
    [updateState]
  );

  const confirmTransfer = useCallback(
    (transferId: string) => {
      updateState((prev) => ({
        ...prev,
        transfers: prev.transfers.map((t) =>
          t.id === transferId
            ? { ...t, status: 'confirmed', confirmedAt: new Date().toISOString() }
            : t
        ),
      }));
    },
    [updateState]
  );

  const rejectTransfer = useCallback(
    (transferId: string, reason: string) => {
      updateState((prev) => ({
        ...prev,
        transfers: prev.transfers.map((t) =>
          t.id === transferId
            ? { ...t, status: 'rejected', rejectReason: reason }
            : t
        ),
      }));
    },
    [updateState]
  );

  const updateMemberProfile = useCallback(
    (memberId: string, updates: Partial<Member>) => {
      updateState((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId ? { ...m, ...updates } : m
        ),
      }));
    },
    [updateState]
  );

  const updateSettings = useCallback(
    (updates: Partial<AppState['settings']>) => {
      updateState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
    },
    [updateState]
  );

  const resetAllData = useCallback(() => {
    const fresh = resetToSeed();
    setState(fresh);
  }, []);

  return {
    state,
    currentMember,
    members: state.members,
    sessions: state.sessions,
    expenses: state.expenses,
    transfers: state.transfers,
    balances,
    suggestedTransfers,
    switchUser,
    createSession,
    deleteSession,
    lockSession,
    createExpense,
    deleteExpense,
    createTransfer,
    confirmTransfer,
    rejectTransfer,
    updateMemberProfile,
    updateSettings,
    resetAllData,
  };
}
