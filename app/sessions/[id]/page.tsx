'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/useStore';
import { formatVND, formatDate, generateZaloSummary } from '@/lib/engine/format';
import {
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Unlock,
  Trash2,
  Calendar,
  Users,
  CreditCard,
  Share2,
} from 'lucide-react';

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const {
    sessions,
    expenses,
    members,
    lockSession,
    deleteSession,
  } = useStore();

  const [copied, setCopied] = useState(false);

  const session = sessions.find((s) => s.id === sessionId);
  const sessionExpenses = expenses.filter((e) => e.sessionId === sessionId);

  if (!session) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Không tìm thấy buổi cầu này.
        </p>
        <Link href="/sessions" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const totalCost = sessionExpenses.reduce((s, e) => s + e.amount, 0);
  const totalShares = session.participants.reduce((s, p) => s + p.weight, 0);
  const costPerShare = totalShares > 0 ? Math.round(totalCost / totalShares) : 0;

  // Aggregate shares per participant in this session
  const participantSummary: Record<string, { weight: number; shareAmount: number; paidAmount: number }> = {};
  for (const p of session.participants) {
    participantSummary[p.memberId] = {
      weight: p.weight,
      shareAmount: 0,
      paidAmount: 0,
    };
  }

  for (const exp of sessionExpenses) {
    if (participantSummary[exp.paidBy]) {
      participantSummary[exp.paidBy].paidAmount += exp.amount;
    }
    for (const sh of exp.shares) {
      if (participantSummary[sh.memberId]) {
        participantSummary[sh.memberId].shareAmount += sh.amount;
      }
    }
  }

  // Handle Copy Zalo Summary
  const handleCopyZalo = async () => {
    const summaryText = generateZaloSummary({
      date: formatDate(session.date),
      totalShares,
      expenses: sessionExpenses.map((e) => {
        const payer = members.find((m) => m.id === e.paidBy);
        return {
          title: e.title,
          amount: e.amount,
          paidByName: payer?.displayName || 'Thành viên',
        };
      }),
      costPerShare,
      transfers: [], // Will link to full settle page
      appUrl: window.location.origin + '/settle',
    });

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc chắn muốn xoá buổi cầu này và các khoản chi liên quan?')) {
      deleteSession(sessionId);
      router.push('/sessions');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href="/sessions"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          <ArrowLeft size={16} /> Quay lại
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyZalo}
          >
            {copied ? (
              <>
                <Check size={14} color="var(--accent-mint)" />
                <span style={{ color: 'var(--accent-mint)' }}>Đã copy tin Zalo!</span>
              </>
            ) : (
              <>
                <Copy size={14} /> Copy tin nhắn Zalo
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--color-debt)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            onClick={handleDelete}
            title="Xoá buổi này"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Session Banner */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--accent-mint)', fontWeight: 600 }}>
              {formatDate(session.date)}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {session.title || `Buổi cầu ${formatDate(session.date)}`}
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {session.participants.length} người tham gia • {totalShares} suất
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tổng chi phí:</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatVND(totalCost)}
            </div>
            {costPerShare > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--accent-mint)' }}>
                ~{formatVND(costPerShare)}/suất
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Items in this Session */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
          Các khoản chi trong buổi ({sessionExpenses.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessionExpenses.map((exp) => {
            const payer = members.find((m) => m.id === exp.paidBy);
            return (
              <div key={exp.id} className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{exp.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Ứng bởi: <strong style={{ color: 'var(--text-primary)' }}>{payer?.displayName}</strong>
                      {exp.splitMethod === 'shuttle' && exp.shuttleQty && (
                        <span> • {exp.shuttleQty} quả</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                    {formatVND(exp.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Participant Breakdown Matrix */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
          Phần chia chi tiết từng người
        </h3>

        <div className="glass-card" style={{ padding: '6px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {session.participants.map((p, idx) => {
              const m = members.find((x) => x.id === p.memberId);
              const summary = participantSummary[p.memberId] || { weight: 1, shareAmount: 0, paidAmount: 0 };
              const netSession = summary.paidAmount - summary.shareAmount;

              return (
                <div
                  key={p.memberId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom:
                      idx < session.participants.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: m?.avatarColor || '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      {m?.displayName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {m?.displayName}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ({p.weight} suất)
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Đã ứng: {formatVND(summary.paidAmount)} • Phải trả: {formatVND(summary.shareAmount)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color:
                          netSession > 0
                            ? 'var(--color-credit)'
                            : netSession < 0
                            ? 'var(--color-debt)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {formatVND(netSession, true)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {netSession > 0 ? 'Nhận lại' : netSession < 0 ? 'Phải trả thêm' : 'Khớp'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
