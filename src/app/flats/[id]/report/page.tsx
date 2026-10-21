import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandMark, Icon } from "@/components/Icon";
import { requireUser } from "@/lib/dal";
import { getFlatDTO } from "@/lib/flats";
import { fmtDate, money, plural } from "@/lib/format";
import { roomStats } from "@/lib/guidance";
import { CONDITIONS, type FlatDTO, type PhotoDTO } from "@/lib/types";
import { PrintButton } from "./PrintButton";

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
  const flat = await getFlatDTO(user.id, id);
  if (!flat) notFound();
  return <Report flat={flat} />;
}

/** Times are shown in IST whatever the server's time zone, since the record is for flats in India. */
function ist(value: string | Date): string {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";
}

function Report({ flat }: { flat: FlatDTO }) {
  const rooms = roomStats(flat);
  const shot = rooms.filter((r) => r.count > 0);
  const missing = rooms.filter((r) => r.count === 0).map((r) => r.name);
  const count = (c: PhotoDTO["condition"]) => flat.photos.filter((p) => p.condition === c).length;
  const flagged = flat.photos.filter((p) => p.condition !== "good");
  const tenant = flat.tenantName || "The tenant";
  const facts: [string, string][] = (
    [
      ["Tenant", flat.tenantName],
      ["Owner", flat.ownerName],
      ["Moved in on", flat.moveIn ? fmtDate(flat.moveIn) : ""],
      ["Monthly rent", flat.monthlyRent && Number(flat.monthlyRent) > 0 ? money(flat.monthlyRent) : ""],
      ["Security deposit", flat.deposit && Number(flat.deposit) > 0 ? money(flat.deposit) : ""],
      ["Rent agreement dated", flat.agreement?.facts.agreementDate ? fmtDate(flat.agreement.facts.agreementDate) : ""],
      ["Record made on", ist(new Date())],
    ] as [string, string | null | undefined][]
  ).filter((x): x is [string, string] => Boolean(x[1]));

  return (
    <div className="wrap report">
      <div className="rp-bar no-print">
        <Link className="linkbtn" href={`/flats/${flat.id}?step=record`}>
          <Icon name="arrow" small className="flip" />Back to your flat
        </Link>
        <div className="rp-bar-main">
          <PrintButton fileName={`Move-in record - ${flat.address}`.slice(0, 120)} />
          <p className="hint" style={{ margin: 0 }}>
            Choose <b>Save as PDF</b> as the printer, then send the PDF to your owner on WhatsApp or email on the day you move in. Ask them to
            reply that they received it.
          </p>
        </div>
      </div>

      <article className="rp-doc">
        <header className="rp-head">
          <div className="rp-brand"><BrandMark />ProofNest · Move-in record</div>
          <h1>{flat.address}</h1>
          {facts.length > 0 && (
            <dl className="rp-facts">
              {facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          <p className="rp-intro">
            This is {flat.tenantName ? `${flat.tenantName}'s` : "the tenant's"} record of the flat&apos;s condition at move-in:{" "}
            {plural(flat.photos.length, "photo")} of {plural(shot.length, "room")}, with {count("good")} in good condition, {count("worn")} worn and{" "}
            {count("damaged")} damaged. Each photo shows when it was taken, when it was added to ProofNest, and a fingerprint of the original
            file, so anyone can check later that it hasn&apos;t been changed.
          </p>
        </header>

        {flat.photos.length === 0 ? (
          <p className="notice no-print">No photos yet. Add photos of each room on your flat page, then come back to make this record.</p>
        ) : (
          <>
            {flagged.length > 0 && (
              <section className="rp-sec rp-issues">
                <h2>Already worn or damaged at move-in</h2>
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

            {shot.map((room) => (
              <section className="rp-sec rp-room" key={room.name}>
                <h2>{room.name} <small>{plural(room.count, "photo")}</small></h2>
                <div className="rp-grid">
                  {flat.photos.filter((p) => p.room === room.name).map((p) => (
                    <figure className={`rp-photo c-${p.condition}`} key={p.id}>
                      {p.src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route; eager so it prints
                        <img src={p.src} alt={`Photo P${p.n}, ${p.room}`} loading="eager" />
                      ) : (
                        <div className="rp-ph">Example photo</div>
                      )}
                      <figcaption>
                        <div className="rp-cap">
                          <b>P{p.n}</b>
                          <span className={`rp-cond c-${p.condition}`}>{CONDITIONS[p.condition]}</span>
                        </div>
                        {p.note && <p>{p.note}</p>}
                        <small>
                          {p.takenAt ? `${p.takenFrom === "camera" ? "Taken" : "File date"} ${ist(p.takenAt)}` : "Capture time unknown"}
                          <br />
                          Added to ProofNest {ist(p.addedAt)}
                        </small>
                        {p.sha256 && <code>SHA-256 {p.sha256}</code>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ))}

            {missing.length > 0 && (
              <p className="rp-missing">Not photographed: {missing.join(", ")}.</p>
            )}

            <section className="rp-sec rp-sign">
              <h2>Acknowledgement</h2>
              <p>I have received this move-in record of {plural(flat.photos.length, "photo")}. A reply saying &ldquo;Received&rdquo; on WhatsApp or email also counts.</p>
              <div className="rp-lines">
                <div><span>Owner&apos;s name</span></div>
                <div><span>Signature</span></div>
                <div><span>Date</span></div>
              </div>
              <div className="rp-lines">
                <div><span>{tenant === "The tenant" ? "Tenant's name" : tenant}</span></div>
                <div><span>Tenant&apos;s signature</span></div>
                <div><span>Date</span></div>
              </div>
            </section>

            <footer className="rp-foot">
              <p>
                <b>Checking a photo.</b> Each fingerprint is the SHA-256 of the original photo file, calculated on the tenant&apos;s phone when it was
                added. The tenant keeps the original files. To check one, calculate its SHA-256 (on a Mac: <code>shasum -a 256 photo.jpg</code>; on
                Windows: <code>certutil -hashfile photo.jpg SHA256</code>). It matches only if the photo is exactly the same.
              </p>
              <p>Made with ProofNest. ProofNest gives legal information, not legal advice.</p>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
