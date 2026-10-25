'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/useStore';
import { formatVND, generateZaloSummary } from '@/lib/engine/format';
import { SettleMode } from '@/lib/engine/types';
import {
  ArrowRightLeft,
  Copy,
  Check,
  QrCode,
  CheckCircle2,
  Clock,
  Upload,
  Eye,
  X,
  CreditCard,
  Share2,
} from 'lucide-react';

export default function SettlePage() {
  const {
    currentMember,
    members,
    transfers,
    balances,
    suggestedTransfers,
    state,
    createTransfer,
    confirmTransfer,
    rejectTransfer,
    updateSettings,
    updateMemberProfile,
  } = useStore();

  const [copiedZalo, setCopiedZalo] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [zoomedQr, setZoomedQr] = useState<{ name: string; url: string } | null>(null);
  const [activeUploadMemberId, setActiveUploadMemberId] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCopyZaloMessage = () => {
    const lines = suggestedTransfers.map((t) => {
      const fromM = members.find((m) => m.id === t.fromMemberId);
      const toM = members.find((m) => m.id === t.toMemberId);
      return {
        fromName: fromM?.displayName || 'Thành viên',
        toName: toM?.displayName || 'Thành viên',
        amount: t.amount,
      };
    });

    const msg = generateZaloSummary({
      date: new Date().toLocaleDateString('vi-VN'),
      totalShares: 0,
      expenses: [],
      transfers: lines,
      appUrl: window.location.origin + '/settle',
    });

    navigator.clipboard.writeText(msg);
    setCopiedZalo(true);
    setTimeout(() => setCopiedZalo(false), 2500);
  };

  // Image QR upload handler
  const handleQrUpload = (memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Vui lòng chọn ảnh có kích thước dưới 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateMemberProfile(memberId, { qrImageData: base64 });
      setActiveUploadMemberId(null);
    };
    reader.readAsDataURL(file);
  };

  const mode = state.settings.defaultSettleMode;

  const setMode = (newMode: SettleMode) => {
    updateSettings({ defaultSettleMode: newMode });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Ai chuyển cho ai & Mã QR</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Hệ thống tự động tính toán để tối ưu hoá số lần chuyển khoản giữa các thành viên
        </p>
      </div>

      {/* Settle Mode Toggle */}
      <div
        className="glass-card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          padding: '6px',
          gap: '6px',
          background: 'var(--bg-input)',
        }}
      >
        <button
          type="button"
          onClick={() => setMode('min_transactions')}
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            background:
              mode === 'min_transactions' ? 'var(--accent-mint)' : 'transparent',
            color: mode === 'min_transactions' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          ⚡ Tối thiểu chuyển khoản
        </button>

        <button
          type="button"
          onClick={() => setMode('via_treasurer')}
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            background:
              mode === 'via_treasurer' ? 'var(--accent-mint)' : 'transparent',
            color: mode === 'via_treasurer' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          🏛️ Qua thủ quỹ (Toàn)
        </button>
      </div>

      {/* Action to Copy Zalo message */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleCopyZaloMessage}
        >
          {copiedZalo ? (
            <>
              <Check size={14} color="var(--accent-mint)" />
              <span style={{ color: 'var(--accent-mint)' }}>Đã copy danh sách chuyển tiền!</span>
            </>
          ) : (
            <>
              <Copy size={14} /> Copy tin nhắn Zalo
            </>
          )}
        </button>
      </div>

      {/* Suggested Transfers List */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
          Giao dịch cần thực hiện ({suggestedTransfers.length})
        </h3>

        {suggestedTransfers.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '36px' }}>
            <CheckCircle2 size={40} color="var(--accent-mint)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700 }}>Mọi người đều đã thanh toán xong!</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Hiện không có khoản nợ nào cần chuyển giữa các thành viên.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {suggestedTransfers.map((st, idx) => {
              const fromM = members.find((m) => m.id === st.fromMemberId);
              const toM = members.find((m) => m.id === st.toMemberId);
              const isMeSender = currentMember.id === st.fromMemberId;
              const isMeReceiver = currentMember.id === st.toMemberId;

              // Check if there is already a pending transfer matching this
              const hasPending = transfers.some(
                (t) =>
                  t.fromMemberId === st.fromMemberId &&
                  t.toMemberId === st.toMemberId &&
                  t.status === 'pending'
              );

              return (
                <div
                  key={`${st.fromMemberId}-${st.toMemberId}-${idx}`}
                  className="glass-card"
                  style={{
                    borderColor: isMeSender
                      ? 'rgba(244, 63, 94, 0.4)'
                      : isMeReceiver
                      ? 'rgba(16, 185, 129, 0.4)'
                      : 'var(--border-subtle)',
                    position: 'relative',
                  }}
                >
                  {/* Top transfer banner */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: fromM?.avatarColor || '#ec4899',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {fromM?.displayName.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>
                        {fromM?.displayName}
                        {isMeSender && <span style={{ color: 'var(--color-debt)', fontSize: '12px' }}> (Bạn)</span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>➜</span>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: toM?.avatarColor || '#10b981',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {toM?.displayName.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>
                        {toM?.displayName}
                        {isMeReceiver && <span style={{ color: 'var(--color-credit)', fontSize: '12px' }}> (Bạn)</span>}
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatVND(st.amount)}
                    </div>
                  </div>

                  {/* QR Card & Bank Information */}
                  <div
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {/* QR Thumbnail or Upload Box */}
                      <div style={{ width: '90px', flexShrink: 0, textAlign: 'center' }}>
                        {toM?.qrImageData ? (
                          <div style={{ position: 'relative', cursor: 'pointer' }}>
                            <img
                              src={toM.qrImageData}
                              alt={`Mã QR của ${toM.displayName}`}
                              style={{
                                width: '90px',
                                height: '90px',
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                              }}
                              onClick={() =>
                                setZoomedQr({
                                  name: toM.displayName,
                                  url: toM.qrImageData!,
                                })
                              }
                            />
                            <div
                              style={{
                                fontSize: '10px',
                                color: 'var(--accent-mint)',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                              }}
                            >
                              <Eye size={10} /> Phóng to
                            </div>
                          </div>
                        ) : (
                          <label
                            style={{
                              width: '90px',
                              height: '90px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px dashed var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              background: 'rgba(255,255,255,0.02)',
                              padding: '4px',
                            }}
                          >
                            <Upload size={16} color="var(--text-muted)" />
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                              Tải QR lên
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => toM && handleQrUpload(toM.id, e)}
                            />
                          </label>
                        )}
                      </div>

                      {/* Bank Details & Copy helpers */}
                      <div style={{ flex: 1, fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          Ngân hàng: {toM?.bankName || 'Chưa cập nhật'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Số TK: <strong style={{ color: 'var(--text-primary)' }}>{toM?.bankAccountNo || '---'}</strong>
                          {toM?.bankAccountNo && (
                            <button
                              type="button"
                              onClick={() => handleCopy(toM.bankAccountNo!, `stk-${toM.id}`)}
                              style={{
                                marginLeft: '6px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-mint)',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                            >
                              {copiedText === `stk-${toM.id}` ? '✓ Đã copy' : 'Copy'}
                            </button>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          Chủ TK: {toM?.bankAccountHolder || '---'}
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Nội dung CK:{' '}
                          <code style={{ color: 'var(--accent-mint)', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>
                            CL {toM?.displayName} {fromM?.displayName}
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Action button: "Tôi đã chuyển" */}
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                      {hasPending ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#f59e0b',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          <Clock size={16} /> Đã gửi xác nhận, đang chờ {toM?.displayName} duyệt...
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-block"
                          onClick={() => {
                            createTransfer({
                              fromMemberId: st.fromMemberId,
                              toMemberId: st.toMemberId,
                              amount: st.amount,
                              note: `Thanh toán chi phí cầu lông`,
                            });
                          }}
                        >
                          <CheckCircle2 size={14} /> Tôi đã chuyển {formatVND(st.amount)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR ZOOM MODAL */}
      {zoomedQr && (
        <div className="modal-backdrop" onClick={() => setZoomedQr(null)}>
          <div
            className="modal-content animate-fade-in"
            style={{ textAlign: 'center', maxWidth: '380px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                Mã QR chuyển khoản — {zoomedQr.name}
              </h3>
              <button
                onClick={() => setZoomedQr(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={zoomedQr.url}
              alt="Mã QR"
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                background: '#fff',
                padding: '8px',
              }}
            />

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Mở app ngân hàng bất kỳ để quét mã và chuyển tiền nhanh chóng.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
