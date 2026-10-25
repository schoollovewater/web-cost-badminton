'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/useStore';
import { formatVND, formatDate } from '@/lib/engine/format';
import { Calendar, Plus, ChevronRight, Lock, Unlock } from 'lucide-react';

export default function SessionsListPage() {
  const { sessions, expenses } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Lịch sử các buổi</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Danh sách tất cả các buổi cầu lông và sự kiện đã tạo
          </p>
        </div>
        <Link href="/sessions/new" className="btn btn-primary btn-sm">
          <Plus size={14} /> + Buổi mới
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 16px' }}>
          <Calendar size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            Chưa có buổi cầu nào được lưu.
          </p>
          <Link href="/sessions/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> Tạo buổi cầu ngay
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map((session) => {
            const sessionExpenses = expenses.filter((e) => e.sessionId === session.id);
            const totalCost = sessionExpenses.reduce((s, e) => s + e.amount, 0);

            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="glass-card interactive" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(16, 185, 129, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-mint)',
                          fontSize: '20px',
                        }}
                      >
                        🏸
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>
                            {session.title || `Buổi cầu ${formatDate(session.date)}`}
                          </span>
                          {session.status === 'locked' && (
                            <Lock size={12} color="var(--text-muted)" />
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatDate(session.date)} • {session.participants.length} người tham gia
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                        {formatVND(totalCost)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>Chi tiết</span>
                        <ChevronRight size={14} />
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
  );
}
