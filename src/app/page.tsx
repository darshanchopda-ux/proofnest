import Link from "next/link";
import { Suspense } from "react";
import { HeroBoard3D } from "@/components/HeroBoard3D";
import { Icon } from "@/components/Icon";
import { Reveal, RevealItem } from "@/components/motion";
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
          <h1 id="hero-title" className="rise" style={{ "--d": 0 } as React.CSSProperties}>Your deposit, backed by proof.</h1>
          <p className="lede rise" style={{ "--d": 1 } as React.CSSProperties}>
            Photograph your flat on move-in day. Every photo is sealed with the time and a public timestamp, so your owner can&apos;t call it
            old, edited or fake when you move out.
          </p>
          <div className="h-cta rise" style={{ "--d": 2 } as React.CSSProperties}>
            <Link className="btn accent big" href="/flats/new?stage=movein">
              Start move-in record<Icon name="arrow" small />
            </Link>
            <Link className="linkbtn" href="/flats/new?stage=moveout">Moving out? Check the owner&apos;s deductions</Link>
          </div>
          <div className="h-note rise" style={{ "--d": 3 } as React.CSSProperties}>
            <p>Free. No password: you sign in with a code on WhatsApp.</p>
            <form action={createExampleFlat} className="example-link">
              <ExampleButton />
            </form>
          </div>
        </div>
        <HeroBoard3D>
          <SampleRecord />
        </HeroBoard3D>
      </section>

      <Suspense fallback={null}>
        <YourFlats />
      </Suspense>

      <section className="wrap proof" aria-labelledby="proof-title">
        <h2 id="proof-title">How the proof works</h2>
        <Reveal as="dl" className="proof-list" stagger={0.1}>
          <RevealItem>
            <dt>Taken live, in the flat</dt>
            <dd>
              Photos come from ProofNest&apos;s own camera, never your gallery. The room, the time and that day&apos;s code are printed on each one,
              and a code can&apos;t be known in advance.
            </dd>
          </RevealItem>
          <RevealItem>
            <dt>Sealed by a public clock</dt>
            <dd>
              Each photo&apos;s fingerprint is timestamped by an independent authority. Anyone can check the photo existed at that moment,
              without having to trust ProofNest.
            </dd>
          </RevealItem>
          <RevealItem>
            <dt>Confirmed by your owner</dt>
            <dd>
              Send one WhatsApp link. Your owner looks through the photos and confirms in a tap, with no account. Their answer is dated and
              goes on your record.
            </dd>
          </RevealItem>
        </Reveal>
        <div className="proof-after">
          <p>
            <b>At move-out,</b> paste the owner&apos;s deductions. ProofNest checks each charge against your photos and rent agreement, you
            decide what to dispute, and it writes a polite, firm letter asking for the rest of your deposit, down to the last rupee.
          </p>
        </div>
      </section>

      <section className="wrap whosees" aria-labelledby="who-title">
        <h2 id="who-title">Who can see your photos</h2>
        <Reveal as="ul">
          <RevealItem as="li"><b>You.</b> Your flats are private to your account.</RevealItem>
          <RevealItem as="li"><b>Your owner,</b> only if you send them the link. It stops working after 30 days.</RevealItem>
          <RevealItem as="li"><b>Flatmates,</b> only if you invite them.</RevealItem>
        </Reveal>
        <p className="muted">
          You can download everything as an evidence pack, or delete it all, at any time. <Link href="/privacy">Read the privacy notice</Link>.
        </p>
      </section>
    </>
  );
}

/** The product's core idea, shown rather than described: three sealed prints from a move-in record. */
function SampleRecord() {
  return (
    <div className="board" aria-label="Example: three photos from a move-in record, each sealed with its time">
      <Print n={1} room="Kitchen" cond="damaged" note="Two cracked tiles by the sink" time="10:02 am">
        <TileWall />
      </Print>
      <Print n={2} room="Bedroom" cond="worn" note="Wardrobe hinge loose" time="10:06 am">
        <Wardrobe />
      </Print>
      <Print n={3} room="Hall" cond="good" note="Switchboard, walls clean" time="10:09 am">
        <HallWall />
      </Print>
      <p className="board-note">
        <span className="stamp">Sealed</span> Taken live in the flat, timestamped by a public authority, then confirmed by the owner.
      </p>
    </div>
  );
}

function Print({ n, room, cond, note, time, children }: { n: number; room: string; cond: "good" | "worn" | "damaged"; note: string; time: string; children: React.ReactNode }) {
  return (
    <figure className={`bprint bp-${n}`}>
      <span className="tape" aria-hidden="true" />
      <div className="bimg">
        {children}
        <span className="ex-band">ProofNest · {room} · 1 Mar 2024, {time} · 7QK4</span>
      </div>
      <figcaption>
        <span><b className="mono">P{n}</b> {room}</span>
        <span className={`cond c-${cond}`}>{cond === "good" ? "Good" : cond === "worn" ? "Worn" : "Damaged"}</span>
        <small>{note}</small>
      </figcaption>
    </figure>
  );
}

/** A wardrobe door, slightly ajar on a loose hinge. */
function Wardrobe() {
  return (
    <svg className="ex-wall" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="300" fill="hsl(40 30% 86%)" />
      <rect x="70" y="20" width="260" height="250" rx="3" fill="hsl(30 38% 52%)" />
      <rect x="80" y="30" width="116" height="230" rx="2" fill="hsl(30 40% 57%)" />
      <path d="M204 30 L322 36 L322 254 L204 260 Z" fill="hsl(30 40% 60%)" />
      <rect x="198" y="30" width="6" height="230" fill="hsl(30 30% 28%)" />
      <rect x="182" y="130" width="6" height="34" rx="3" fill="hsl(40 10% 85%)" />
      <rect x="212" y="132" width="6" height="34" rx="3" fill="hsl(40 10% 85%)" />
      <rect x="318" y="58" width="8" height="16" rx="1" fill="hsl(40 8% 70%)" transform="rotate(14 322 66)" />
      <rect y="270" width="400" height="30" fill="hsl(30 15% 70%)" />
    </svg>
  );
}

/** A painted hall wall with a switchboard and a faded patch around it. */
function HallWall() {
  return (
    <svg className="ex-wall" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="300" fill="hsl(38 32% 84%)" />
      <ellipse cx="200" cy="128" rx="92" ry="70" fill="hsl(38 30% 90%)" />
      <rect x="150" y="96" width="100" height="64" rx="4" fill="hsl(40 20% 97%)" stroke="hsl(40 8% 74%)" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={162 + i * 20} y="110" width="14" height="22" rx="2" fill="hsl(40 10% 88%)" stroke="hsl(40 6% 70%)" />
      ))}
      <circle cx="232" cy="146" r="5" fill="hsl(40 6% 70%)" />
      <rect y="262" width="400" height="38" fill="hsl(30 12% 64%)" />
      <rect y="258" width="400" height="6" fill="hsl(30 14% 72%)" />
    </svg>
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
