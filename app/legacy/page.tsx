'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatVND } from '@/lib/engine/format';
import legacySheets from '@/lib/legacyData.json';
import {
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
} from 'lucide-react';

interface LegacySheetItem {
  sheetName: string;
  members: string[];
  expenses: { title: string; amount: number; paidBy: string; shares: Record<string, number> }[];
  debtBalances: Record<string, number>;
  totalDebtSum: number;
}

const sheets = legacySheets as unknown as LegacySheetItem[];

export default function LegacySheetsPage() {
  const [selectedSheetName, setSelectedSheetName] = useState<string>(
    sheets[0]?.sheetName || '1010'
  );

  const currentSheet =
    sheets.find((s) => s.sheetName === selectedSheetName) ||
    sheets[0];

  const hasMismatch = Math.abs(currentSheet?.totalDebtSum || 0) > 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link
          href="/profile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 style={{ fontSize: '19px', fontWeight: 800 }}>
            Kho lưu trữ 20 Sheet Excel cũ
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tra cứu lịch sử và kiểm tra tính cân đối từng đợt chốt trong file gốc
          </p>
        </div>
      </div>

      {/* Sheet Tabs horizontal scroller */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '6px',
        }}
      >
        {sheets.map((s) => {
          const isSelected = s.sheetName === selectedSheetName;
          const isLech = Math.abs(s.totalDebtSum) > 1000;
          return (
            <button
              key={s.sheetName}
              type="button"
              onClick={() => setSelectedSheetName(s.sheetName)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                background: isSelected ? 'var(--accent-mint)' : 'var(--bg-input)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                border: `1px solid ${
                  isSelected ? 'var(--accent-mint)' : 'var(--border-subtle)'
                }`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Sheet {s.sheetName}</span>
              {isLech && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-debt)',
                  }}
                  title="Có chênh lệch công thức"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Sheet Overview Card */}
      {currentSheet && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800 }}>
                  Đợt chốt: Sheet {currentSheet.sheetName}
                </h3>
                <span
                  className={`badge ${hasMismatch ? 'badge-debt' : 'badge-credit'}`}
                >
                  {hasMismatch ? (
                    <>
                      <AlertTriangle size={12} /> Lệch {formatVND(currentSheet.totalDebtSum)}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} /> Cân đối (0đ)
                    </>
                  )}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {currentSheet.members.length} thành viên • {currentSheet.expenses.length} khoản chi
              </div>
            </div>
          </div>

          {/* Warning and explanation box */}
          {currentSheet.sheetName === '1010' ? (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-mint)', fontWeight: 700, marginBottom: '4px' }}>
                <CheckCircle2 size={16} /> Lỗi lệch 60k này ĐÃ ĐƯỢC FIX trên Sổ cái của Web!
              </div>
              <div>
                Trong file Excel gốc, ô <code>G31</code> (Revice 60.000đ do Kiên trả) bị bỏ quên ngoài công thức <code>SUM</code> nên tổng nợ cả nhóm bị lệch <strong>+60.000đ</strong>.
                <br />
                Trên web app mới, hệ thống <strong>đã tính bổ sung khoản 60k này vào 7 suất</strong> và đưa vào số dư khởi đầu của nhóm trên <strong>Trang chủ</strong> (tổng cân bằng đúng <strong>0đ</strong>).
              </div>
            </div>
          ) : hasMismatch ? (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#fca5a5',
                marginBottom: '14px',
              }}
            >
              <strong>Phát hiện lỗi công thức trong Excel cũ:</strong> Tổng dư nợ của các thành viên trong sheet này không bằng 0 (lệch {formatVND(currentSheet.totalDebtSum)}).
            </div>
          ) : null}

          {/* Members Balance in this Sheet */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700 }}>
                {currentSheet.sheetName === '1010'
                  ? 'Số dư khởi đầu đã fix trên Web (Tổng = 0đ):'
                  : 'Dư nợ ghi nhận trong sheet này:'}
              </h4>
              {currentSheet.sheetName === '1010' && (
                <span className="badge badge-credit">
                  <CheckCircle2 size={12} /> Đã chuẩn hoá 0đ
                </span>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '8px',
              }}
            >
              {currentSheet.members.map((m) => {
                const correctedBalances: Record<string, number> = {
                  'Toàn': -163163,
                  'Trường + Thủy': -17144,
                  'Băng + Tâm': -17142,
                  'Tú': -8571,
                  'Kiên': 246645,
                  'Tạ Ánh': 0,
                  'Quán': -40625,
                };
                const bal =
                  currentSheet.sheetName === '1010' && correctedBalances[m] !== undefined
                    ? correctedBalances[m]
                    : currentSheet.debtBalances?.[m] || 0;
                const oldExcelBal = currentSheet.debtBalances?.[m] || 0;

                return (
                  <div
                    key={m}
                    style={{
                      background: 'var(--bg-input)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {m}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color:
                          bal > 0
                            ? 'var(--color-credit)'
                            : bal < 0
                            ? 'var(--color-debt)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {formatVND(bal, true)}
                    </div>
                    {currentSheet.sheetName === '1010' && oldExcelBal !== bal && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        Excel cũ: {formatVND(oldExcelBal, true)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expenses list in this sheet */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
              Chi tiết các khoản chi:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentSheet.expenses.map((exp, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-input)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{exp.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Ứng bởi: {exp.paidBy || 'Toàn'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    {formatVND(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
