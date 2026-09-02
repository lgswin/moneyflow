import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Money Flow — 개인 자금 흐름 관리',
  description: '계좌, 소비, 해외송금과 대여금 상환을 한눈에 관리하는 개인용 지갑 앱',
  manifest: '/manifest.webmanifest',
  applicationName: 'Money Flow',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Money Flow' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Money Flow — 개인 자금 흐름 관리',
    description: '계좌·소비·대여금 흐름을 한눈에',
    type: 'website',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: 'Money Flow — 계좌·소비·대여금 흐름을 한눈에' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Money Flow — 개인 자금 흐름 관리',
    description: '계좌·소비·대여금 흐름을 한눈에',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head><meta name="theme-color" content="#17372d" /><meta name="mobile-web-app-capable" content="yes" /></head>
      <body>{children}</body>
    </html>
  );
}
