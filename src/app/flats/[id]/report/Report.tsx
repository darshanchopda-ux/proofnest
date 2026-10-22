import Link from "next/link";
import { BrandMark, Icon } from "@/components/Icon";
import { fmtDate, fmtIST as ist, money, plural } from "@/lib/format";
import { roomStats } from "@/lib/guidance";
import { daysLate, isEarlier } from "@/lib/photo-labels";
import { CONDITIONS, type FlatDTO, type PhotoDTO } from "@/lib/types";
import { EvidenceButton } from "@/components/EvidenceButton";
import { PrintButton } from "./PrintButton";

export function Report({ flat }: { flat: FlatDTO }) {
  const rooms = roomStats(flat);
  const shot = rooms.filter((r) => r.count > 0);
  const missing = rooms.filter((r) => r.count === 0).map((r) => r.name);
  const count = (c: PhotoDTO["condition"]) => flat.photos.filter((p) => p.condition === c).length;
  const flagged = flat.photos.filter((p) => p.condition !== "good");
  const tenant = flat.tenantName || "The tenant";
  // Move-out photos are part of the evidence too: they go in the fingerprints, timestamps and certificate.
  const real = [...flat.photos, ...flat.moveOutPhotos].filter((p) => !p.isExample);
  const live = real.filter((p) => p.capture === "live");
  const earlier = real.filter(isEarlier);
  const late = daysLate(flat.moveIn, flat.photos);
  const outRooms = [...new Set(flat.moveOutPhotos.map((p) => p.room))];
  const out = flat.moveOutAnswer;
  const stamped = real.filter((p) => p.timestampedAt);
  const authorities = [...new Set(stamped.map((p) => p.timestampBy))];
  const answer = flat.ownerAnswer;
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
          {real.length > 0 && <EvidenceButton flat={flat} />}
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
            {late > 1 && ` ${tenant} started this record ${plural(late, "day")} after moving in.`}
            {earlier.length > 0 && ` ${plural(earlier.length, "photo")} marked “earlier” came from ${flat.tenantName ? `${flat.tenantName}'s` : "the tenant's"} gallery and can't be verified by ProofNest.`}
          </p>
        </header>

        {flat.ownerAnswer?.respondedAt && (
          <section className={`rp-owner ${flat.ownerAnswer.status}`}>
            {flat.ownerAnswer.status === "confirmed" ? (
              <p>
                <b>Confirmed by the owner.</b> {flat.ownerAnswer.ownerName} confirmed photos{" "}
                {flat.ownerAnswer.photoNs.map((n) => `P${n}`).join(", ")} on {ist(flat.ownerAnswer.respondedAt)}, through a link the tenant
                sent them.
                {flat.ownerAnswer.stale ? " Photos added or changed after that aren't covered." : ""}
              </p>
            ) : (
              <p>
                <b>The owner disagreed.</b> On {ist(flat.ownerAnswer.respondedAt)}, {flat.ownerAnswer.ownerName} wrote: &ldquo;{flat.ownerAnswer.ownerNote}&rdquo;
              </p>
            )}
            <code>Record fingerprint (SHA-256) {flat.ownerAnswer.recordHash}</code>
          </section>
        )}

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
                  {flat.photos.filter((p) => p.room === room.name).map((p) => <Shot key={p.id} p={p} />)}
                </div>
              </section>
            ))}

            {missing.length > 0 && (
              <p className="rp-missing">Not photographed: {missing.join(", ")}.</p>
            )}

            {flat.moveOutPhotos.length > 0 && (
              <>
                <section className="rp-sec rp-moveout">
                  <h2>At move-out{flat.keysHandedOver ? ` (keys handed over ${fmtDate(flat.keysHandedOver)})` : ""}</h2>
                  <p className="rp-intro">
                    {plural(flat.moveOutPhotos.length, "photo")} taken live as the flat was handed back, to compare with the move-in photos above.
                  </p>
                  {out?.respondedAt && (
                    <p className={`rp-owner ${out.status}`}>
                      {out.status === "confirmed"
                        ? `${out.ownerName} confirmed the handover photos ${out.photoNs.map((n) => `P${n}`).join(", ")} on ${ist(out.respondedAt)}.`
                        : `${out.ownerName} disagreed with the handover photos on ${ist(out.respondedAt)}: “${out.ownerNote}”`}
                    </p>
                  )}
                </section>
                {outRooms.map((room) => (
                  <section className="rp-sec rp-room" key={`out-${room}`}>
                    <h2>{room} at move-out <small>{plural(flat.moveOutPhotos.filter((p) => p.room === room).length, "photo")}</small></h2>
                    <div className="rp-grid">
                      {flat.moveOutPhotos.filter((p) => p.room === room).map((p) => <Shot key={p.id} p={p} />)}
                    </div>
                  </section>
                ))}
              </>
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

            <section className="rp-sec rp-proof">
              <h2>How this record can be checked</h2>
              <ul>
                <li>
                  <b>Fingerprints.</b> Each SHA-256 fingerprint above is of the exact file ProofNest stores. Changing even one pixel changes the
                  fingerprint. To check a file: on a Mac, <code>shasum -a 256 P1.jpg</code>; on Windows, <code>certutil -hashfile P1.jpg SHA256</code>.
                </li>
                <li>
                  <b>Independent timestamps.</b>{" "}
                  {stamped.length
                    ? `${stamped.length} of ${plural(real.length, "photo")} carry an RFC 3161 timestamp from ${authorities.join(" and ")}, a public timestamp authority that doesn't depend on ProofNest. It proves the file with that fingerprint existed at the time shown. To check one: openssl ts -verify -in P1.tsr -data P1.jpg -CAfile cacert.pem -untrusted tsa.crt, using the authority's published certificates.`
                    : "No photo has an independent timestamp yet."}
                </li>
                <li>
                  <b>Live capture.</b>{" "}
                  {live.length
                    ? `${plural(live.length, "photo")} ${live.length === 1 ? "was" : "were"} taken with ProofNest's camera screen, which prints the room, the time in IST and that day's code onto the photo. Day codes are made by ProofNest for each flat and day and can't be known in advance, so an image made earlier can't show one.`
                    : "No photo was taken with ProofNest's camera screen."}{" "}
                  {earlier.length > 0 &&
                    `${plural(earlier.length, "photo")} marked “earlier” ${earlier.length === 1 ? "was" : "were"} added from the tenant's gallery, from before they started using ProofNest. ProofNest can't confirm when ${earlier.length === 1 ? "it was" : "they were"} taken, so treat ${earlier.length === 1 ? "it" : "them"} as supporting evidence only.`}
                </li>
                <li>
                  <b>Upload times</b> come from ProofNest&apos;s server, not the phone, so changing the phone&apos;s clock doesn&apos;t change them.
                </li>
                <li>
                  <b>Owner&apos;s answer.</b>{" "}
                  {answer?.respondedAt
                    ? answer.status === "confirmed"
                      ? `${answer.ownerName} confirmed photos ${answer.photoNs.map((n) => `P${n}`).join(", ")} on ${ist(answer.respondedAt)}, through a link the tenant sent them.`
                      : `${answer.ownerName} disagreed on ${ist(answer.respondedAt)}: "${answer.ownerNote}"`
                    : "The owner hasn't confirmed this record through ProofNest yet."}
                </li>
              </ul>
            </section>

            <section className="rp-sec rp-cert">
              <h2>Certificate for electronic records: Part A (draft)</h2>
              <p className="rp-note">
                A draft prepared by ProofNest for a certificate under Section 63(4)(c) of the Bharatiya Sakshya Adhiniyam, 2023. Check it against the
                form in the Schedule to the Act, ideally with a lawyer, before you sign or file it. Part B, where needed, is completed by an expert.
                Legal information, not legal advice.
              </p>
              <p>
                I, ______________________________, son / daughter / spouse of ______________________________, residing at
                ______________________________________________________________, state as follows:
              </p>
              <ol>
                <li>
                  The electronic records listed below are photographs of {flat.address}
                  {flat.moveIn ? `, taken on or after ${fmtDate(flat.moveIn)} when I moved in,` : ","} with the following device:
                  make and model ______________________________.
                </li>
                <li>
                  They were uploaded to and stored with ProofNest (proofnest-three.vercel.app), a web service I used lawfully, at the times shown, and
                  the device and service were operating properly throughout. {live.length > 0 && "Photos marked “live” were captured through ProofNest's camera screen in my browser."}
                </li>
                <li>The SHA-256 hash value of each record, and its independent timestamp where there is one, is given below.</li>
              </ol>
              <table className="rp-table">
                <thead>
                  <tr><th>Photo</th><th>Room</th><th>SHA-256</th><th>Uploaded</th><th>Timestamped</th></tr>
                </thead>
                <tbody>
                  {real.map((p) => (
                    <tr key={p.id}>
                      <td>P{p.n}{p.capture === "live" ? " (live)" : " (earlier)"}</td>
                      <td>{p.room}{p.phase === "moveout" ? ", move-out" : ""}</td>
                      <td><code>{p.sha256 || "pending"}</code></td>
                      <td>{ist(p.addedAt)}</td>
                      <td>{p.timestampedAt ? `${ist(p.timestampedAt)}, ${p.timestampBy}` : "None"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rp-lines">
                <div><span>Place</span></div>
                <div><span>Signature</span></div>
                <div><span>Date</span></div>
              </div>
            </section>

            <footer className="rp-foot">
              <p>Made with ProofNest. ProofNest gives legal information, not legal advice.</p>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

/** One photo in the record, with everything needed to check it. */
function Shot({ p }: { p: PhotoDTO }) {
  return (
    <figure className={`rp-photo c-${p.condition}`}>
      {p.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route; eager so it prints
        <img src={`${p.src}?w=1200`} alt={`Photo P${p.n}, ${p.room}`} loading="eager" />
      ) : (
        <div className="rp-ph">Example photo</div>
      )}
      <figcaption>
        <div className="rp-cap">
          <b>P{p.n}</b>
          <span className={`rp-cond c-${p.condition}`}>{CONDITIONS[p.condition]}</span>
          {isEarlier(p) && <span className="rp-cond c-worn">Earlier · not verified</span>}
        </div>
        {p.note && <p>{p.note}</p>}
        <small>
          {p.takenAt ? `${p.takenFrom === "camera" ? "Taken" : "File date"} ${ist(p.takenAt)}` : "Capture time unknown"}
          <br />
          Added to ProofNest {ist(p.addedAt)}
          {p.capture === "live" && <><br />Taken live in ProofNest&apos;s camera, stamped with code {p.dayCode}</>}
          {isEarlier(p) && <><br />From the tenant&apos;s gallery; ProofNest can&apos;t confirm when it was taken</>}
          {p.timestampedAt && <><br />Independently timestamped by {p.timestampBy} at {ist(p.timestampedAt)}</>}
        </small>
        {p.sha256 && <code>SHA-256 {p.sha256}</code>}
        {p.src && (
          <span className="rp-files no-print">
            <a href={p.src} download={`P${p.n}.jpg`}>Original file</a>
            {p.timestampedAt && <a href={`/api/photos/${p.id}/timestamp`}>Timestamp (.tsr)</a>}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
