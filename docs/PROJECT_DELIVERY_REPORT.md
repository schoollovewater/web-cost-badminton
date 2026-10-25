# Báo Cáo Triển Khai: Web App Quản Lý & Chia Tiền Cầu Lông ("Lighter Badminton")

Ứng dụng web đã được phát triển hoàn thiện theo đúng toàn bộ đặc tả trong tài liệu [BA_SPEC.md](file:///c:/Users/Admin/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/Web_Cost_Badminton/docs/BA_SPEC.md).

---

## 1. Kết quả kiểm thử & Nghiệm thu

### 1.1 Kiểm thử tính toán (Vitest Unit Tests)
Bộ unit test kiểm chứng 8 trường hợp kiểm thử vàng (Golden Test Cases) lấy từ dữ liệu thực tế của các sheet `274`, `1209`, `2609`, `0808` và `1010`:
- **TC1 — Sheet 274**: Chia đều 3 người, Toàn ứng hết (Sân 136.5k, Nước 45k, Xiên nướng 143k). Thuật toán Largest Remainder phân bổ chính xác từng đồng VND, tổng số dư bằng đúng **0đ**.
- **TC2 — Sheet 1209**: Cặp đôi tính 2 suất (Trường + Thủy, Băng + Tâm) và tiền cầu tự động tính theo công thức `round(8 * 340.000 / 12) = 226.667đ`.
- **TC3 — Nhóm nhỏ**: Cặp đôi chỉ đi 1 người (tính 1 suất), chia đều chính xác.
- **TC4 — Chia theo số tiền cố định (Exact)**: Bắt buộc tổng các phần chia bằng đúng tổng số tiền khoản chi.
- **TC5 — Nợ riêng 2 người**: Khoản chi cá nhân được hạch toán trực tiếp giữa 2 người mà không cần tạo bảng phụ.
- **TC6 — Tối thiểu hoá giao dịch (Greedy Debt Simplification)**: Rút gọn nợ phức tạp 4 người thành 3 giao dịch tối ưu; đồng thời hỗ trợ chế độ chuyển qua thủ quỹ.
- **TC7 — Tính bất biến của sổ cái**: Tổng số dư toàn nhóm luôn bảo đảm $\sum \text{balance} = 0$.
- **TC8 — Vòng đời giao dịch (Transfers)**: Trạng thái `pending` không làm thay đổi số dư; chỉ khi người nhận bấm `confirmed` thì số dư mới được cập nhật.

> **Kết quả:** `8/8 passed (100%)`.

---

## 2. Các Tính Năng Đã Hoàn Thiện

| Phân hệ | Tính năng đã triển khai |
|---|---|
| **Sổ cái liên tục (Ledger)** | Xoá bỏ hoàn toàn cơ chế copy sheet theo đợt. Số dư tích luỹ tính tự động từ toàn bộ giao dịch, không còn lỗi lệch vùng công thức như ở file Excel cũ. |
| **Giao diện người dùng** | Thiết kế Mobile-first theo phong cách Obsidian Dark kết hợp tông xanh sân cầu (Badminton Court Mint). |
| **Đổi vai thành viên (User Switcher)** | Cho phép chuyển nhanh giữa các thành viên (Toàn, Trường + Thủy, Băng + Tâm, Tú, Kiên, Tạ Ánh, Quán) ngay trên thanh tiêu đề để kiểm tra số dư và duyệt tiền. |
| **Tạo nhanh buổi cầu (`/sessions/new`)** | Thao tác dưới 60 giây: chọn nhanh người đi bằng chip (cặp đôi hiển thị ×2 và có nút chỉnh suất), tự tính tiền cầu theo số quả dùng, xem trước phần chia tức thì. |
| **Chi tiết buổi cầu (`/sessions/[id]`)** | Xem bảng tổng hợp chi phí, phần chia từng người, nút **"Copy tin nhắn Zalo"** 1 chạm kèm emoji. |
| **Thanh toán & Mã QR (`/settle`)** | Tự động tính toán ai chuyển cho ai. Hỗ trợ 2 chế độ: **Tối thiểu chuyển khoản** và **Qua thủ quỹ**. Mỗi giao dịch hiển thị thông tin ngân hàng, nút copy STK và ảnh mã QR phóng to. |
| **Xác nhận 2 bước** | Người chuyển bấm **"Tôi đã chuyển"** $\rightarrow$ Người nhận nhận thông báo và bấm **"Đã nhận được"** thì số dư mới cập nhật. |
| **Kho lưu trữ 20 Sheet cũ (`/legacy`)** | Đọc và hiển thị lại toàn bộ dữ liệu lịch sử từ file `[Lighter] Costing Badminton.xlsx`, kèm cảnh báo phát hiện lỗi lệch công thức ở Sheet 1010 (+60.000đ). |

---

## 3. Cấu Trúc Mã Nguồn

```
Web_Cost_Badminton/
├── app/
│   ├── globals.css           # Design tokens, dark mode, animations
│   ├── layout.tsx            # Root layout với responsive container & ClientNav
│   ├── page.tsx              # Dashboard số dư, cảnh báo và hoạt động gần đây
│   ├── sessions/
│   │   ├── page.tsx          # Danh sách lịch sử các buổi cầu
│   │   ├── new/page.tsx      # Form tạo nhanh buổi cầu < 60s
│   │   └── [id]/page.tsx     # Chi tiết buổi cầu + Copy tin nhắn Zalo
│   ├── settle/page.tsx       # Ai chuyển cho ai + Xem & tải ảnh QR
│   ├── profile/page.tsx      # Quản lý tài khoản ngân hàng & Upload ảnh QR cá nhân
│   └── legacy/page.tsx       # Kho tra cứu 20 sheet Excel cũ
├── components/
│   └── ClientNav.tsx         # Top bar, User Switcher modal, Bottom nav bar
├── lib/
│   ├── store.ts              # Kho dữ liệu persistent và hạt giống chuẩn từ sheet 1010
│   ├── useStore.ts           # React hook quản lý state & tính toán thời gian thực
│   ├── legacyData.json       # Dữ liệu trích xuất từ 20 sheet Excel
│   └── engine/
│       ├── types.ts          # Định nghĩa kiểu dữ liệu TS
│       ├── split.ts          # Thuật toán Largest Remainder chia tiền chính xác
│       ├── shuttle.ts        # Thuật toán tính tiền cầu theo quả
│       ├── balances.ts       # Sổ cái tính số dư luỹ kế
│       ├── settle.ts         # Thuật toán tối ưu hoá số lần chuyển tiền
│       ├── format.ts         # Định dạng tiền tệ VND, ngày tháng, mẫu tin nhắn Zalo
│       └── engine.test.ts    # Bộ unit test Vitest TC1 - TC8
├── supabase/
│   └── migrations/
│       └── 20261018000000_init_schema.sql  # Schema Postgres + RLS + View sổ cái
├── docs/
│   └── BA_SPEC.md            # Tài liệu đặc tả phân tích nghiệp vụ BA
└── package.json
```

---

## 4. Hướng Dẫn Vận Hành & Khởi Chạy

### 4.1 Chạy thử nghiệm trên máy (Local Dev)
```bash
# 1. Chạy unit tests kiểm tra thuật toán:
npm test

# 2. Khởi chạy máy chủ phát triển:
npm run dev
# Truy cập: http://localhost:3000

# 3. Kiểm tra bản build xuất xưởng:
npm run build
```

### 4.2 Đưa lên Supabase & Vercel
1. Tạo một dự án miễn phí trên [Supabase](https://supabase.com).
2. Vào mục **SQL Editor** trong Supabase Dashboard, copy nội dung file [supabase/migrations/20261018000000_init_schema.sql](file:///c:/Users/Admin/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Desktop/Web_Cost_Badminton/supabase/migrations/20261018000000_init_schema.sql) và bấm **Run**.
3. Đẩy mã nguồn lên GitHub và kết nối với [Vercel](https://vercel.com) để deploy tự động.
