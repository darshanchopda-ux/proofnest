import type { OwnerReview } from "@/db/schema";
import { fmtDate, fmtIST, plural } from "@/lib/format";
import { CONDITIONS } from "@/lib/types";
import { ConfirmForm } from "./ConfirmForm";

type Props = {
  token: string;
  review: Pick<OwnerReview, "photos" | "status" | "ownerName" | "ownerNote" | "respondedAt" | "recordHash">;
  flat: { address: string; ownerName: string; tenantName: string; moveIn: string | null };
};

/** The owner's view of a shared move-in record: the photos as they were when the link was made, and the answer form. */
export function OwnerRecord({ token, review, flat }: Props) {
  const tenant = flat.tenantName || "Your tenant";
  const rooms = [...new Set(review.photos.map((p) => p.room))];
  const flagged = review.photos.filter((p) => p.condition !== "good");

  return (
    <div className="wrap owner-page">
      <header className="op-head">
        <p className="eyebrow">Move-in record shared with you</p>
        <h1>{flat.address}</h1>
        <p>
          {tenant} took these {plural(review.photos.length, "photo")} on move-in day{flat.moveIn ? ` (${fmtDate(flat.moveIn)})` : ""} and is asking
          you to confirm they show the flat&apos;s condition. A record you both agree on now makes the deposit easy to settle at move-out.
        </p>
      </header>

      {flagged.length > 0 && (
        <section className="rp-sec rp-issues">
          <h2>Already worn or damaged when they moved in</h2>
          <ul>
            {flagged.map((p) => (
              <li key={p.id}>
                <b>P{p.n}</b> · {p.room} · <span className={`rp-cond c-${p.condition}`}>{CONDITIONS[p.condition]}</span>
                {p.note ? ` · ${p.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rooms.map((room) => (
        <section className="rp-sec" key={room}>
          <h2>{room} <small>{plural(review.photos.filter((p) => p.room === room).length, "photo")}</small></h2>
          <div className="rp-grid">
            {review.photos.filter((p) => p.room === room).map((p) => (
              <figure className={`rp-photo c-${p.condition}`} key={p.id}>
                {p.sha256 ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private photo served only to holders of this link
                  <img src={`/api/confirm/${token}/photos/${p.n}`} alt={`Photo P${p.n}, ${p.room}`} loading="lazy" />
                ) : (
                  <div className="rp-ph">Example photo</div>
                )}
                <figcaption>
                  <div className="rp-cap">
                    <b>P{p.n}</b>
                    <span className={`rp-cond c-${p.condition}`}>{CONDITIONS[p.condition]}</span>
                  </div>
                  {p.note && <p>{p.note}</p>}
                  <small>{p.takenAt ? `${p.takenFrom === "camera" ? "Taken" : "File date"} ${fmtIST(p.takenAt)}` : "Capture time unknown"}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <ConfirmForm
        token={token}
        tenant={tenant}
        count={review.photos.length}
        defaultName={flat.ownerName}
        answer={review.respondedAt ? { status: review.status === "disputed" ? "disputed" : "confirmed", name: review.ownerName, note: review.ownerNote, at: review.respondedAt.toISOString() } : null}
      />

      <footer className="rp-foot">
        <p>
          ProofNest helps tenants keep a dated record of a rented flat. You don&apos;t need an account. Your answer is saved with the time you
          send it, and {tenant} can see it. It can&apos;t be changed afterwards.
        </p>
        <p>Record fingerprint (SHA-256): <code>{review.recordHash}</code></p>
      </footer>
    </div>
  );
}
