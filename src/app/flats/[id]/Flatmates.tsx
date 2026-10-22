"use client";

import { useRouter } from "next/navigation";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { createFlatInvite, removeMember, setMemberShare } from "@/app/flats/members";
import { money } from "@/lib/format";
import type { FlatDTO, MemberDTO } from "@/lib/types";

/** Flatmates who share this flat's record, their part of the deposit, and one-time invite links. */
export function Flatmates({ flat, setFlat }: { flat: FlatDTO; setFlat: Dispatch<SetStateAction<FlatDTO>> }) {
  const toast = useToast();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = flat.access === "owner";
  const deposit = Number(flat.deposit) || 0;
  const shared = flat.members.reduce((n, m) => n + (m.depositShare ?? 0), 0);

  async function invite() {
    setBusy(true);
    const result = await createFlatInvite(flat.id).catch(() => ({ ok: false as const, error: "Couldn't make the link. Check your connection." }));
    setBusy(false);
    if (!result.ok) return toast(result.error, "bad");
    setLink(`${window.location.origin}/join/${result.data}`);
  }

  async function share(m: MemberDTO, value: string) {
    const result = await setMemberShare(flat.id, m.id, value).catch(() => ({ ok: false as const, error: "Couldn't save the share." }));
    if (!result.ok) return toast(result.error, "bad");
    setFlat((f) => ({ ...f, members: f.members.map((x) => (x.id === m.id ? { ...x, depositShare: result.data } : x)) }));
  }

  async function remove(m: MemberDTO) {
    const result = await removeMember(flat.id, m.id).catch(() => ({ ok: false as const, error: "Couldn't remove them. Check your connection." }));
    if (!result.ok) return toast(result.error, "bad");
    if (m.isYou) {
      router.push("/");
      return;
    }
    setFlat((f) => ({ ...f, members: f.members.filter((x) => x.id !== m.id) }));
  }

  const message = () =>
    `I've started a record of our flat (${flat.address}) on ProofNest, with dated photos of every room for the deposit. Join it here so we both have it: ${link}`;

  return (
    <div className="sec flatmates">
      <h3 className="mini">Flatmates</h3>
      <p className="hint" style={{ margin: 0 }}>
        Everyone on the flat sees the same record and can add photos. {owner ? "Only you can delete the flat." : "The flatmate who added it can delete it."}
      </p>
      {flat.members.length > 0 && (
        <ul className="fm-list">
          {flat.members.map((m) => (
            <li key={m.id}>
              <b>{m.name || "Flatmate"}{m.isYou ? " (you)" : ""}</b>
              <label className="sr" htmlFor={`fm-${m.id}`}>{m.name ? `${m.name}'s` : "Flatmate's"} part of the deposit</label>
              <input
                id={`fm-${m.id}`}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Their share ₹"
                defaultValue={m.depositShare ?? ""}
                onBlur={(e) => {
                  if (String(m.depositShare ?? "") !== e.target.value) void share(m, e.target.value);
                }}
              />
              {(owner || m.isYou) && (
                <button className="btn small ghost" type="button" onClick={() => remove(m)}>{m.isYou ? "Leave flat" : "Remove"}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {deposit > 0 && shared > 0 && (
        <p className="hint" style={{ margin: 0 }}>
          {shared > deposit
            ? `The shares add up to ${money(shared)}, more than the ${money(deposit)} deposit.`
            : `Flatmates' shares: ${money(shared)}. The rest, ${money(deposit - shared)}, is ${owner ? "yours" : "the share of the flatmate who added the flat"}.`}
        </p>
      )}
      {owner &&
        (link ? (
          <div className="fm-link">
            <code>{link}</code>
            <div className="actions" style={{ margin: 0 }}>
              <button className="btn small accent" type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener")}>
                <Icon name="chat" small />Send on WhatsApp
              </button>
              <button
                className="btn small ghost"
                type="button"
                onClick={() => navigator.clipboard.writeText(link).then(() => toast("Invite link copied."), () => toast("Copy didn't work here. Select the link and copy it.", "bad"))}
              >
                <Icon name="copy" small />Copy
              </button>
            </div>
            <p className="hint" style={{ margin: 0 }}>Works once, for 7 days. Make one link per flatmate.</p>
          </div>
        ) : (
          <button className="btn small ghost" type="button" onClick={invite} disabled={busy} style={{ justifySelf: "start" }}>
            {busy ? "Making the link…" : "Invite a flatmate"}
          </button>
        ))}
    </div>
  );
}
