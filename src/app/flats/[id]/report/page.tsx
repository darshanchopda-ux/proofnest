import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid, requireUser } from "@/lib/dal";
import { sealMissing } from "@/lib/evidence";
import { getFlatDTO } from "@/lib/flats";
import { Report } from "./Report";

export const metadata: Metadata = { title: "Move-in record · ProofNest" };

type Props = { params: Promise<{ id: string }> };

export default function ReportPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Preparing your move-in record…</div>}>
      <ReportLoader params={params} />
    </Suspense>
  );
}

async function ReportLoader({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/flats/${id}/report`);
  // Make sure every photo is fingerprinted and timestamped before the record is printed.
  if (isUuid(id)) await sealMissing(id);
  const flat = await getFlatDTO(user.id, id);
  if (!flat) notFound();
  return <Report flat={flat} />;
}
