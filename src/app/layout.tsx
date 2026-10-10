import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LUMA Business Advisor",
    template: "%s | LUMA Business Advisor",
  },
  description:
    "LUMA Business Advisor membantu UMKM mengelola keuangan, memantau penjualan dan persediaan, menganalisis kondisi bisnis, serta menemukan peluang untuk meningkatkan keuntungan melalui data dan rekomendasi bisnis.",
  applicationName: "LUMA Business Advisor",
  keywords: [
    "LUMA Business Advisor",
    "manajemen UMKM",
    "analisis bisnis",
    "manajemen keuangan",
    "pencatatan penjualan",
    "manajemen stok",
    "business intelligence",
    "AI business advisor",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}