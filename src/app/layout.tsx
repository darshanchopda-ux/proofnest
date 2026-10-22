import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/Icon";
import { ToastProvider } from "@/components/Toast";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofNest",
  description: "Record your flat at move-in, check the owner's deposit deductions against your photos, and ask for your refund.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
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
            ProofNest gives legal information, not legal advice. Your flats are private to your account. <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/status">Status</Link>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
