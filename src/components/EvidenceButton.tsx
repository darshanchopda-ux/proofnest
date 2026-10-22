"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { sha256Hex } from "@/lib/photo-client";
import { makeZip, type ZipEntry } from "@/lib/zip";
import type { FlatDTO } from "@/lib/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "flat";

/**
 * Downloads everything a tenant needs to prove their case without ProofNest: original photos, their RFC 3161
 * timestamp files, the agreement files, a manifest with every fingerprint, and instructions to check them.
 */
export function EvidenceButton({ flat, className = "btn small ghost" }: { flat: FlatDTO; className?: string }) {
  const toast = useToast();
  const [status, setStatus] = useState("");

  async function build() {
    if (status) return;
    const enc = new TextEncoder();
    const entries: ZipEntry[] = [];
    const photos = flat.photos.filter((p) => p.src);
    const listed: Record<string, unknown>[] = [];
    let mismatched = 0;
    try {
      for (const [i, p] of photos.entries()) {
        setStatus(`Packing photo ${i + 1} of ${photos.length}…`);
        const base = `P${String(p.n).padStart(2, "0")}-${slug(p.room)}`;
        const res = await fetch(p.src!, { cache: "no-store" });
        if (!res.ok) throw new Error(`Couldn't fetch P${p.n}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const hash = await sha256Hex(bytes.buffer);
        const matches = !p.sha256 || hash === p.sha256;
        if (!matches) mismatched++;
        entries.push({ name: `photos/${base}.jpg`, data: bytes, date: new Date(p.addedAt) });
        let tsr = "";
        if (p.timestampedAt) {
          const t = await fetch(`/api/photos/${p.id}/timestamp`, { cache: "no-store" });
          if (t.ok) {
            tsr = `timestamps/${base}.tsr`;
            entries.push({ name: tsr, data: new Uint8Array(await t.arrayBuffer()), date: new Date(p.timestampedAt) });
          }
        }
        listed.push({
          photo: `P${p.n}`, room: p.room, phase: p.phase, condition: p.condition, note: p.note,
          capture: p.capture, dayCode: p.dayCode || null, file: `photos/${base}.jpg`, sha256: hash,
          fingerprintMatchesRecord: matches, takenAt: p.takenAt, addedToProofNest: p.addedAt,
          timestamp: p.timestampedAt ? { authority: p.timestampBy, signedAt: p.timestampedAt, file: tsr || null } : null,
        });
      }
      for (const [i, f] of (flat.agreement?.files ?? []).entries()) {
        setStatus(`Packing agreement file ${i + 1}…`);
        const res = await fetch(f.href, { cache: "no-store" });
        if (res.ok) entries.push({ name: `agreement/${f.name.replace(/[\\/]/g, "_")}`, data: new Uint8Array(await res.arrayBuffer()) });
      }
      const made = new Date();
      const manifest = {
        madeWith: "ProofNest (proofnest-three.vercel.app)",
        madeAt: made.toISOString(),
        flat: { address: flat.address, owner: flat.ownerName, tenant: flat.tenantName, movedIn: flat.moveIn, keysHandedOver: flat.keysHandedOver, monthlyRent: flat.monthlyRent, deposit: flat.deposit },
        ownerAnswer: flat.ownerAnswer && { status: flat.ownerAnswer.status, by: flat.ownerAnswer.ownerName, role: flat.ownerAnswer.ownerRole, at: flat.ownerAnswer.respondedAt, note: flat.ownerAnswer.ownerNote, photos: flat.ownerAnswer.photoNs.map((n) => `P${n}`), recordSha256: flat.ownerAnswer.recordHash },
        photos: listed,
        agreement: flat.agreement && { facts: flat.agreement.facts, clauses: flat.agreement.clauses, readAt: flat.agreement.readAt },
        charges: flat.charges.map((c) => ({ item: c.item, amount: c.amount, aiVerdict: c.aiVerdict, decision: c.decision, photos: c.photoNs.map((n) => `P${n}`), reason: c.reason })),
      };
      entries.push({ name: "manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) });
      entries.push({
        name: "README.txt",
        data: enc.encode(
          [
            `ProofNest evidence pack for ${flat.address}`,
            `Made ${made.toString()}`,
            "",
            "Keep this folder safe. It proves your record without needing ProofNest.",
            "",
            "photos/      the original files exactly as ProofNest stored them",
            "timestamps/  RFC 3161 timestamps from a public authority (freetsa.org or DigiCert) for each photo",
            "agreement/   your rent agreement files, if you uploaded them",
            "manifest.json  every photo's fingerprint (SHA-256), times, day codes and the owner's answer",
            "",
            "CHECK A PHOTO'S FINGERPRINT",
            "  Mac:     shasum -a 256 photos/P01-kitchen.jpg",
            "  Windows: certutil -hashfile photos\\P01-kitchen.jpg SHA256",
            "  It must equal the sha256 in manifest.json. Any change to the file changes it.",
            "",
            "CHECK A TIMESTAMP (FreeTSA)",
            "  Download https://freetsa.org/files/cacert.pem and https://freetsa.org/files/tsa.crt, then:",
            "  openssl ts -verify -in timestamps/P01-kitchen.tsr -data photos/P01-kitchen.jpg -CAfile cacert.pem -untrusted tsa.crt",
            "  'Verification: OK' proves the photo existed, unchanged, at the time the authority signed.",
            "",
            mismatched ? `WARNING: ${mismatched} photo(s) didn't match their recorded fingerprint when packed. Ask ProofNest support.` : "All photos matched their recorded fingerprints when this pack was made.",
            "",
            "Also print the move-in record from ProofNest (Move-in record (PDF)) and keep it with this folder.",
            "ProofNest gives legal information, not legal advice.",
          ].join("\r\n"),
        ),
      });
      setStatus("Saving…");
      const url = URL.createObjectURL(makeZip(entries));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProofNest evidence - ${flat.address.replace(/[^\w ,.-]+/g, "").slice(0, 60)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(mismatched ? `Saved, but ${mismatched} photo(s) didn't match their fingerprint.` : `Evidence pack saved: ${photos.length} photos and their timestamps.`, mismatched ? "bad" : undefined);
    } catch (e) {
      toast(e instanceof Error ? `${e.message}. Check your connection and try again.` : "Couldn't make the evidence pack.", "bad");
    } finally {
      setStatus("");
    }
  }

  return (
    <button className={className} type="button" onClick={build} disabled={Boolean(status)}>
      <Icon name="download" small />{status || "Evidence pack (.zip)"}
    </button>
  );
}
