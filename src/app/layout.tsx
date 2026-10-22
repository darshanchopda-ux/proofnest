import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Nunito } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/Icon";
import { ToastProvider } from "@/components/Toast";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

// Nunito, rounded and friendly, for reading; Plex Mono only for facts on the record.
const sans = Nunito({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mono", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#F7F3EA",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "ProofNest",
  description: "Record your flat at move-in, check the owner's deposit deductions against your photos, and ask for your refund.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>
          <header className="appbar">
            <div className="wrap">
              <Link className="brand" href="/" aria-label="ProofNest home">
                <BrandMark />
                ProofNest
              </Link>
              <span className="spacer" />
              <Suspense fallback={null}>
                <UserMenu />
              </Suspense>
            </div>
          </header>
          <main>{children}</main>
          <footer className="foot wrap">
            ProofNest gives legal information, not legal advice. Your flats are private to your account. <Link href="/account">Account</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/status">Status</Link>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
