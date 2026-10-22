import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms · ProofNest",
  description: "The terms for using ProofNest: what it does, what it doesn't, and what we each agree to.",
};

/** Same contact as the privacy notice, set per deployment so no personal address is written into the code. */
const contact = process.env.GRIEVANCE_CONTACT ?? "";

export default function TermsPage() {
  return (
    <article className="wrap narrow prose">
      <p className="eyebrow">Terms of use · updated 22 October 2026</p>
      <h1>Terms of use</h1>
      <p>
        These terms apply when you use ProofNest. They&apos;re short on purpose. By creating an account you agree to them, along with the{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>What ProofNest does</h2>
      <p>
        ProofNest helps tenants keep a dated photo record of a rented home, ask the owner to confirm it, check deposit deductions and write a
        refund letter. It is in a pilot, free to use, and may change or pause while we improve it.
      </p>

      <h2>What it doesn&apos;t do</h2>
      <ul>
        <li><b>It isn&apos;t legal advice.</b> ProofNest gives general legal information. For a dispute that matters to you, talk to a lawyer.</li>
        <li><b>The AI can be wrong.</b> Its verdicts on deductions are suggestions. You decide what to dispute, and you check every letter before you send it.</li>
        <li><b>It can&apos;t promise an outcome.</b> A good record makes your case stronger; it doesn&apos;t guarantee your deposit comes back.</li>
        <li><b>It never contacts your owner for you.</b> You choose what to send, and when.</li>
      </ul>

      <h2>What you agree to</h2>
      <ul>
        <li>Photograph only homes you rent, or are moving into or out of, and keep the record honest.</li>
        <li>Don&apos;t upload other people&apos;s personal details beyond what the record needs, and don&apos;t use ProofNest to harass anyone.</li>
        <li>Keep your phone and account secure. If you lose your number, switch it off from your <Link href="/account">account</Link>.</li>
        <li>Don&apos;t try to break, overload or get around ProofNest&apos;s limits and security.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your photos, notes and letters stay yours. You let us store and process them only to run ProofNest for you, including sending them to the
        AI when you press an AI button. You can download an evidence pack or delete everything at any time.
      </p>

      <h2>Owners and flatmates</h2>
      <p>
        An owner who opens your link sees the photos you chose to share, and their answer is saved with the time. A flatmate you invite can see and
        add to the same record. The person who added the flat is the only one who can delete it.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        We work to keep ProofNest available and your data safe, but it is provided as it is, without guarantees. To the extent the law allows,
        we aren&apos;t responsible for losses from relying on it, from downtime, or from a decision your owner or a court makes. Keep your own
        copy of anything important by downloading the evidence pack.
      </p>

      <h2>Changes and ending</h2>
      <p>
        We may update these terms; the date at the top will change, and we&apos;ll tell you in the app about anything significant. You can stop
        using ProofNest and delete your account whenever you like. We may close accounts that break these terms. These terms are governed by
        the laws of India.
      </p>

      <h2>Contact</h2>
      {contact ? (
        <p>Questions or complaints: <b>{contact}</b>.</p>
      ) : (
        <p>ProofNest is in a pilot. A contact address will be listed here before it opens to the public.</p>
      )}
    </article>
  );
}
