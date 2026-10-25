'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/useStore';
import {
  Home,
  Calendar,
  Plus,
  ArrowRightLeft,
  User,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';

export default function ClientNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentMember, members, switchUser } = useStore();
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  return (
    <>
      {/* Top Navigation */}
      <header className="top-nav">
        <Link href="/" className="brand-badge">
          <div className="brand-icon">🏸</div>
          <div>
            <div className="brand-title">Lighter Badminton</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Sổ chi phí liên tục
            </div>
          </div>
        </Link>

        {/* User Badge / Switcher */}
        <button
          className="user-switch-badge"
          onClick={() => setShowSwitchModal(true)}
          title="Đổi người dùng đang xem"
        >
          <div
            className="user-avatar-dot"
            style={{ backgroundColor: currentMember?.avatarColor || '#10b981' }}
          >
            {currentMember?.displayName?.charAt(0) || 'U'}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {currentMember?.displayName || 'Thành viên'}
          </span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>
      </header>

      {/* Main Page Content */}
      <main style={{ padding: '16px 16px 20px', flex: 1 }}>{children}</main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <Link
            href="/"
            className={`nav-item ${pathname === '/' ? 'active' : ''}`}
          >
            <Home size={20} />
            <span>Tổng quan</span>
          </Link>

          <Link
            href="/sessions"
            className={`nav-item ${pathname.startsWith('/sessions') && pathname !== '/sessions/new' ? 'active' : ''}`}
          >
            <Calendar size={20} />
            <span>Buổi cầu</span>
          </Link>

          <Link
            href="/sessions/new"
            className="nav-item nav-fab-btn"
            title="Tạo nhanh buổi cầu mới"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>

          <Link
            href="/settle"
            className={`nav-item ${pathname.startsWith('/settle') ? 'active' : ''}`}
          >
            <ArrowRightLeft size={20} />
            <span>Thanh toán</span>
          </Link>

          <Link
            href="/profile"
            className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}
          >
            <User size={20} />
            <span>Cá nhân</span>
          </Link>
        </div>
      </nav>

      {/* User Switch Modal */}
      {showSwitchModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowSwitchModal(false)}
        >
          <div
            className="modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                  Chọn thành viên đang thao tác
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Chuyển quyền để xem số dư, trả tiền hộ hoặc nhận thanh toán
                </p>
              </div>
              <button
                onClick={() => setShowSwitchModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map((m) => {
                const isSelected = m.id === currentMember?.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      switchUser(m.id);
                      setShowSwitchModal(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'var(--bg-input)',
                      border: `1px solid ${
                        isSelected ? 'var(--accent-mint)' : 'var(--border-subtle)'
                      }`,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: m.avatarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        {m.displayName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>
                          {m.displayName}
                          {m.role === 'admin' && (
                            <span
                              style={{
                                marginLeft: '6px',
                                fontSize: '10px',
                                background: 'rgba(255,255,255,0.1)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Thủ quỹ
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {m.defaultWeight === 2 ? 'Cặp đôi (2 suất)' : '1 suất'} •{' '}
                          {m.bankName || 'Chưa cập nhật NH'}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        style={{
                          color: 'var(--accent-mint)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Check size={18} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
