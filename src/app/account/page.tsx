import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { phoneLinks, signIns } from "@/db/schema";
import { accountPhoneOf } from "@/lib/account";
import { requireUser } from "@/lib/dal";
import { fmtIST } from "@/lib/format";
import { displayPhone } from "@/lib/phone-login";
import { whatsappConfigured } from "@/lib/whatsapp";
import { AccountDanger, BackupPhones, SignOutEverywhere } from "./AccountParts";

export const metadata: Metadata = { title: "Your account · ProofNest" };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening your account…</div>}>
      <AccountLoader />
    </Suspense>
  );
}

async function AccountLoader() {
  const user = await requireUser("/account");
  const mine = accountPhoneOf(user.email);
  const [links, history] = await Promise.all([
    mine ? db.select().from(phoneLinks).where(eq(phoneLinks.accountPhone, mine)) : Promise.resolve([]),
    db.select().from(signIns).where(eq(signIns.userId, user.id)).orderBy(desc(signIns.createdAt)).limit(15),
  ]);
  const numbers = mine
    ? [
        { phone: mine, display: displayPhone(mine), primary: true, off: links.some((l) => l.phone === mine && l.disabledAt) },
        ...links.filter((l) => l.phone !== mine).map((l) => ({ phone: l.phone, display: displayPhone(l.phone), primary: false, off: !!l.disabledAt })),
      ]
    : [];

  return (
    <div className="wrap narrow account">
      <p className="eyebrow">Your account</p>
      <h1>{mine ? displayPhone(mine) : user.email}</h1>
      <p className="muted">{mine ? "You sign in with a code on WhatsApp." : "You sign in with your email and password."}</p>

      <section className="acc-sec" aria-labelledby="acc-numbers">
        <h2 id="acc-numbers">Phone numbers</h2>
        {mine ? (
          <BackupPhones numbers={numbers} canSend={whatsappConfigured() || process.env.NODE_ENV === "development"} />
        ) : (
          <p className="hint">Backup numbers are for accounts that sign in with WhatsApp. If you lose your phone, sign in with your email.</p>
        )}
      </section>

      <section className="acc-sec" aria-labelledby="acc-history">
        <h2 id="acc-history">Recent sign-ins</h2>
        {history.length ? (
          <ul className="acc-history">
            {history.map((s) => (
              <li key={s.id}>
                <b>{s.device || "Unknown device"}</b>
                <span>{s.method === "whatsapp" ? `WhatsApp code to ${displayPhone(s.phone)}` : "Email and password"}</span>
                <span className="muted">{fmtIST(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Sign-ins from now on are listed here.</p>
        )}
        <p className="hint">Don&apos;t recognise one, or someone else used your phone? Sign out everywhere, then sign in again.</p>
        <SignOutEverywhere />
      </section>

      <section className="acc-sec danger" aria-labelledby="acc-delete">
        <h2 id="acc-delete">Delete your account</h2>
        <p className="hint">
          Deletes every flat you added, with all its photos, files and letters, also for flatmates you invited; removes you from flats you
          joined; and deletes your numbers and sign-in history. This can&apos;t be undone. Download your evidence pack first if you might need it.
        </p>
        <AccountDanger needsPassword={!mine} />
      </section>
    </div>
  );
}
