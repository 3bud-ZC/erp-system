import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام ERP - مصنع البلاستيك",
  description: "نظام إدارة موارد المؤسسة لمصنع البلاستيك",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-cairo antialiased">
        {children}
      </body>
    </html>
  );
}
