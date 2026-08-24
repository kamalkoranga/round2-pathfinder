import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Nav } from "@/components/Nav";
import { SyncProvider } from "@/lib/sync";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PathFinder — AI Personalised Learning Paths",
  description:
    "Describe your goal in plain language and get a sequenced learning roadmap: skill-gap analysis, prerequisites, milestones and explained recommendations.",
};

export const viewport: Viewport = {
  themeColor: "#f8f8f7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <SyncProvider>
          <Nav />
          <div className="lg:pl-60">{children}</div>
        </SyncProvider>
      </body>
    </html>
  );
}
