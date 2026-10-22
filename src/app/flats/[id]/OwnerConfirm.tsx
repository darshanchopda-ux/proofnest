"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { getOwnerReviewLink } from "@/app/flats/actions";
import { fmtDate, fmtIST, plural } from "@/lib/format";
import type { FlatDTO } from "@/lib/types";

const ROLE_WORDS: Record<string, string> = { agent: "the owner's broker or agent", family: "a family member of the owner" };

/** Asking the owner to confirm the move-in (or move-out) record: make the link, send it on WhatsApp, see their answer. */
export function OwnerConfirm({ flat, setFlat, kind }: { flat: FlatDTO; setFlat: Dispatch<SetStateAction<FlatDTO>>; kind: "movein" | "moveout" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const out = kind === "moveout";
  const r = out ? flat.moveOutReview : flat.ownerReview;
  const a = out ? flat.moveOutAnswer : flat.ownerAnswer;
  const count = out ? flat.moveOutPhotos.length : flat.photos.length;
  // Who actually answered matters if it wasn't the owner: a broker's or relative's confirmation is weaker.
  const by = (x: NonNullable<typeof a>) => (ROLE_WORDS[x.ownerRole] ? `${x.ownerName} (${ROLE_WORDS[x.ownerRole]})` : x.ownerName);
  const earlier = a && r && a.token !== r.token ? a : null;
  const span = (ns: number[]) => (ns.length > 1 ? `P${ns[0]}–P${ns[ns.length - 1]}` : `P${ns[0]}`);
  const path = r ? `/confirm/${r.token}` : "";
  // Built when clicked, since the full address is only known in the browser.
  const link = () => window.location.origin + path;
  const owner = r?.ownerName || flat.ownerName || "your owner";
  const range = r ? (r.photoNs.length > 1 ? `P${r.photoNs[0]}–P${r.photoNs[r.photoNs.length - 1]}` : `P${r.photoNs[0]}`) : "";

  // Kept short and friendly: many tenants worry that asking will annoy the owner, so it reads as routine paperwork.
  const message = () =>
    [
      `Hello${flat.ownerName ? ` ${flat.ownerName}` : ""},`,
      "",
      out
        ? `For both our records, here are photos of ${flat.address} as I'm handing it back${flat.keysHandedOver ? ` (${fmtDate(flat.keysHandedOver)})` : ""}. Could you have a look and confirm the condition? It takes a minute and needs no account:`
        : `For both our records, here are the photos I took of ${flat.address} on move-in day${flat.moveIn ? ` (${fmtDate(flat.moveIn)})` : ""}. Could you have a look and confirm they show the flat's condition? It takes a minute and needs no account:`,
      link(),
      "",
      "Thank you,",
      flat.tenantName || "",
    ].join("\n").trim();

  async function makeLink() {
    setBusy(true);
    const result = await getOwnerReviewLink(flat.id, kind);
    setBusy(false);
    if (!result.ok) return toast(result.error, "bad");
    setFlat((f) => (out ? { ...f, moveOutReview: result.data } : { ...f, ownerReview: result.data }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      toast("Link copied. Paste it into WhatsApp or email to your owner.");
    } catch {
      toast("Copy didn't work here. Select the link and copy it yourself.", "bad");
    }
  }

  const sendButtons = (
    <div className="actions" style={{ margin: 0 }}>
      <button className="btn accent small" type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener")}>
        <Icon name="chat" small />Send on WhatsApp
      </button>
      <button className="btn ghost small" type="button" onClick={copy}><Icon name="copy" small />Copy link</button>
      <a className="linkbtn" href={path} target="_blank" rel="noopener">See what your owner sees</a>
    </div>
  );
  const newLinkButton = (label: string) => (
    <button className="btn small" type="button" onClick={makeLink} disabled={busy}>{busy ? "Making the link…" : label}</button>
  );

  let body;
  if (!r) {
    body = (
      <>
        {out ? (
          <p>
            Send {owner} a link on WhatsApp before you hand over the keys. They look through these {plural(count, "photo")} and confirm the
            condition in one tap, without an account. Their answer is timestamped, so a damage claim made after you leave has to explain why
            they confirmed the flat was fine.
          </p>
        ) : (
          <p>
            Send {owner} a link on WhatsApp. They look through these {plural(count, "photo")} and confirm in one tap, without an
            account. Their answer is timestamped and goes on your move-in record, so they can&apos;t say later that the flat was different.
          </p>
        )}
        <p className="hint">
          Not sure about asking? It&apos;s routine paperwork, and the message is written to sound that way. If they don&apos;t answer, the
          WhatsApp message itself shows you shared the photos on this date.
        </p>
        <div className="actions" style={{ margin: 0 }}>{newLinkButton("Get the owner link")}</div>
      </>
    );
  } else if (r.status === "pending" && !r.stale) {
    body = (
      <>
        <p className="oc-state"><i className="dotp" />Waiting for {owner} to confirm {range}. Link made {fmtIST(r.createdAt)}.</p>
        {earlier && (
          <p>
            {earlier.status === "confirmed" ? `${by(earlier)} already confirmed ${span(earlier.photoNs)}` : `${by(earlier)} answered about ${span(earlier.photoNs)}`} on{" "}
            {fmtIST(earlier.respondedAt!)}. That still stands; this link covers your latest photos.
          </p>
        )}
        {sendButtons}
      </>
    );
  } else if (r.status === "pending") {
    body = (
      <>
        <p className="oc-state">You&apos;ve changed your photos since making the link. Make a new one so {owner} confirms the latest record; the old link will stop working.</p>
        <div className="actions" style={{ margin: 0 }}>{newLinkButton("Make a new link")}</div>
      </>
    );
  } else if (r.status === "confirmed") {
    body = (
      <>
        <p className="oc-state ok"><Icon name="check" small />{by(r)} confirmed {range} on {fmtIST(r.respondedAt!)}.</p>
        {r.ownerRole && r.ownerRole !== "owner" && (
          <p>The person who answered says they aren&apos;t the owner. Keep it, and ask the owner to confirm too if you can.</p>
        )}
        {r.stale && (
          <>
            <p>You&apos;ve added or changed photos since. Their confirmation covers only {range}; make a new link to cover the rest.</p>
            <div className="actions" style={{ margin: 0 }}>{newLinkButton("Make a new link")}</div>
          </>
        )}
      </>
    );
  } else {
    body = (
      <>
        <p className="oc-state warn">{by(r)} said something isn&apos;t right ({fmtIST(r.respondedAt!)}):</p>
        <blockquote>&ldquo;{r.ownerNote}&rdquo;</blockquote>
        <p>Talk to them, fix or add photos if needed, then make a new link.</p>
        <div className="actions" style={{ margin: 0 }}>{newLinkButton("Make a new link")}</div>
      </>
    );
  }

  return (
    <section className={`owner-confirm ${r?.status ?? "none"}`} id={out ? "owner-confirm-moveout" : "owner-confirm"} aria-labelledby={`oc-title-${kind}`}>
      <h3 id={`oc-title-${kind}`}>
        {r?.status === "confirmed" ? "Confirmed by your owner" : r?.status === "disputed" ? "Your owner's answer" : out ? "Ask your owner to confirm the handover" : "Ask your owner to confirm this record"}
      </h3>
      {body}
    </section>
  );
}
