import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "음원 홍보 파이프라인",
  description: "가수 발굴 및 DM 발송 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <nav className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-gray-900 shrink-0">
              홍보 파이프라인
            </Link>
            <Link href="/" className="text-sm text-gray-600 hover:text-indigo-600">
              발송 리스트
            </Link>
            <Link href="/review" className="text-sm text-gray-600 hover:text-indigo-600">
              수동 확인
            </Link>
            <Link href="/db" className="text-sm text-gray-600 hover:text-indigo-600">
              전체 DB
            </Link>
            <Link href="/stats" className="text-sm text-gray-600 hover:text-indigo-600">
              통계
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
