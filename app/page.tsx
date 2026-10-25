'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/useStore';
import { formatVND, formatDate } from '@/lib/engine/format';
import { calculateShuttleAmount } from '@/lib/engine/shuttle';
import { calculateWeightedSplit } from '@/lib/engine/split';
import { calculateSettlement } from '@/lib/engine/settle';
import { Member } from '@/lib/store';
import {
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  syncSessionToGoogleSheet,
} from '@/lib/googleSheet';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  QrCode,
  Share2,
  FileSpreadsheet,
  Settings,
  Sparkles,
  ExternalLink,
  Users,
  UserCheck,
  UserX,
  Calendar,
  CreditCard,
  Eye,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  HandCoins,
} from 'lucide-react';

export type SplitMode = 'all' | 'custom' | 'debt';

export interface OtherExpense {
  id: string;
  title: string;
  amount: number;
  paidBy: string; // memberId who paid
  splitType: SplitMode;
  beneficiaryIds: string[]; // memberIds sharing this (when 'custom')
  debtorId?: string; // memberId who owes paidBy (when 'debt')
}

export default function BadmintonCalculatorPage() {
  const { members, state, createSession } = useStore();

  // Local state for Google Sheet Webhook URL
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [showSheetSettings, setShowSheetSettings] = useState<boolean>(false);
  const [scriptCopied, setScriptCopied] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Load webhook URL from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('badminton_sheet_webhook_url');
    if (saved) {
      setWebhookUrl(saved);
    }
  }, []);

  const handleSaveWebhook = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem('badminton_sheet_webhook_url', url.trim());
  };

  // --- 1. SESSION INPUTS (BÊN TRÁI) ---
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [title, setTitle] = useState<string>('');

  // Participants: memberId -> weight (0 = not attending)
  const [selectedWeights, setSelectedWeights] = useState<Record<string, number>>(
    () => {
      const init: Record<string, number> = {};
      for (const m of members) {
        if (m.isActive) {
          init[m.id] = m.defaultWeight;
        }
      }
      return init;
    }
  );

  // Custom guests / additional participants
  const [customGuests, setCustomGuests] = useState<
    { id: string; name: string; weight: number }[]
  >([]);
  const [newGuestName, setNewGuestName] = useState<string>('');

  // Court & Shuttle Costs
  const defaultPayer = members[0]?.id || 'toan';
  const [courtAmount, setCourtAmount] = useState<number>(240000);
  const [courtPaidBy, setCourtPaidBy] = useState<string>(defaultPayer);

  const [shuttleInputMode, setShuttleInputMode] = useState<'qty' | 'amount'>('qty');
  const [shuttleQty, setShuttleQty] = useState<number>(4);
  const [customTubePrice, setCustomTubePrice] = useState<number>(
    state.settings.tubePrice || 340000
  );
  const [directShuttleAmount, setDirectShuttleAmount] = useState<number>(113333);
  const [shuttlePaidBy, setShuttlePaidBy] = useState<string>(defaultPayer);

  // Additional expenses: includes group splits (Toàn, Kiên, Tú) & 1-on-1 personal debts
  const [otherCosts, setOtherCosts] = useState<OtherExpense[]>([]);

  // Modals & Feedback
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [zoomedQr, setZoomedQr] = useState<{
    receiverName: string;
    bankName: string;
    accountNo: string;
    amount: number;
    qrUrl: string;
  } | null>(null);

  // --- 2. TÍNH TOÁN REALTIME ---
  // A. All active participants in badminton session
  const allParticipants = useMemo(() => {
    const list: { id: string; name: string; weight: number }[] = [];
    for (const m of members) {
      const w = selectedWeights[m.id] || 0;
      if (w > 0) {
        list.push({ id: m.id, name: m.displayName, weight: w });
      }
    }
    for (const g of customGuests) {
      if (g.weight > 0) {
        list.push({ id: g.id, name: g.name, weight: g.weight });
      }
    }
    return list;
  }, [members, selectedWeights, customGuests]);

  const totalShares = useMemo(() => {
    return allParticipants.reduce((sum, p) => sum + p.weight, 0);
  }, [allParticipants]);

  // B. Calculated Shuttle Cost
  const calculatedShuttleAmount = useMemo(() => {
    if (shuttleInputMode === 'amount') return directShuttleAmount;
    return calculateShuttleAmount(
      shuttleQty,
      customTubePrice,
      state.settings.shuttlesPerTube || 12
    );
  }, [
    shuttleInputMode,
    directShuttleAmount,
    shuttleQty,
    customTubePrice,
    state.settings.shuttlesPerTube,
  ]);

  // C. Total Costs
  const totalOtherAmount = useMemo(() => {
    return otherCosts.reduce((s, c) => s + (c.amount || 0), 0);
  }, [otherCosts]);

  const grandTotal = courtAmount + calculatedShuttleAmount + totalOtherAmount;
  const costPerShare = totalShares > 0 ? Math.round((courtAmount + calculatedShuttleAmount) / totalShares) : 0;

  // D. Base Court & Shuttle split (split among all session participants by weight)
  const baseCourtSplit = useMemo(() => {
    if (allParticipants.length === 0 || courtAmount <= 0) return {};
    const splitInput = allParticipants.map((p) => ({ memberId: p.id, weight: p.weight }));
    const shares = calculateWeightedSplit(courtAmount, splitInput);
    const map: Record<string, number> = {};
    for (const s of shares) map[s.memberId] = s.amount;
    return map;
  }, [allParticipants, courtAmount]);

  const baseShuttleSplit = useMemo(() => {
    if (allParticipants.length === 0 || calculatedShuttleAmount <= 0) return {};
    const splitInput = allParticipants.map((p) => ({ memberId: p.id, weight: p.weight }));
    const shares = calculateWeightedSplit(calculatedShuttleAmount, splitInput);
    const map: Record<string, number> = {};
    for (const s of shares) map[s.memberId] = s.amount;
    return map;
  }, [allParticipants, calculatedShuttleAmount]);

  // E. All involved members (session participants + any member in otherCosts/debts)
  const allInvolvedMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; weight: number }>();
    for (const p of allParticipants) {
      map.set(p.id, { id: p.id, name: p.name, weight: p.weight });
    }
    // Also include anyone mentioned in otherCosts even if not in session
    for (const oc of otherCosts) {
      if (oc.paidBy && !map.has(oc.paidBy)) {
        const m = members.find((x) => x.id === oc.paidBy);
        if (m) map.set(m.id, { id: m.id, name: m.displayName, weight: 0 });
      }
      if (oc.splitType === 'debt' && oc.debtorId && !map.has(oc.debtorId)) {
        const m = members.find((x) => x.id === oc.debtorId);
        if (m) map.set(m.id, { id: m.id, name: m.displayName, weight: 0 });
      }
      if (oc.splitType === 'custom' && oc.beneficiaryIds) {
        for (const bId of oc.beneficiaryIds) {
          if (!map.has(bId)) {
            const m = members.find((x) => x.id === bId);
            if (m) map.set(m.id, { id: m.id, name: m.displayName, weight: 0 });
          }
        }
      }
    }
    return Array.from(map.values());
  }, [allParticipants, otherCosts, members]);

  // F. Net Balances Calculation (Exact breakdown)
  const sessionBalances = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        weight: number;
        paid: number;
        courtShare: number;
        shuttleShare: number;
        otherShare: number;
        debtShare: number;
        totalShare: number;
        net: number;
      }
    > = {};

    for (const p of allInvolvedMembers) {
      map[p.id] = {
        name: p.name,
        weight: p.weight,
        paid: 0,
        courtShare: baseCourtSplit[p.id] || 0,
        shuttleShare: baseShuttleSplit[p.id] || 0,
        otherShare: 0,
        debtShare: 0,
        totalShare: 0,
        net: 0,
      };
    }

    // 1. Credit Court Payer
    if (courtAmount > 0 && map[courtPaidBy]) {
      map[courtPaidBy].paid += courtAmount;
    }
    // 2. Credit Shuttle Payer
    if (calculatedShuttleAmount > 0 && map[shuttlePaidBy]) {
      map[shuttlePaidBy].paid += calculatedShuttleAmount;
    }

    // 3. Process Each Other Expense
    for (const oc of otherCosts) {
      if (oc.amount <= 0) continue;

      // Credit the payer
      if (map[oc.paidBy]) {
        map[oc.paidBy].paid += oc.amount;
      }

      // Allocate the share depending on splitType:
      if (oc.splitType === 'all') {
        // Split across all session participants
        if (allParticipants.length > 0) {
          const splitInput = allParticipants.map((p) => ({ memberId: p.id, weight: p.weight }));
          const shares = calculateWeightedSplit(oc.amount, splitInput);
          for (const sh of shares) {
            if (map[sh.memberId]) {
              map[sh.memberId].otherShare += sh.amount;
            }
          }
        }
      } else if (oc.splitType === 'custom') {
        // Split evenly across the specific group of beneficiaries
        const bens = oc.beneficiaryIds.filter((id) => map[id]);
        const targetBens = bens.length > 0 ? bens : [oc.paidBy];
        const splitInput = targetBens.map((id) => ({ memberId: id, weight: 1 }));
        const shares = calculateWeightedSplit(oc.amount, splitInput);
        for (const sh of shares) {
          if (map[sh.memberId]) {
            map[sh.memberId].otherShare += sh.amount;
          }
        }
      } else if (oc.splitType === 'debt') {
        // 1-on-1 private debt: debtor owes 100% of this amount
        const debtor = oc.debtorId || oc.paidBy;
        if (map[debtor]) {
          map[debtor].debtShare += oc.amount;
        }
      }
    }

    // Compute totalShare and net for everyone
    for (const id of Object.keys(map)) {
      const item = map[id];
      item.totalShare = item.courtShare + item.shuttleShare + item.otherShare + item.debtShare;
      item.net = item.paid - item.totalShare;
    }

    return map;
  }, [
    allInvolvedMembers,
    allParticipants,
    courtAmount,
    courtPaidBy,
    calculatedShuttleAmount,
    shuttlePaidBy,
    baseCourtSplit,
    baseShuttleSplit,
    otherCosts,
  ]);

  // G. Simplified Settlement: Who transfers to whom
  const transfers = useMemo(() => {
    const balanceRecord: Record<string, number> = {};
    for (const [id, data] of Object.entries(sessionBalances)) {
      balanceRecord[id] = data.net;
    }
    return calculateSettlement(balanceRecord, {
      mode: 'min_transactions',
      doneTolerance: 500,
    });
  }, [sessionBalances]);

  // --- ACTIONS ---
  const toggleMember = (id: string, defaultWeight: number) => {
    setSelectedWeights((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) > 0 ? 0 : defaultWeight,
    }));
  };

  const adjustWeight = (id: string, delta: number) => {
    setSelectedWeights((prev) => {
      const cur = prev[id] || 1;
      const next = Math.max(1, cur + delta);
      return { ...prev, [id]: next };
    });
  };

  const addGuest = () => {
    if (!newGuestName.trim()) return;
    const guestId = 'guest_' + Date.now();
    setCustomGuests((prev) => [
      ...prev,
      { id: guestId, name: newGuestName.trim(), weight: 1 },
    ]);
    setNewGuestName('');
  };

  const removeGuest = (guestId: string) => {
    setCustomGuests((prev) => prev.filter((g) => g.id !== guestId));
  };

  // Add Other Cost with customizable splitType
  const addOtherCost = (
    title: string,
    amount: number,
    splitType: SplitMode = 'all',
    beneficiaryIds: string[] = [],
    debtorId?: string
  ) => {
    const initialBeneficiaries =
      beneficiaryIds.length > 0
        ? beneficiaryIds
        : allParticipants.slice(0, 3).map((p) => p.id);

    setOtherCosts((prev) => [
      ...prev,
      {
        id: 'other_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title,
        amount,
        paidBy: defaultPayer,
        splitType,
        beneficiaryIds: initialBeneficiaries,
        debtorId: debtorId || (members[1]?.id || 'kien'),
      },
    ]);
  };

  const removeOtherCost = (id: string) => {
    setOtherCosts((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleBeneficiary = (costId: string, memberId: string) => {
    setOtherCosts((prev) =>
      prev.map((c) => {
        if (c.id !== costId) return c;
        const current = c.beneficiaryIds || [];
        const next = current.includes(memberId)
          ? current.filter((id) => id !== memberId)
          : [...current, memberId];
        return { ...c, beneficiaryIds: next };
      })
    );
  };

  // VietQR URL builder helper
  const getVietQrUrl = (
    receiverMember: Member | undefined,
    amount: number,
    note: string
  ) => {
    if (!receiverMember) return '';
    if (receiverMember.qrImageData) return receiverMember.qrImageData;

    const bankCodeMap: Record<string, string> = {
      'Techcombank': 'TCB',
      'MB Bank': 'MB',
      'Vietcombank': 'VCB',
      'VPBank': 'VPB',
      'TPBank': 'TPB',
      'VietinBank': 'ICB',
      'BIDV': 'BIDV',
      'ACB': 'ACB',
    };
    const bankCode = bankCodeMap[receiverMember.bankName || ''] || 'MB';
    const accNo = receiverMember.bankAccountNo || '0987654321';
    const accName = encodeURIComponent(
      receiverMember.bankAccountHolder || receiverMember.displayName
    );
    const encodedNote = encodeURIComponent(note);
    return `https://img.vietqr.io/image/${bankCode}-${accNo}-compact2.png?amount=${amount}&addInfo=${encodedNote}&accountName=${accName}`;
  };

  // 1-Click Copy Zalo Message
  const handleCopyZalo = () => {
    const dateFormatted = new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    let msg = `🏸 TỔNG KẾT TIỀN CẦU LÔNG — ${dateFormatted}`;
    if (title.trim()) msg += ` (${title.trim()})`;
    msg += `\n─────────────────────\n`;
    msg += `💰 Tổng chi: ${formatVND(grandTotal)}\n`;
    if (totalShares > 0) {
      msg += `🎯 Tiền cầu + sân (${totalShares} suất): ${formatVND(costPerShare)} / suất\n`;
    }
    msg += `\n📌 Chi tiết các khoản chi:\n`;

    const courtPayer = members.find((m) => m.id === courtPaidBy)?.displayName || 'Toàn';
    msg += `• Tiền sân: ${formatVND(courtAmount)} (${courtPayer} trả)\n`;

    const shuttlePayer = members.find((m) => m.id === shuttlePaidBy)?.displayName || 'Toàn';
    if (shuttleInputMode === 'qty') {
      msg += `• Tiền cầu: ${formatVND(calculatedShuttleAmount)} (${shuttleQty} quả - ${shuttlePayer} trả)\n`;
    } else {
      msg += `• Tiền cầu: ${formatVND(calculatedShuttleAmount)} (${shuttlePayer} trả)\n`;
    }

    for (const oc of otherCosts) {
      if (oc.amount > 0) {
        const payer = members.find((m) => m.id === oc.paidBy)?.displayName || 'Thành viên';
        if (oc.splitType === 'all') {
          msg += `• ${oc.title}: ${formatVND(oc.amount)} (${payer} trả — chia cả nhóm)\n`;
        } else if (oc.splitType === 'custom') {
          const names = oc.beneficiaryIds
            .map((id) => members.find((m) => m.id === id)?.displayName || id)
            .join(', ');
          const perPerson =
            oc.beneficiaryIds.length > 0 ? Math.round(oc.amount / oc.beneficiaryIds.length) : oc.amount;
          msg += `• ${oc.title}: ${formatVND(oc.amount)} (${payer} trả — chia ${oc.beneficiaryIds.length} người: ${names} — ${formatVND(perPerson)}/người)\n`;
        } else if (oc.splitType === 'debt') {
          const debtorName = members.find((m) => m.id === oc.debtorId)?.displayName || 'Thành viên';
          msg += `• ${oc.title}: ${formatVND(oc.amount)} (${debtorName} nợ riêng ${payer})\n`;
        }
      }
    }

    msg += `\n💸 AI CHUYỂN CHO AI (ĐÃ TỰ ĐỘNG BÙ TRỪ TẤT CẢ):\n`;
    if (transfers.length === 0) {
      msg += `✅ Mọi người đã hòa tiền, không cần chuyển khoản!\n`;
    } else {
      transfers.forEach((t, idx) => {
        const fromName =
          allInvolvedMembers.find((p) => p.id === t.fromMemberId)?.name || 'Thành viên';
        const toMember = members.find((m) => m.id === t.toMemberId);
        const toName = toMember?.displayName || 'Thành viên';
        const bankInfo = toMember?.bankAccountNo
          ? ` (${toMember.bankName || 'Ngân hàng'} - STK: ${toMember.bankAccountNo})`
          : '';
        msg += `${idx + 1}. ${fromName} ➜ ${toName}: ${formatVND(t.amount)}${bankInfo}\n`;
      });
    }

    msg += `\n✨ Mọi người chuyển khoản sớm giúp nhóm nhé!`;

    navigator.clipboard.writeText(msg);
    setCopiedZalo(true);
    setTimeout(() => setCopiedZalo(false), 2500);
  };

  // Sync to Google Sheet (Liên kết kiểu 1)
  const handleSyncToGoogleSheet = async () => {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      setShowSheetSettings(true);
      return;
    }

    setSyncStatus({ loading: true });

    try {
      // 1. Calculate explicit shares for each otherCost item
      const formattedOtherCosts = otherCosts
        .filter((c) => c.amount > 0)
        .map((oc) => {
          let shares: { memberId: string; amount: number }[] = [];
          if (oc.splitType === 'custom') {
            const bens = oc.beneficiaryIds.length > 0 ? oc.beneficiaryIds : [oc.paidBy];
            shares = calculateWeightedSplit(
              oc.amount,
              bens.map((id) => ({ memberId: id, weight: 1 }))
            );
          } else if (oc.splitType === 'debt') {
            shares = [{ memberId: oc.debtorId || oc.paidBy, amount: oc.amount }];
          } else {
            shares = calculateWeightedSplit(
              oc.amount,
              allParticipants.map((p) => ({ memberId: p.id, weight: p.weight }))
            );
          }

          return {
            title: oc.title,
            category: 'drink' as const,
            amount: oc.amount,
            paidBy: oc.paidBy,
            shares,
          };
        });

      // 2. Save session locally
      createSession({
        date,
        title: title.trim() || undefined,
        participants: allParticipants.map((p) => ({
          memberId: p.id,
          weight: p.weight,
        })),
        courtCost: courtAmount > 0 ? { amount: courtAmount, paidBy: courtPaidBy } : undefined,
        shuttleCost:
          calculatedShuttleAmount > 0
            ? {
                qty: shuttleQty,
                paidBy: shuttlePaidBy,
                tubePrice: customTubePrice,
              }
            : undefined,
        otherCosts: formattedOtherCosts,
      });

      // 3. Prepare Google Sheet Payload
      const dateObj = new Date(date);
      const day = ('0' + dateObj.getDate()).slice(-2);
      const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
      const tabName = `${day}${month}`;

      const expenseList = [
        {
          title: 'Tiền sân',
          amount: courtAmount,
          paidBy: members.find((m) => m.id === courtPaidBy)?.displayName || 'Toàn',
        },
        {
          title:
            shuttleInputMode === 'qty'
              ? `Tiền cầu (${shuttleQty} quả)`
              : 'Tiền cầu',
          amount: calculatedShuttleAmount,
          paidBy: members.find((m) => m.id === shuttlePaidBy)?.displayName || 'Toàn',
        },
        ...otherCosts.map((oc) => {
          const payer = members.find((m) => m.id === oc.paidBy)?.displayName || 'Thành viên';
          let note = oc.title;
          if (oc.splitType === 'custom') {
            const names = oc.beneficiaryIds
              .map((id) => members.find((m) => m.id === id)?.displayName || id)
              .join(', ');
            note = `${oc.title} (chia: ${names})`;
          } else if (oc.splitType === 'debt') {
            const debtor = members.find((m) => m.id === oc.debtorId)?.displayName || 'Thành viên';
            note = `${oc.title} (${debtor} nợ riêng)`;
          }
          return {
            title: note,
            amount: oc.amount,
            paidBy: payer,
          };
        }),
      ].filter((e) => e.amount > 0);

      const memberList = Object.values(sessionBalances).map((b) => ({
        name: b.name,
        weight: b.weight,
        paid: b.paid,
        share: b.totalShare,
        net: b.net,
      }));

      const transferList = transfers.map((t) => {
        const fromName =
          allInvolvedMembers.find((p) => p.id === t.fromMemberId)?.name || 'Thành viên';
        const toName =
          allInvolvedMembers.find((p) => p.id === t.toMemberId)?.name || 'Thành viên';
        return {
          from: fromName,
          to: toName,
          amount: t.amount,
          note: `${fromName} chuyen tien cau ${day}/${month}`,
        };
      });

      await syncSessionToGoogleSheet(webhookUrl, {
        date,
        sheetName: tabName,
        title: title.trim() || undefined,
        totalCost: grandTotal,
        totalShares,
        costPerShare,
        expenses: expenseList,
        members: memberList,
        transfers: transferList,
      });

      setSyncStatus({
        loading: false,
        success: true,
        message: `Đã lưu & tạo tab "${tabName}" trên Google Sheet thành công!`,
      });
      setTimeout(() => {
        setSyncStatus((s) => ({ ...s, success: false }));
      }, 5000);
    } catch (err: any) {
      setSyncStatus({
        loading: false,
        success: false,
        message: err.message || 'Lỗi khi đồng bộ Google Sheet',
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* HEADER BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🏸</span>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Tính Tiền Buổi Cầu Lông</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Điền chi phí bên trái ➜ Kết quả chia tiền & Mã QR tự động tính ngay bên phải
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowSheetSettings(true)}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor: webhookUrl ? 'rgba(16, 185, 129, 0.4)' : undefined,
              color: webhookUrl ? 'var(--accent-mint)' : undefined,
            }}
          >
            <FileSpreadsheet size={15} />
            {webhookUrl ? 'Google Sheet: Đã kết nối' : 'Kết nối Google Sheet'}
          </button>

          <Link href="/sessions" className="btn btn-secondary btn-sm">
            <History size={15} /> Lịch sử
          </Link>
        </div>
      </div>

      {/* SYNC NOTIFICATION BANNER */}
      {syncStatus.message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: syncStatus.success
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${
              syncStatus.success ? 'var(--color-credit)' : 'var(--color-debt)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 600,
            color: syncStatus.success ? 'var(--accent-mint-light)' : '#fda4af',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {syncStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus({ loading: false })}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* MAIN 2-COLUMN SPLIT GRID */}
      <div className="split-grid">
        {/* ========================================================
            CỘT TRÁI: ĐIỀN THÔNG TIN BUỔI CẦU
        ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Ngày & Tên buổi */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--accent-mint-light)',
              }}
            >
              <Calendar size={17} /> 1. Thời gian & Địa điểm
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="input-label">Ngày đánh</label>
                <input
                  type="date"
                  className="input-field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Tên / Ghi chú (tùy chọn)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ví dụ: Sân Thăng Long..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Ai đi đánh cầu? (Danh sách & Số suất) */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--accent-mint-light)',
                }}
              >
                <Users size={17} /> 2. Người tham gia ({allParticipants.length} người /{' '}
                {totalShares} suất)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Bấm để tick chọn đi / nghỉ
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '10px',
              }}
            >
              {members.map((m) => {
                const currentWeight = selectedWeights[m.id] || 0;
                const isSelected = currentWeight > 0;

                return (
                  <div
                    key={m.id}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      padding: '10px',
                      border: `1.5px solid ${
                        isSelected ? 'var(--accent-mint)' : 'var(--border-subtle)'
                      }`,
                      background: isSelected
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'var(--bg-input)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      onClick={() => toggleMember(m.id, m.defaultWeight)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${
                            isSelected ? 'var(--accent-mint)' : 'var(--text-muted)'
                          }`,
                          background: isSelected ? 'var(--accent-mint)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '11px',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {m.displayName}
                      </span>
                    </div>

                    {/* Weight adjustments when selected */}
                    {isSelected && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingTop: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Suất:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => adjustWeight(m.id, -1)}
                            disabled={currentWeight <= 1}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              cursor: currentWeight <= 1 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              fontWeight: 700,
                              color: 'var(--accent-mint)',
                              minWidth: '16px',
                              textAlign: 'center',
                            }}
                          >
                            {currentWeight}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustWeight(m.id, 1)}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Guests List */}
            {customGuests.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {customGuests.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 'var(--radius-full)',
                      padding: '4px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <span>
                      {g.name} ({g.weight} suất)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGuest(g.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add extra guest */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input
                type="text"
                placeholder="+ Thêm bạn/khách đi cùng..."
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                className="input-field"
                style={{ fontSize: '12px', padding: '8px 12px' }}
              />
              <button
                type="button"
                onClick={addGuest}
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0 }}
              >
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          {/* Card 3: Chi phí (Tiền sân, Cầu, Nước nhóm nhỏ, Nợ riêng) */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--accent-mint-light)',
              }}
            >
              <CreditCard size={17} /> 3. Các khoản chi phí & Nợ riêng
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tiền sân */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>🏟️ Tiền sân (chia cả nhóm)</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-mint)' }}>
                    {formatVND(courtAmount)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Số tiền (VNĐ)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      className="input-field"
                      value={courtAmount}
                      onChange={(e) => setCourtAmount(Number(e.target.value) || 0)}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Ai trả tiền trước?
                    </label>
                    <select
                      className="input-field"
                      value={courtPaidBy}
                      onChange={(e) => setCourtPaidBy(e.target.value)}
                      style={{ fontSize: '13px' }}
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tiền cầu */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>🏸 Tiền quả cầu (chia cả nhóm)</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-mint)' }}>
                    {formatVND(calculatedShuttleAmount)}
                  </span>
                </div>

                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShuttleInputMode('qty')}
                    className={`btn btn-sm ${
                      shuttleInputMode === 'qty' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    Tính theo số quả dùng
                  </button>
                  <button
                    type="button"
                    onClick={() => setShuttleInputMode('amount')}
                    className={`btn btn-sm ${
                      shuttleInputMode === 'amount' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    Nhập số tiền trực tiếp
                  </button>
                </div>

                {shuttleInputMode === 'qty' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Số quả đánh ({shuttleQty} quả)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        className="input-field"
                        value={shuttleQty}
                        onChange={(e) => setShuttleQty(Number(e.target.value) || 0)}
                        style={{ fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Hộp 12 quả: {formatVND(customTubePrice)} (≈ 28.333đ/quả)
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Ai trả tiền cầu?
                      </label>
                      <select
                        className="input-field"
                        value={shuttlePaidBy}
                        onChange={(e) => setShuttlePaidBy(e.target.value)}
                        style={{ fontSize: '13px' }}
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Số tiền cầu (VNĐ)
                      </label>
                      <input
                        type="number"
                        step={1000}
                        className="input-field"
                        value={directShuttleAmount}
                        onChange={(e) => setDirectShuttleAmount(Number(e.target.value) || 0)}
                        style={{ fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Ai trả tiền cầu?
                      </label>
                      <select
                        className="input-field"
                        value={shuttlePaidBy}
                        onChange={(e) => setShuttlePaidBy(e.target.value)}
                        style={{ fontSize: '13px' }}
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* CHI PHÍ RIÊNG & NỢ (NƯỚC NHÓM NHỎ, NỢ 2 NGƯỜI) */}
              {otherCosts.map((oc, index) => {
                const payerName = members.find((m) => m.id === oc.paidBy)?.displayName || 'Người ứng';

                return (
                  <div
                    key={oc.id}
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {/* Header: Title + Amount + Payer + Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Khoản chi thêm #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOtherCost(oc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-debt)',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tên khoản chi</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Nước uống / Cơm trưa..."
                          value={oc.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOtherCosts((prev) =>
                              prev.map((c) => (c.id === oc.id ? { ...c, title: val } : c))
                            );
                          }}
                          style={{ fontSize: '12px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Số tiền (VNĐ)</label>
                        <input
                          type="number"
                          step={5000}
                          className="input-field"
                          value={oc.amount}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setOtherCosts((prev) =>
                              prev.map((c) => (c.id === oc.id ? { ...c, amount: val } : c))
                            );
                          }}
                          style={{ fontSize: '12px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ai ứng trước?</label>
                        <select
                          className="input-field"
                          value={oc.paidBy}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOtherCosts((prev) =>
                              prev.map((c) => (c.id === oc.id ? { ...c, paidBy: val } : c))
                            );
                          }}
                          style={{ fontSize: '12px' }}
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Split Type Selector */}
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Cách phân chia tiền:
                      </label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setOtherCosts((prev) =>
                              prev.map((c) => (c.id === oc.id ? { ...c, splitType: 'all' } : c))
                            )
                          }
                          className={`btn btn-sm ${oc.splitType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          👥 Cả nhóm đi cầu
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOtherCosts((prev) =>
                              prev.map((c) =>
                                c.id === oc.id
                                  ? {
                                      ...c,
                                      splitType: 'custom',
                                      beneficiaryIds:
                                        c.beneficiaryIds.length > 0
                                          ? c.beneficiaryIds
                                          : [oc.paidBy, 'kien', 'tu'].filter(Boolean),
                                    }
                                  : c
                              )
                            )
                          }
                          className={`btn btn-sm ${oc.splitType === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          👤👤 Nhóm nhỏ (Toàn, Kiên, Tú...)
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOtherCosts((prev) =>
                              prev.map((c) =>
                                c.id === oc.id
                                  ? {
                                      ...c,
                                      splitType: 'debt',
                                      debtorId: c.debtorId || (oc.paidBy === 'toan' ? 'kien' : 'toan'),
                                    }
                                  : c
                              )
                            )
                          }
                          className={`btn btn-sm ${oc.splitType === 'debt' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          🤝 Nợ riêng 2 người (Ai nợ ai)
                        </button>
                      </div>
                    </div>

                    {/* If 'custom': Member selection chips */}
                    {oc.splitType === 'custom' && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Tick chọn những người cùng uống nước / chia tiền:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {members.map((m) => {
                            const isIncluded = oc.beneficiaryIds.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleBeneficiary(oc.id, m.id)}
                                style={{
                                  border: `1px solid ${
                                    isIncluded ? 'var(--accent-mint)' : 'var(--border-subtle)'
                                  }`,
                                  background: isIncluded ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                                  color: isIncluded ? 'var(--accent-mint-light)' : 'var(--text-muted)',
                                  borderRadius: 'var(--radius-full)',
                                  padding: '3px 10px',
                                  fontSize: '11px',
                                  fontWeight: isIncluded ? 700 : 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isIncluded ? <Check size={11} strokeWidth={3} /> : null}
                                {m.displayName}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-mint-light)', marginTop: '4px' }}>
                          ✓ {payerName} trả {formatVND(oc.amount)} ➜ Chia đều cho{' '}
                          <strong>{oc.beneficiaryIds.length} người</strong> (≈{' '}
                          {formatVND(
                            oc.beneficiaryIds.length > 0
                              ? Math.round(oc.amount / oc.beneficiaryIds.length)
                              : oc.amount
                          )}
                          /người)
                        </div>
                      </div>
                    )}

                    {/* If 'debt': 1-on-1 debt selector */}
                    {oc.splitType === 'debt' && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          border: '1px solid rgba(244, 63, 94, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ai nợ:</span>
                          <select
                            className="input-field"
                            value={oc.debtorId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOtherCosts((prev) =>
                                prev.map((c) => (c.id === oc.id ? { ...c, debtorId: val } : c))
                              );
                            }}
                            style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.displayName}
                              </option>
                            ))}
                          </select>

                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            nợ <strong>{payerName}</strong>:
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#fda4af' }}>
                            {formatVND(oc.amount)}
                          </span>
                        </div>

                        <div style={{ fontSize: '11px', color: '#fda4af', marginTop: '2px' }}>
                          ➜ Khoản này sẽ được cộng thẳng vào số tiền chuyển khoản giữa 2 người (bù trừ tự động).
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* NÚT THÊM NHANH KHOẢN CHI & NỢ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    addOtherCost(
                      'Nước uống',
                      45000,
                      'custom',
                      ['toan', 'kien', 'tu'].filter(Boolean)
                    )
                  }
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                >
                  <Plus size={13} /> + Nước 3 người (Toàn, Kiên, Tú: 45k)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    addOtherCost(
                      'Khoản nợ riêng',
                      50000,
                      'debt',
                      [],
                      'kien'
                    )
                  }
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                >
                  <HandCoins size={13} /> + Nợ riêng 2 người (Ai nợ ai)
                </button>

                <button
                  type="button"
                  onClick={() => addOtherCost('Đồ ăn / Chi phí khác', 40000, 'all')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px' }}
                >
                  <Plus size={13} /> + Khoản chia cả nhóm
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            CỘT PHẢI: KẾT QUẢ CHIA TIỀN TỰ ĐỘNG (REALTIME OUTPUT)
        ======================================================== */}
        <div className="sticky-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Tổng quan buổi cầu */}
          <div
            className="glass-card"
            style={{
              padding: '20px',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.9), rgba(6, 78, 59, 0.2))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--accent-mint)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                Kết quả tính toán
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {totalShares} suất cầu ({allInvolvedMembers.length} người)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatVND(grandTotal)}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>tổng chi</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mỗi suất sân + cầu</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-mint-light)' }}>
                  {formatVND(costPerShare)}
                  <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                    {' '}
                    / suất
                  </span>
                </div>
              </div>

              {/* Nút Copy Zalo nhanh */}
              <button
                type="button"
                onClick={handleCopyZalo}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {copiedZalo ? <Check size={14} /> : <Copy size={14} />}
                {copiedZalo ? 'Đã copy tin nhắn!' : 'Copy tin nhắn Zalo'}
              </button>
            </div>
          </div>

          {/* Card Ai chuyển cho ai & Mã QR */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--accent-mint-light)',
              }}
            >
              <QrCode size={17} /> Danh sách chuyển khoản ({transfers.length} giao dịch)
            </h3>

            {transfers.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 12px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                {grandTotal === 0
                  ? 'Hãy nhập chi phí bên trái để xem kết quả.'
                  : '✅ Mọi người đã hòa tiền, không cần chuyển khoản!'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transfers.map((t, idx) => {
                  const fromName =
                    allInvolvedMembers.find((p) => p.id === t.fromMemberId)?.name ||
                    'Thành viên';
                  const toMember = members.find((m) => m.id === t.toMemberId);
                  const toName = toMember?.displayName || 'Thành viên';

                  const qrUrl = getVietQrUrl(
                    toMember,
                    t.amount,
                    `${fromName} chuyen tien cau`
                  );

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>
                          <span style={{ color: '#fda4af' }}>{fromName}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>➜</span>
                          <span style={{ color: 'var(--accent-mint-light)' }}>{toName}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {toMember?.bankName ? `${toMember.bankName} - ${toMember.bankAccountNo}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {formatVND(t.amount)}
                        </div>

                        {qrUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setZoomedQr({
                                receiverName: toName,
                                bankName: toMember?.bankName || 'Ngân hàng',
                                accountNo: toMember?.bankAccountNo || '',
                                amount: t.amount,
                                qrUrl,
                              })
                            }
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 8px', fontSize: '11px' }}
                            title="Xem mã QR quét chuyển khoản"
                          >
                            <QrCode size={14} /> Mã QR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card Bảng phân chia từng người */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '10px',
                color: 'var(--text-secondary)',
              }}
            >
              Chi tiết từng người (Đã bao gồm nợ & nước riêng)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '6px 4px' }}>Tên</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center' }}>Suất</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Đã ứng</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Phải trả</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(sessionBalances).map((b, idx) => {
                    const isCredit = b.net > 0;
                    const isDebit = b.net < 0;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {b.weight > 0 ? b.weight : '—'}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          {b.paid > 0 ? formatVND(b.paid) : '0đ'}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          {formatVND(b.totalShare)}
                        </td>
                        <td
                          style={{
                            padding: '8px 4px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isCredit
                              ? 'var(--color-credit)'
                              : isDebit
                              ? 'var(--color-debt)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {isCredit ? `+${formatVND(b.net)}` : isDebit ? formatVND(b.net) : '0đ'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MAIN BUTTON: LƯU & ĐỒNG BỘ GOOGLE SHEET */}
          <button
            type="button"
            onClick={handleSyncToGoogleSheet}
            disabled={syncStatus.loading || grandTotal <= 0}
            className="btn btn-primary"
            style={{
              padding: '16px',
              fontSize: '15px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <FileSpreadsheet size={20} />
            {syncStatus.loading
              ? 'Đang gửi sang Google Sheet...'
              : 'Lưu & Đẩy Sang Google Sheet'}
          </button>
        </div>
      </div>

      {/* ========================================================
          MODAL: PHÓNG TO MÃ QR CHUYỂN KHOẢN
      ======================================================== */}
      {zoomedQr && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setZoomedQr(null)}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              textAlign: 'center',
              position: 'relative',
              background: '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedQr(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>
              Quét mã chuyển cho {zoomedQr.receiverName}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Số tiền:{' '}
              <strong style={{ color: 'var(--accent-mint)', fontSize: '15px' }}>
                {formatVND(zoomedQr.amount)}
              </strong>
            </p>

            <div
              style={{
                background: '#fff',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                display: 'inline-block',
                marginBottom: '16px',
              }}
            >
              <img
                src={zoomedQr.qrUrl}
                alt="QR Chuyển khoản"
                style={{ width: '220px', height: '220px', objectFit: 'contain' }}
              />
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div>
                Ngân hàng: <strong>{zoomedQr.bankName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  STK: <strong>{zoomedQr.accountNo}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(zoomedQr.accountNo)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  Copy STK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CÀI ĐẶT LIÊN KẾT GOOGLE SHEET (WEBHOOK)
      ======================================================== */}
      {showSheetSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowSheetSettings(false)}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              position: 'relative',
              background: '#0f172a',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSheetSettings(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileSpreadsheet size={22} color="var(--accent-mint)" />
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Liên Kết Google Sheet Tự Động</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Chỉ cần cấu hình 1 lần, mỗi khi bạn bấm &quot;Lưu & Đẩy Sang Google Sheet&quot;, hệ thống
              sẽ tự động tạo tab mới theo ngày và điền bảng chi tiết.
            </p>

            {/* Bước 1: Dán URL Webhook */}
            <div style={{ marginBottom: '20px' }}>
              <label className="input-label" style={{ fontWeight: 700 }}>
                1. Dán URL Webhook Google Apps Script của bạn:
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookUrl}
                onChange={(e) => handleSaveWebhook(e.target.value)}
                style={{ fontSize: '13px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--accent-mint)', marginTop: '4px', display: 'block' }}>
                {webhookUrl ? '✓ Đã lưu URL vào trình duyệt của bạn.' : 'Chưa có URL? Xem hướng dẫn 1 phút bên dưới.'}
              </span>
            </div>

            {/* Hướng dẫn 3 bước */}
            <div
              style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '12px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                📖 Hướng dẫn lấy URL Webhook (chỉ mất 1 phút):
              </div>
              <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  Mở file Google Sheet của nhóm bạn.
                </li>
                <li>
                  Vào menu <strong>Tiện ích mở rộng (Extensions)</strong> ➜ chọn <strong>Apps Script</strong>.
                </li>
                <li>
                  Xóa code cũ, dán đoạn mã bên dưới vào và bấm <strong>Lưu</strong> (biểu tượng đĩa mềm).
                </li>
                <li>
                  Bấm nút <strong>Triển khai (Deploy)</strong> ➜ <strong>Tùy chọn triển khai mới (New deployment)</strong>.
                </li>
                <li>
                  Bấm bánh răng ➜ Chọn <strong>Ứng dụng web (Web App)</strong>.
                  <br />- Mục <em>Ai có quyền truy cập (Who has access)</em>: chọn <strong>Bất kỳ ai (Anyone)</strong>.
                </li>
                <li>
                  Bấm <strong>Triển khai</strong> và <strong>Sao chép URL ứng dụng web</strong> dán vào ô bên trên!
                </li>
              </ol>

              {/* Nút copy mã Apps Script */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
                  setScriptCopied(true);
                  setTimeout(() => setScriptCopied(false), 2500);
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
              >
                {scriptCopied ? <Check size={14} /> : <Copy size={14} />}
                {scriptCopied ? 'Đã copy mã Apps Script!' : 'Copy mã Google Apps Script mẫu'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSheetSettings(false)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Hoàn tất & Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
