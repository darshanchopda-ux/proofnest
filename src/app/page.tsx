import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { createExampleFlat } from "@/app/flats/actions";
import { getCurrentUser } from "@/lib/dal";
import { listFlats } from "@/lib/flats";
import { fmtDate } from "@/lib/format";

const DEMO_LINES: [string, string, boolean?][] = [
  ["Painting charges", "₹18,000"],
  ["Deep cleaning", "₹4,500"],
  ["Kitchen tile repair", "₹6,000", true],
  ["Wardrobe hinge", "₹2,000"],
];

function Choice({ href, icon, title, sub }: { href: string; icon: IconName; title: string; sub: string }) {
  return (
    <Link className="choice" href={href}>
      <span className="cic"><Icon name={icon} /></span>
      <span>
        <b>{title}</b>
        <span className="sub">{sub}</span>
      </span>
      <Icon name="arrow" />
    </Link>
  );
}

export default function Home() {
  return (
    <>
      <section className="wrap welcome">
        <div>
          <span className="eyebrow">For tenants in India</span>
          <h1>Get your full deposit back.</h1>
          <p className="lede">
            Owners often cut painting, cleaning and &ldquo;damages&rdquo; from the security deposit. ProofNest helps you prove what was
            already there when you moved in, and ask for the rest back.
          </p>
          <p className="w-q">Where are you right now?</p>
          <div className="choices">
            <Choice href="/flats/new?stage=movein" icon="key" title="I'm moving in" sub="Record the flat's condition before you unpack" />
            <Choice href="/flats/new?stage=moveout" icon="box" title="I'm moving out" sub="Check the owner's deductions and ask for your refund" />
          </div>
          <form action={createExampleFlat}>
            <button className="linkbtn" type="submit">
              Not sure yet? Explore an example flat <Icon name="arrow" small />
            </button>
          </form>
        </div>
        <div className="w-visual" aria-hidden="true">
          <div className="phone">
            <div className="phone-top">
              <span className="avatar">RS</span>
              <span>
                <b>Owner · WhatsApp</b>
                <small>Deductions from your deposit</small>
              </span>
            </div>
            <div className="bubble">
              {DEMO_LINES.map(([label, amount, hit], i) => (
                <div key={label} className={`bline ${hit ? "hit" : ""}`} style={{ animationDelay: `${200 + i * 140}ms` }}>
                  <span>{label}</span>
                  <span>{amount}</span>
                </div>
              ))}
              <div className="bline tot" style={{ animationDelay: "780ms" }}>
                <span>Total deduction</span>
                <span>₹30,500</span>
              </div>
            </div>
          </div>
          <div className="demo-stamp">
            Already there at move-in<small>P1 · Kitchen · 1 Mar 2024</small>
          </div>
          <div className="demo-photo">
            <div className="tiles" />
            <small><b>P1</b> Kitchen · cracked tile</small>
          </div>
        </div>
        <ol className="w-how">
          <li>
            <span className="n">1</span>
            <span>
              <small>Day you move in</small>
              <b>Record every room</b>
              <p>Photos keep their capture time and a fingerprint, so nobody can say they were edited.</p>
            </span>
          </li>
          <li>
            <span className="n">2</span>
            <span>
              <small>Day you move out</small>
              <b>Check each deduction</b>
              <p>Paste the owner&apos;s message. AI matches every charge to your photos.</p>
            </span>
          </li>
          <li>
            <span className="n">3</span>
            <span>
              <small>Same day</small>
              <b>Send a refund letter</b>
              <p>A polite, firm letter in rupees that cites your photos. You send it.</p>
            </span>
          </li>
        </ol>
      </section>
      <Suspense fallback={null}>
        <YourFlats />
      </Suspense>
    </>
  );
}

async function YourFlats() {
  const user = await getCurrentUser();
  if (!user) return null;
  const flats = await listFlats(user.id);
  if (!flats.length) return null;
  return (
    <section className="wrap yourflats enter" aria-labelledby="yourflats-title">
      <h2 id="yourflats-title" style={{ fontSize: "1.2rem" }}>Your flats</h2>
      <div className="flatlist">
        {flats.map((f) => (
          <Link key={f.id} className="flatcard" href={`/flats/${f.id}`}>
            <b>{f.address}</b>
            <span>
              {f.stage === "moveout" ? "Moving out" : "Moving in"}
              {f.isExample ? " · Example" : ""} · Added {fmtDate(f.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
