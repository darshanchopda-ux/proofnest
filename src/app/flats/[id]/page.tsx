import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/dal";
import { getFlatDTO } from "@/lib/flats";
import type { Step } from "@/lib/types";
import { FreshOnNavigate } from "@/components/FreshOnNavigate";
import { FlatWorkspace } from "./FlatWorkspace";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function FlatPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening your flat…</div>}>
      <FlatLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function FlatLoader({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/flats/${id}`);
  const flat = await getFlatDTO(user.id, id);
  if (!flat) notFound();
  const step: Step = query.step === "check" || query.step === "letter" ? query.step : "record";
  return (
    <FreshOnNavigate>
      <FlatWorkspace initialFlat={flat} initialStep={step} />
    </FreshOnNavigate>
  );
}
