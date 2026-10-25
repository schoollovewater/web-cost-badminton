'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/useStore';
import { formatVND } from '@/lib/engine/format';
import { calculateShuttleAmount } from '@/lib/engine/shuttle';
import { calculateWeightedSplit } from '@/lib/engine/split';
import { Category } from '@/lib/engine/types';
import {
  Calendar,
  Users,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OtherExpenseItem {
  id: string;
  title: string;
  category: Category;
  amount: number;
  paidBy: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const { currentMember, members, state, sessions, createSession } = useStore();

  // 1. Session Date & Info
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [title, setTitle] = useState<string>('');

  // 2. Who participated? (memberId -> weight, 0 = not attending)
  const [selectedWeights, setSelectedWeights] = useState<Record<string, number>>(
    () => {
      // Default: all active members attending with defaultWeight
      const init: Record<string, number> = {};
      for (const m of members) {
        if (m.isActive) {
          init[m.id] = m.defaultWeight;
        }
      }
      return init;
    }
  );

  // 3. Court Cost
  const [courtAmount, setCourtAmount] = useState<number>(240000);
  const [courtPaidBy, setCourtPaidBy] = useState<string>(currentMember.id);

  // 4. Shuttle Cost
  const [shuttleQty, setShuttleQty] = useState<number>(4);
  const [shuttlePaidBy, setShuttlePaidBy] = useState<string>(currentMember.id);
  const [customTubePrice, setCustomTubePrice] = useState<number>(
    state.settings.tubePrice
  );

  // 5. Other expenses list
  const [otherCosts, setOtherCosts] = useState<OtherExpenseItem[]>([]);

  // Helpers
  const participants = useMemo(() => {
    return Object.entries(selectedWeights)
      .filter(([_, w]) => w > 0)
      .map(([memberId, weight]) => ({ memberId, weight }));
  }, [selectedWeights]);

  const totalShares = useMemo(() => {
    return participants.reduce((sum, p) => sum + p.weight, 0);
  }, [participants]);

  const calculatedShuttleAmount = useMemo(() => {
    return calculateShuttleAmount(
      shuttleQty,
      customTubePrice,
      state.settings.shuttlesPerTube
    );
  }, [shuttleQty, customTubePrice, state.settings.shuttlesPerTube]);

  const totalOtherAmount = useMemo(() => {
    return otherCosts.reduce((s, c) => s + (c.amount || 0), 0);
  }, [otherCosts]);

  const grandTotal = courtAmount + calculatedShuttleAmount + totalOtherAmount;

  // Real-time calculation of shares preview
  const previewShares = useMemo(() => {
    if (participants.length === 0 || grandTotal <= 0) return {};
    const shares = calculateWeightedSplit(grandTotal, participants);
    const map: Record<string, number> = {};
    for (const s of shares) {
      map[s.memberId] = s.amount;
    }
    return map;
  }, [participants, grandTotal]);

  // Handle participant toggle / weight
  const toggleParticipant = (memberId: string, defaultWeight: number) => {
    setSelectedWeights((prev) => {
      const current = prev[memberId] || 0;
      return {
        ...prev,
        [memberId]: current > 0 ? 0 : defaultWeight,
      };
    });
  };

  const adjustWeight = (memberId: string, delta: number) => {
    setSelectedWeights((prev) => {
      const current = prev[memberId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [memberId]: next };
    });
  };

  // Clone from previous session
  const copyFromPreviousSession = () => {
    if (sessions.length === 0) return;
    const lastSession = sessions[0];
    const newWeights: Record<string, number> = {};
    for (const m of members) {
      newWeights[m.id] = 0;
    }
    for (const p of lastSession.participants) {
      newWeights[p.memberId] = p.weight;
    }
    setSelectedWeights(newWeights);
  };

  // Add another expense
  const addOtherExpense = () => {
    setOtherCosts((prev) => [
      ...prev,
      {
        id: 'other-' + Date.now(),
        title: 'Nước uống',
        category: 'drink',
        amount: 30000,
        paidBy: currentMember.id,
      },
    ]);
  };

  const removeOtherExpense = (id: string) => {
    setOtherCosts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (participants.length === 0) {
      alert('Vui lòng chọn ít nhất 1 người tham gia buổi cầu.');
      return;
    }

    const sessionId = createSession({
      date,
      title: title.trim() || undefined,
      participants,
      courtCost: courtAmount > 0 ? { amount: courtAmount, paidBy: courtPaidBy } : undefined,
      shuttleCost:
        shuttleQty > 0
          ? { qty: shuttleQty, paidBy: shuttlePaidBy, tubePrice: customTubePrice }
          : undefined,
      otherCosts: otherCosts.filter((c) => c.amount > 0),
    });

    router.push(`/sessions/${sessionId}`);
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Tạo nhanh buổi cầu</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Nhập nhanh tiền sân, tiền cầu và chi phí chỉ dưới 60 giây
        </p>
      </div>

      {/* 1. DATE & INFO */}
      <div className="glass-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Ngày đánh
            </label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tên buổi (tuỳ chọn)</label>
            <input
              type="text"
              className="form-input"
              placeholder="VD: Buổi sáng T7 sân ĐH Bách Khoa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. PARTICIPANTS CHIP GRID */}
      <div className="glass-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div>
            <label className="form-label" style={{ marginBottom: '2px' }}>
              <Users size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Ai đi đánh cầu? ({participants.length} người • {totalShares} suất)
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bấm vào tên để chọn / bỏ chọn
            </span>
          </div>

          {sessions.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={copyFromPreviousSession}
            >
              <RotateCcw size={12} /> Giống buổi trước
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {members.map((m) => {
            const weight = selectedWeights[m.id] || 0;
            const isAttending = weight > 0;

            return (
              <div
                key={m.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: isAttending ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                  border: `1px solid ${
                    isAttending ? 'var(--accent-mint)' : 'var(--border-subtle)'
                  }`,
                  borderRadius: 'var(--radius-full)',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span
                  onClick={() => toggleParticipant(m.id, m.defaultWeight)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: isAttending ? 600 : 400,
                    color: isAttending ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: m.avatarColor,
                    }}
                  />
                  {m.displayName}
                </span>

                {isAttending && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '8px',
                      borderLeft: '1px solid rgba(255,255,255,0.15)',
                      paddingLeft: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--accent-mint)',
                      }}
                    >
                      ×{weight}
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: '12px',
                      }}
                      onClick={() => adjustWeight(m.id, -1)}
                      disabled={weight <= 1}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: '12px',
                      }}
                      onClick={() => adjustWeight(m.id, 1)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. COURT EXPENSE */}
      <div className="glass-card">
        <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
          🏟️ Tiền sân cầu lông
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Số tiền (VNĐ)</label>
            <input
              type="number"
              step="1000"
              className="form-input"
              value={courtAmount}
              onChange={(e) => setCourtAmount(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ai ứng tiền trước?</label>
            <select
              className="form-select"
              value={courtPaidBy}
              onChange={(e) => setCourtPaidBy(e.target.value)}
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

      {/* 4. SHUTTLE EXPENSE */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 700 }}>
            🏸 Tiền cầu (tự tính theo quả)
          </h4>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-mint)' }}>
            = {formatVND(calculatedShuttleAmount)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Số quả đã dùng</label>
            <div className="stepper" style={{ width: '100%', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setShuttleQty((q) => Math.max(0, q - 1))}
              >
                -
              </button>
              <span className="stepper-val">{shuttleQty} quả</span>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setShuttleQty((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ai ứng tiền cầu?</label>
            <select
              className="form-select"
              value={shuttlePaidBy}
              onChange={(e) => setShuttlePaidBy(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Định mức: Ống 12 quả = {formatVND(customTubePrice)} (~{formatVND(Math.round(customTubePrice / 12))}/quả)
        </div>
      </div>

      {/* 5. OTHER EXPENSES */}
      <div className="glass-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ fontSize: '15px', fontWeight: 700 }}>
            🥤 Khoản chi khác (nước uống, ăn uống...)
          </h4>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addOtherExpense}
          >
            <Plus size={14} /> Thêm dòng
          </button>
        </div>

        {otherCosts.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Không có khoản chi khác (hoặc bấm &quot;Thêm dòng&quot; nếu có mua nước, ăn sáng, cafe).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {otherCosts.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr auto',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tên khoản chi"
                  value={item.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOtherCosts((prev) =>
                      prev.map((c) => (c.id === item.id ? { ...c, title: val } : c))
                    );
                  }}
                />
                <input
                  type="number"
                  step="1000"
                  className="form-input"
                  placeholder="Số tiền"
                  value={item.amount || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setOtherCosts((prev) =>
                      prev.map((c) => (c.id === item.id ? { ...c, amount: val } : c))
                    );
                  }}
                />
                <select
                  className="form-select"
                  value={item.paidBy}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOtherCosts((prev) =>
                      prev.map((c) => (c.id === item.id ? { ...c, paidBy: val } : c))
                    );
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeOtherExpense(item.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-debt)',
                    cursor: 'pointer',
                    padding: '8px',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. LIVE PREVIEW SUMMARY */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 24, 39, 0.95) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Tổng tiền buổi cầu:
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatVND(grandTotal)}
            </div>
          </div>
          {totalShares > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mỗi suất:</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-mint)' }}>
                ~{formatVND(Math.round(grandTotal / totalShares))}
              </div>
            </div>
          )}
        </div>

        {/* Breakdown by person */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '8px',
          }}
        >
          {participants.map((p) => {
            const m = members.find((x) => x.id === p.memberId);
            const share = previewShares[p.memberId] || 0;
            return (
              <div
                key={p.memberId}
                style={{
                  background: 'var(--bg-input)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
              >
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {m?.displayName} ({p.weight}s)
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatVND(share)}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: '16px', padding: '14px' }}
        >
          <Check size={18} /> Lưu & Chốt buổi cầu
        </button>
      </div>
    </form>
  );
}
