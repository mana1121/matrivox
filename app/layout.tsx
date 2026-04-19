import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matrivox — Sistem Aduan Kampus",
  description:
    "Matrivox menukar aduan WhatsApp kepada tiket berstruktur dan menghalakannya kepada PIC yang betul.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
