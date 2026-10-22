import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · ProofNest",
  description: "What ProofNest collects, why, where it is kept, and how to see, fix or delete it.",
};

/** Contact for privacy questions and grievances, set per deployment so no personal address is written into the code. */
const contact = process.env.GRIEVANCE_CONTACT ?? "";

export default function PrivacyPage() {
  return (
    <article className="wrap narrow prose">
      <p className="eyebrow">Privacy notice · updated 22 October 2026</p>
      <h1>Your data on ProofNest</h1>
      <p>
        ProofNest helps tenants in India keep a dated record of a rented flat and get their deposit back. This notice explains what we keep and
        why, as the Digital Personal Data Protection Act, 2023 asks. It is written to be read in five minutes.
      </p>

      <h2>What we keep, and why</h2>
      <ul>
        <li><b>Your mobile number or email</b>, to sign you in. For WhatsApp sign-in we keep only a scrambled copy of each code, for 5 minutes.</li>
        <li><b>Flat details you type</b>: address, names, dates, rent, deposit and payment reference, to build your record and letter.</li>
        <li><b>Photos you take</b>, with when they were taken, a fingerprint (SHA-256) and a public timestamp, so they can serve as evidence.</li>
        <li><b>Your rent agreement</b>, if you upload it, so the AI can read its terms.</li>
        <li><b>The owner&apos;s answer</b> when they confirm your record: the name they type, who they say they are, and their note.</li>
        <li><b>Sign-ins</b>: the device type, network address and time, so you can spot sign-ins that weren&apos;t you.</li>
      </ul>
      <p>We don&apos;t sell your data, show ads, or use it for anything except running ProofNest for you.</p>

      <h2>Who else handles it</h2>
      <ul>
        <li><b>Neon</b> (database) and <b>Vercel</b> (website and private photo storage). Their servers may be outside India.</li>
        <li><b>Meta (WhatsApp)</b> delivers your sign-in code.</li>
        <li>
          <b>Google Gemini</b>, through an n8n workflow server, only when you press an AI button (read agreement, check deductions, write letter).
          ProofNest uses Gemini&apos;s free tier, under which Google may use what is sent to improve its products. Don&apos;t press those buttons
          for anything you don&apos;t want shared; the template letter and everything else work without AI.
        </li>
        <li><b>FreeTSA or DigiCert</b> receive only each photo&apos;s fingerprint, never the photo, to timestamp it.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li><b>See and take your data</b>: download the evidence pack (photos, timestamps and a manifest) from any flat.</li>
        <li><b>Correct it</b>: edit any detail, note or photo label on the flat page.</li>
        <li><b>Delete it</b>: delete a flat, or your whole account and everything in it, from <Link href="/account">your account</Link>.</li>
        <li><b>Withdraw consent</b>: deleting your account withdraws it. Data already sent to Gemini is covered by Google&apos;s terms.</li>
      </ul>
      <p>We keep your data until you delete it, so your record is there when you move out, however many years later.</p>

      <h2>Questions and complaints</h2>
      {contact ? (
        <p>Write to our grievance contact at <b>{contact}</b>. We reply within 7 days. If you&apos;re not satisfied, you can complain to the Data Protection Board of India.</p>
      ) : (
        <p>
          ProofNest is in a pilot. A grievance contact will be listed here before it opens to the public. Until then, use the contact on the
          page where you found ProofNest. You can also complain to the Data Protection Board of India.
        </p>
      )}
      <p className="hint">ProofNest gives legal information, not legal advice.</p>
    </article>
  );
}
