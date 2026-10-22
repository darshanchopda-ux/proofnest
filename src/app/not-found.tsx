import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found · ProofNest" };

/** Shown for any address that doesn't exist, and for flats or links that were deleted or never existed. */
export default function NotFound() {
  return (
    <section className="wrap narrow lost">
      <figure className="lost-print" aria-hidden="true">
        <span className="tape" />
        <div className="lost-img">404</div>
        <figcaption>
          <span><b className="mono">P0</b> Missing room</span>
          <span className="stamp u">Not found</span>
        </figcaption>
      </figure>
      <h1>This page isn&apos;t in the record.</h1>
      <p className="muted">
        The address may be mistyped, or the flat or link was deleted. If someone sent you a link, ask them for a fresh one: owner links stop
        working after 30 days.
      </p>
      <div className="actions">
        <Link className="btn accent" href="/">Go to the home page</Link>
        <Link className="linkbtn" href="/flats/new?stage=movein">Start move-in record</Link>
      </div>
    </section>
  );
}
