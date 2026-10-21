import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { reviewByToken } from "@/lib/owner-review";
import { OwnerRecord } from "./OwnerRecord";

export const metadata: Metadata = {
  title: "Confirm a move-in record · ProofNest",
  description: "Your tenant has shared photos of the flat from move-in day. Look through them and confirm in one tap. No account needed.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Please confirm the flat's move-in photos",
    description: "Your tenant has shared photos of the flat from move-in day. Look through them and confirm in one tap. No account needed.",
  },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default function ConfirmPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening the move-in record…</div>}>
      <ConfirmLoader params={params} />
    </Suspense>
  );
}

async function ConfirmLoader({ params }: Props) {
  const { token } = await params;
  await connection();
  const found = await reviewByToken(token);
  if (!found) {
    return (
      <div className="wrap owner-page">
        <div className="notice" style={{ marginTop: 40 }}>
          This link isn&apos;t active. The tenant may have sent a newer one after adding photos. Ask them to send the latest link.
        </div>
      </div>
    );
  }

  return <OwnerRecord token={token} review={found.review} flat={found.flat} />;
}
