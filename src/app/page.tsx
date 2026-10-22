import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { ProofSeal } from "@/components/ProofSeal";
import { createExampleFlat } from "@/app/flats/actions";
import { ExampleButton } from "./ExampleButton";
import { getCurrentUser } from "@/lib/dal";
import { listFlats } from "@/lib/flats";
import { fmtDate } from "@/lib/format";

export default function Home() {
  return (
    <>
      <section className="wrap hero" aria-labelledby="hero-title">
        <div className="h-copy">
          <h1 id="hero-title">Your deposit, backed by proof.</h1>
          <p className="lede">
            Photograph your flat on move-in day. Every photo is sealed with the time and a public timestamp, so your owner can&apos;t call it
            old, edited or fake when you move out.
          </p>
          <div className="h-cta">
            <Link className="btn accent big" href="/flats/new?stage=movein">
              Start move-in record<Icon name="arrow" small />
            </Link>
            <Link className="linkbtn" href="/flats/new?stage=moveout">Moving out? Check the owner&apos;s deductions</Link>
          </div>
          <div className="h-note">
            <p>Free. No password: you sign in with a code on WhatsApp.</p>
            <form action={createExampleFlat} className="example-link">
              <ExampleButton />
            </form>
          </div>
        </div>
        <SampleRecord />
      </section>

      <Suspense fallback={null}>
        <YourFlats />
      </Suspense>

      <section className="wrap proof" aria-labelledby="proof-title">
        <h2 id="proof-title">How the proof works</h2>
        <dl className="proof-cols">
          <div>
            <dt>Taken live, in the flat</dt>
            <dd>
              Photos come from ProofNest&apos;s own camera, never your gallery. The room, the time and that day&apos;s code are printed on each one,
              and a code can&apos;t be known in advance.
            </dd>
          </div>
          <div>
            <dt>Sealed by a public clock</dt>
            <dd>
              Each photo&apos;s fingerprint is timestamped by an independent authority. Anyone can check the photo existed at that moment,
              without having to trust ProofNest.
            </dd>
          </div>
          <div>
            <dt>Confirmed by your owner</dt>
            <dd>
              Send one WhatsApp link. Your owner looks through the photos and confirms in a tap, with no account. Their answer is dated and
              goes on your record.
            </dd>
          </div>
        </dl>
        <div className="proof-after">
          <p>
            <b>At move-out,</b> paste the owner&apos;s deductions. ProofNest checks each charge against your photos and rent agreement, you
            decide what to dispute, and it writes a polite, firm letter asking for the rest of your deposit, down to the last rupee.
          </p>
        </div>
      </section>

      <section className="wrap whosees" aria-labelledby="who-title">
        <h2 id="who-title">Who can see your photos</h2>
        <ul>
          <li><b>You.</b> Your flats are private to your account.</li>
          <li><b>Your owner,</b> only if you send them the link. It stops working after 30 days.</li>
          <li><b>Flatmates,</b> only if you invite them.</li>
        </ul>
        <p className="muted">
          You can download everything as an evidence pack, or delete it all, at any time. <Link href="/privacy">Read the privacy notice</Link>.
        </p>
      </section>
    </>
  );
}

/** A real-looking move-in record: the product's core idea, shown instead of described. */
function SampleRecord() {
  return (
    <figure className="exhibit" aria-label="Example of a sealed move-in photo">
      <div className="ex-photo">
        <TileWall />
        <span className="ex-tag">P1</span>
        <ProofSeal center="7QK4" sub="LIVE PHOTO" bottom="1 MAR 2024 · 10:02 IST" size={112} press label="Sealed: taken live on 1 Mar 2024 at 10:02 am IST, code 7QK4" />
        <span className="ex-band">ProofNest · Kitchen · 1 Mar 2024, 10:02 am IST · Code 7QK4</span>
      </div>
      <figcaption>
        <div className="ex-head">
          <b>Kitchen</b>
          <span className="cond c-damaged">Damaged</span>
        </div>
        <p className="ex-note">Two cracked wall tiles next to the sink.</p>
        <dl className="ex-facts">
          <div><dt>Taken</dt><dd>1 Mar 2024, 10:02 am IST</dd></div>
          <div><dt>Timestamped</dt><dd>freetsa.org, 10:02:41 am</dd></div>
          <div><dt>Fingerprint</dt><dd>9f2c 4e8a 1b7d 3f6e…</dd></div>
          <div className="ok"><dt>Owner</dt><dd>R. Sharma confirmed, 2 Mar 2024</dd></div>
        </dl>
      </figcaption>
    </figure>
  );
}

/** A kitchen wall of glazed tiles with a hairline crack, drawn rather than photographed. */
function TileWall() {
  const tiles = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 8; c++) {
      const shade = ((r * 7 + c * 13) % 5) * 1.6;
      tiles.push(<rect key={`${r}-${c}`} x={c * 50 + 1.5} y={r * 50 + 1.5} width={47} height={47} rx={1.5} fill={`hsl(80 10% ${90 - shade}%)`} />);
    }
  }
  return (
    <svg className="ex-wall" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="300" fill="hsl(80 6% 74%)" />
      {tiles}
      <rect y="242" width="400" height="58" fill="hsl(150 6% 20%)" />
      <rect y="242" width="400" height="5" fill="hsl(150 5% 30%)" />
      <path d="M232 52 l-9 14 l6 9 l-11 19 l4 8 l-8 15 l3 11 l-6 13 l2 9" fill="none" stroke="hsl(80 8% 34%)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M223 66 l-12 4 M218 94 l13 6" fill="none" stroke="hsl(80 8% 40%)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

async function YourFlats() {
  const user = await getCurrentUser();
  if (!user) return null;
  const flats = await listFlats(user.id);
  if (!flats.length) return null;
  return (
    <section className="wrap yourflats" aria-labelledby="yourflats-title">
      <h2 id="yourflats-title">Your flats</h2>
      <div className="flatlist">
        {flats.map((f) => (
          <Link key={f.id} className="flatcard" href={`/flats/${f.id}`}>
            <b>{f.address}</b>
            <span className="mono">
              {f.stage === "moveout" ? "Moving out" : "Moving in"}
              {f.isExample ? " · Example" : ""}{f.userId !== user.id ? " · Shared by a flatmate" : ""} · Added {fmtDate(f.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
