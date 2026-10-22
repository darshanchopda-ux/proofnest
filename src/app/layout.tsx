import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Nunito } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/Icon";
import { ToastProvider } from "@/components/Toast";
import { UserMenu } from "@/components/UserMenu";
import { MotionProvider } from "@/components/motion";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Nunito, rounded and friendly, for reading; Plex Mono only for facts on the record.
const sans = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#F7F3EA",
  colorScheme: "light",
};

const description = "Record your flat at move-in with live, sealed photos, check the owner's deposit deductions against them, and ask for your refund.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ProofNest · Get your security deposit back",
  description,
  applicationName: "ProofNest",
  openGraph: { type: "website", siteName: "ProofNest", locale: "en_IN", title: "ProofNest · Your deposit, backed by proof", description },
  twitter: { card: "summary_large_image", title: "ProofNest · Your deposit, backed by proof", description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <MotionProvider>
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
            ProofNest gives legal information, not legal advice. Your flats are private to your account. <Link href="/account">Account</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> ·{" "}
            <Link href="/status">Status</Link>
          </footer>
        </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
