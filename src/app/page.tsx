import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { createExampleFlat } from "@/app/flats/actions";
import { ExampleButton } from "./ExampleButton";
import { getCurrentUser } from "@/lib/dal";
import { listFlats } from "@/lib/flats";
import { fmtDate } from "@/lib/format";

function Choice({ href, title, sub, go }: { href: string; title: string; sub: string; go: string }) {
  return (
    <Link className="choice" href={href}>
      <b>{title}</b>
      <span className="sub">{sub}</span>
      <span className="go">{go}<Icon name="arrow" small /></span>
    </Link>
  );
}

export default function Home() {
  return (
    <>
      <section className="wrap welcome">
        <div className="hero">
          <h1>Get your security deposit back.</h1>
          <p className="lede">
            Keep a dated photo record of your flat from move-in day. When the owner deducts for painting, cleaning or &ldquo;damages&rdquo;,
            check each charge against it and ask for the rest back.
          </p>
          <p className="w-q">Where are you right now?</p>
          <div className="choices">
            <Choice href="/flats/new?stage=movein" title="I'm moving in" sub="Photograph each room before you unpack." go="Start my record" />
            <Choice href="/flats/new?stage=moveout" title="I'm moving out" sub="Check the owner's deductions and ask for your refund." go="Check deductions" />
          </div>
          <form action={createExampleFlat} className="example-link">
            <ExampleButton />
          </form>
        </div>

        <section className="w-how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol>
            <li>
              <b>Photograph every room</b>
              <p>On move-in day. Each photo keeps the time it was taken, and your owner can confirm the record from a WhatsApp link.</p>
            </li>
            <li>
              <b>Check each deduction</b>
              <p>On move-out day. AI matches every charge to your photos and rent agreement. You decide what to dispute.</p>
            </li>
            <li>
              <b>Send the refund letter</b>
              <p>A polite, firm letter in rupees that cites your photos. You send it yourself.</p>
            </li>
          </ol>
        </section>
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
    <section className="wrap yourflats" aria-labelledby="yourflats-title">
      <h2 id="yourflats-title" style={{ fontSize: "1.1rem" }}>Your flats</h2>
      <div className="flatlist">
        {flats.map((f) => (
          <Link key={f.id} className="flatcard" href={`/flats/${f.id}`}>
            <b>{f.address}</b>
            <span>
              {f.stage === "moveout" ? "Moving out" : "Moving in"}
              {f.isExample ? " · Example" : ""}{f.userId !== user.id ? " · Shared by a flatmate" : ""} · Added {fmtDate(f.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
