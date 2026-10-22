import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/dal";
import { inviteByToken } from "@/lib/invites";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = {
  title: "Join a flat · ProofNest",
  description: "Your flatmate has invited you to share your flat's move-in record on ProofNest.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default function JoinPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening the invite…</div>}>
      <JoinLoader params={params} />
    </Suspense>
  );
}

async function JoinLoader({ params }: Props) {
  const { token } = await params;
  const user = await requireUser(`/join/${token}`);
  const invite = await inviteByToken(token);
  if (!invite) {
    return (
      <div className="wrap narrow">
        <div className="notice" style={{ marginTop: 40 }}>
          This invite has been used or has expired. Invites work once, for a week. Ask your flatmate to send a new one.
        </div>
        <p style={{ marginTop: 16 }}><Link className="linkbtn" href="/">Go to your flats</Link></p>
      </div>
    );
  }
  return (
    <div className="wrap narrow join">
      <p className="eyebrow">Flat invite</p>
      <h1>{invite.address}</h1>
      <p>
        {invite.tenantName || "Your flatmate"} has invited you to share this flat on ProofNest. You&apos;ll both see the move-in photos,
        can add photos of your own rooms, and can track the deposit together.
      </p>
      <JoinForm token={token} defaultName={user.name} />
    </div>
  );
}
