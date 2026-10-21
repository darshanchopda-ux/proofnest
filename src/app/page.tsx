import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { createExampleFlat } from "@/app/flats/actions";
import { getCurrentUser } from "@/lib/dal";
import { listFlats } from "@/lib/flats";
import { fmtDate } from "@/lib/format";

/** A page from an example case file: the owner's deductions as the tenant would check them. */
const LEDGER: { item: string; amount: string; verdict?: { label: string; cls: string }; struck?: boolean }[] = [
  { item: "Painting charges", amount: "₹18,000", verdict: { label: "Wear and tear", cls: "wear_and_tear" }, struck: true },
  { item: "Kitchen tile repair", amount: "₹6,000", verdict: { label: "Already there", cls: "already_there" }, struck: true },
  { item: "Deep cleaning", amount: "₹4,500", verdict: { label: "No bill", cls: "no_receipt" }, struck: true },
  { item: "Electricity bill, Sept", amount: "₹1,850" },
];

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
        <div>
          <span className="eyebrow">For tenants in India</span>
          <h1>Get your security deposit back.</h1>
          <p className="lede">
            Keep a dated record of your flat from the day you move in. When the owner deducts for painting, cleaning or
            &ldquo;damages&rdquo;, check each charge against it and ask for the rest back.
          </p>
          <p className="w-q">Where are you right now?</p>
          <div className="choices">
            <Choice href="/flats/new?stage=movein" title="I'm moving in" sub="Photograph each room before you unpack." go="Start my record" />
            <Choice href="/flats/new?stage=moveout" title="I'm moving out" sub="Check the owner's deductions and ask for your refund." go="Check deductions" />
          </div>
          <form action={createExampleFlat}>
            <button className="linkbtn" type="submit">Or look through an example flat</button>
          </form>
        </div>

        <div className="casefile" aria-label="Example: an owner's deductions, checked">
          <span className="cf-tab">Example · Flat 302, Sunrise Apartments</span>
          <div className="cf-sheet">
            <p className="cf-title">
              Owner&apos;s deductions
              <small>Sent on WhatsApp, 2 Oct 2026. Deposit ₹1,50,000.</small>
            </p>
            <table className="ledger">
              <tbody>
                {LEDGER.map((l) => (
                  <tr key={l.item}>
                    <td>{l.item}</td>
                    <td className="v">{l.verdict && <span className={`chip vstamp ${l.verdict.cls}`}>{l.verdict.label}</span>}</td>
                    <td className={`amt ${l.struck ? "struck" : ""}`}>{l.amount}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td>You ask for back</td>
                  <td />
                  <td className="amt">₹1,48,150</td>
                </tr>
              </tbody>
            </table>
            <p className="cf-note">
              Kitchen tile: photo P1, taken 1 Mar 2024 at 10:02 am, shows the crack on the day the tenant moved in.
            </p>
          </div>
        </div>

        <section className="w-how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol>
            <li>
              <b>Photograph every room</b>
              <p>
                <i>On move-in day.</i> Each photo keeps the time it was taken and a fingerprint of the file, so nobody can say it was edited later.
              </p>
            </li>
            <li>
              <b>Check each deduction</b>
              <p>
                <i>On move-out day.</i> Paste the owner&apos;s message. The AI matches every charge to your photos and your rent agreement; you decide.
              </p>
            </li>
            <li>
              <b>Send the refund letter</b>
              <p>
                <i>The same day.</i> A polite, firm letter in rupees that cites your photos. You send it yourself on WhatsApp or email.
              </p>
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
      <h2 id="yourflats-title" style={{ fontSize: "1.3rem" }}>Your flats</h2>
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
