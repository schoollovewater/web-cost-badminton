'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/useStore';
import { formatVND, formatDate } from '@/lib/engine/format';
import {
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Plus,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    currentMember,
    members,
    sessions,
    expenses,
    transfers,
    balances,
    state,
    confirmTransfer,
    rejectTransfer,
  } = useStore();

  const myBalance = balances[currentMember?.id]?.balance || 0;
  const isDone = Math.abs(myBalance) < state.settings.doneTolerance;
  const isCreditor = myBalance >= state.settings.doneTolerance;
  const isDebtor = myBalance <= -state.settings.doneTolerance;

  // Pending transfers where current member is the receiver (to confirm)
  const incomingPending = transfers.filter(
    (t) => t.toMemberId === currentMember?.id && t.status === 'pending'
  );

  // Pending transfers sent by current member
  const outgoingPending = transfers.filter(
    (t) => t.fromMemberId === currentMember?.id && t.status === 'pending'
  );

  // Invariant check: total group sum
  const groupSum = Object.values(balances).reduce((s, b) => s + b.balance, 0);

  // Sorted members by balance ascending (debtors first, creditors last)
  const sortedMembers = [...members].sort((a, b) => {
    const balA = balances[a.id]?.balance || 0;
    const balB = balances[b.id]?.balance || 0;
    return balA - balB;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. HERO BALANCE CARD */}
      <div
        className="glass-card"
        style={{
          background: isCreditor
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : isDebtor
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(17, 24, 39, 0.85) 100%)',
          borderColor: isCreditor
            ? 'rgba(16, 185, 129, 0.35)'
            : isDebtor
            ? 'rgba(244, 63, 94, 0.35)'
            : 'rgba(56, 189, 248, 0.35)',
          padding: '24px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Số dư hiện tại của bạn
          </span>
          <div
            className={`badge ${
              isCreditor ? 'badge-credit' : isDebtor ? 'badge-debt' : 'badge-done'
            }`}
          >
            {isCreditor ? (
              <>
                <TrendingUp size={12} /> Được nhận
              </>
            ) : isDebtor ? (
              <>
                <TrendingDown size={12} /> Cần chuyển
              </>
            ) : (
              <>
                <CheckCircle2 size={12} /> Đã cân bằng
              </>
            )}
          </div>
        </div>

        <div style={{ margin: '8px 0 16px' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '-1px',
              color: isCreditor
                ? 'var(--color-credit)'
                : isDebtor
                ? 'var(--color-debt)'
                : 'var(--color-done)',
            }}
          >
            {formatVND(myBalance, true)}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isCreditor
              ? 'Mọi người sẽ chuyển khoản cho bạn theo gợi ý thanh toán.'
              : isDebtor
              ? 'Hãy mở mục Thanh toán để quét mã QR và trả tiền.'
              : 'Tuyệt vời! Bạn không còn dư nợ nào trong nhóm.'}
          </p>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Link href="/settle" className="btn btn-primary" style={{ padding: '10px 14px' }}>
            <ArrowRightLeft size={16} />
            {isDebtor ? 'Chuyển tiền ngay' : 'Xem thanh toán'}
          </Link>
          <Link href="/sessions/new" className="btn btn-secondary" style={{ padding: '10px 14px' }}>
            <Plus size={16} />
            + Buổi cầu
          </Link>
        </div>
      </div>

      {/* 2. PENDING INCOMING TRANSFERS BOX */}
      {incomingPending.length > 0 && (
        <div
          className="glass-card animate-fade-in"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Clock size={18} color="#f59e0b" />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
              Bạn có {incomingPending.length} khoản chờ xác nhận nhận tiền:
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {incomingPending.map((t) => {
              const sender = members.find((m) => m.id === t.fromMemberId);
              return (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--bg-input)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {sender?.displayName || 'Thành viên'} ➜ Bạn
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-credit)', marginTop: '2px' }}>
                        {formatVND(t.amount)}
                      </div>
                      {t.note && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Lời nhắn: {t.note}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => confirmTransfer(t.id)}
                    >
                      <CheckCircle2 size={14} /> Đã nhận được
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const reason = prompt('Lý do chưa nhận được:', 'Chưa thấy tiền vào tài khoản');
                        if (reason) rejectTransfer(t.id, reason);
                      }}
                    >
                      Chưa nhận
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. GROUP BALANCE OVERVIEW */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Số dư toàn nhóm</h3>
          <div
            style={{
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: groupSum === 0 ? 'var(--color-credit)' : 'var(--color-debt)',
              background: groupSum === 0 ? 'var(--color-credit-bg)' : 'var(--color-debt-bg)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <ShieldCheck size={12} />
            {groupSum === 0 ? 'Sổ cái cân bằng (0đ)' : `Lệch: ${formatVND(groupSum)}`}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sortedMembers.map((m, idx) => {
              const mb = balances[m.id];
              const bal = mb?.balance || 0;
              const isMySelf = m.id === currentMember?.id;
              const isMemberCreditor = bal >= state.settings.doneTolerance;
              const isMemberDebtor = bal <= -state.settings.doneTolerance;

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 6px',
                    borderBottom:
                      idx < sortedMembers.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: m.avatarColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {m.displayName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: isMySelf ? 700 : 500, fontSize: '14px' }}>
                        {m.displayName} {isMySelf && <span style={{ color: 'var(--accent-mint)' }}>(Bạn)</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Đã chi: {formatVND(mb?.totalPaid || 0)} • Nợ: {formatVND(mb?.totalOwed || 0)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: isMemberCreditor
                          ? 'var(--color-credit)'
                          : isMemberDebtor
                          ? 'var(--color-debt)'
                          : 'var(--color-done)',
                      }}
                    >
                      {formatVND(bal, true)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {isMemberCreditor ? 'Được nhận' : isMemberDebtor ? 'Cần chuyển' : 'Đã xong ✓'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. RECENT SESSIONS */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Buổi cầu gần đây</h3>
          <Link
            href="/sessions"
            style={{
              fontSize: '13px',
              color: 'var(--accent-mint)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Xem tất cả
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              Chưa có buổi cầu nào được tạo.
            </p>
            <Link href="/sessions/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> Tạo buổi cầu đầu tiên
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.slice(0, 3).map((session) => {
              const sessionExpenses = expenses.filter((e) => e.sessionId === session.id);
              const totalCost = sessionExpenses.reduce((s, e) => s + e.amount, 0);

              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="glass-card interactive" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          {session.title || `Buổi cầu ${formatDate(session.date)}`}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatDate(session.date)} • {session.participants.length} người tham gia
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {formatVND(totalCost)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-mint)' }}>
                          {sessionExpenses.length} khoản chi
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
