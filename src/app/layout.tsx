import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/Icon";
import { ToastProvider } from "@/components/Toast";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

const display = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "ProofNest",
  description: "Record your flat at move-in, check the owner's deposit deductions against your photos, and ask for your refund.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
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
          <footer className="foot wrap">ProofNest gives legal information, not legal advice. Your flats are private to your account.</footer>
        </ToastProvider>
      </body>
    </html>
  );
}
