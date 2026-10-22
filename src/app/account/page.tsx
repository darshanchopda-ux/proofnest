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
import { AccountView } from "./AccountView";

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
    <AccountView
      title={mine ? displayPhone(mine) : user.email}
      phoneAccount={!!mine}
      numbers={numbers}
      canSend={whatsappConfigured() || process.env.NODE_ENV === "development"}
      history={history.map((h) => ({
        id: h.id,
        device: h.device,
        how: h.method === "whatsapp" ? `WhatsApp code to ${displayPhone(h.phone)}` : "Email and password",
        at: fmtIST(h.createdAt),
      }))}
    />
  );
}
