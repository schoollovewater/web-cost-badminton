'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/useStore';
import { formatVND } from '@/lib/engine/format';
import {
  User,
  CreditCard,
  QrCode,
  Upload,
  Settings,
  RotateCcw,
  Check,
  FileSpreadsheet,
  Shield,
} from 'lucide-react';

export default function ProfilePage() {
  const {
    currentMember,
    members,
    state,
    updateMemberProfile,
    updateSettings,
    resetAllData,
  } = useStore();

  const [bankName, setBankName] = useState(currentMember?.bankName || '');
  const [bankAccountNo, setBankAccountNo] = useState(
    currentMember?.bankAccountNo || ''
  );
  const [bankAccountHolder, setBankAccountHolder] = useState(
    currentMember?.bankAccountHolder || ''
  );
  const [qrPreview, setQrPreview] = useState(currentMember?.qrImageData || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Group Settings state
  const [tubePrice, setTubePrice] = useState(state.settings.tubePrice);
  const [shuttlesPerTube, setShuttlesPerTube] = useState(
    state.settings.shuttlesPerTube
  );

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Vui lòng chọn ảnh có kích thước dưới 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setQrPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateMemberProfile(currentMember.id, {
      bankName: bankName.trim(),
      bankAccountNo: bankAccountNo.trim(),
      bankAccountHolder: bankAccountHolder.trim().toUpperCase(),
      qrImageData: qrPreview,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveSettings = () => {
    updateSettings({
      tubePrice,
      shuttlesPerTube,
    });
    alert('Đã cập nhật cài đặt nhóm thành công!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Thông tin cá nhân & QR</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Cập nhật số tài khoản và ảnh mã QR để mọi người chuyển tiền cho bạn
        </p>
      </div>

      {/* MEMBER PROFILE & QR FORM */}
      <form onSubmit={handleSaveProfile} className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: currentMember.avatarColor,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            {currentMember.displayName.charAt(0)}
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>
              {currentMember.displayName}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {currentMember.role === 'admin' ? 'Quản trị viên (Thủ quỹ)' : 'Thành viên'} •{' '}
              {currentMember.defaultWeight === 2 ? 'Cặp đôi (2 suất)' : '1 suất'}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tên ngân hàng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: Techcombank, Vietcombank, MB..."
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Số tài khoản ngân hàng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: 190345678910"
            value={bankAccountNo}
            onChange={(e) => setBankAccountNo(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tên chủ tài khoản (in hoa)</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: NGUYEN VAN A"
            value={bankAccountHolder}
            onChange={(e) => setBankAccountHolder(e.target.value)}
          />
        </div>

        {/* QR IMAGE UPLOAD & PREVIEW */}
        <div className="form-group">
          <label className="form-label">Ảnh mã QR chuyển khoản</label>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {qrPreview ? (
              <img
                src={qrPreview}
                alt="QR Preview"
                style={{
                  width: '100px',
                  height: '100px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textAlign: 'center',
                  padding: '8px',
                }}
              >
                Chưa có ảnh QR
              </div>
            )}

            <div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} /> Tải ảnh QR mới
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleQrUpload}
                />
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Hỗ trợ ảnh PNG, JPG hoặc WebP (tối đa 3MB).
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '10px' }}>
          {savedSuccess ? (
            <>
              <Check size={16} /> Đã lưu thông tin thành công!
            </>
          ) : (
            'Lưu thông tin thanh toán'
          )}
        </button>
      </form>

      {/* GROUP SETTINGS (FOR ADMIN) */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Settings size={18} color="var(--accent-mint)" />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Cài đặt định mức nhóm</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Giá 1 ống cầu (VNĐ)</label>
            <input
              type="number"
              step="1000"
              className="form-input"
              value={tubePrice}
              onChange={(e) => setTubePrice(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số quả / ống</label>
            <input
              type="number"
              className="form-input"
              value={shuttlesPerTube}
              onChange={(e) => setShuttlesPerTube(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleSaveSettings}
        >
          Cập nhật định mức
        </button>
      </div>

      {/* EXCEL ARCHIVE & DATA MANAGEMENT */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
          Kho dữ liệu & Đồng bộ Excel
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/legacy"
            className="btn btn-secondary btn-block"
            style={{ justifyContent: 'flex-start' }}
          >
            <FileSpreadsheet size={16} color="var(--accent-mint)" />
            Xem kho lưu trữ 20 Sheet Excel cũ
          </Link>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{
              justifyContent: 'flex-start',
              color: 'var(--color-debt)',
              borderColor: 'rgba(244, 63, 94, 0.3)',
            }}
            onClick={() => {
              if (
                confirm(
                  'Khôi phục lại toàn bộ dữ liệu ban đầu từ Sheet 1010 chuẩn đã cân bằng (0đ)?'
                )
              ) {
                resetAllData();
                alert('Đã khôi phục dữ liệu ban đầu thành công!');
              }
            }}
          >
            <RotateCcw size={16} />
            Khôi phục dữ liệu gốc chuẩn từ Sheet 1010
          </button>
        </div>
      </div>
    </div>
  );
}
