import type { Metadata } from 'next';
import './globals.css';
import ClientNav from '@/components/ClientNav';

export const metadata: Metadata = {
  title: 'Lighter Badminton — Chia Tiền Cầu Lông Thông Minh',
  description: 'Quản lý, chia chi phí cầu lông tự động, tối ưu chuyển khoản và mã QR cho nhóm.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <div className="app-container">
          <ClientNav>{children}</ClientNav>
        </div>
      </body>
    </html>
  );
}
