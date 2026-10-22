"use client";

import type { Dispatch, SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { moveOutRooms } from "@/lib/guidance";
import { pendingKey } from "@/lib/photo-labels";
import { plural } from "@/lib/format";
import { CONDITIONS, type FlatDTO, type FlatPatch, type PhotoDTO, type Step } from "@/lib/types";
import { OwnerConfirm } from "./OwnerConfirm";
import { PhotoCard } from "./RecordStep";

type Props = {
  flat: FlatDTO;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  pending: Record<string, number>;
  freshIds: Set<string>;
  /** Opens ProofNest's camera for a room's move-out photos. */
  onCamera: (room: string) => void;
  onZoom: (photo: PhotoDTO) => void;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  onStep: (s: Step) => void;
};

/**
 * The flat as the tenant hands it back: the same live photos as at move-in, room by room, shown beside the move-in
 * ones, and a link for the owner to confirm the handover before the keys go back.
 */
export function MoveOutStep({ flat, setFlat, pending, freshIds, onCamera, onZoom, patchFlat, onStep }: Props) {
  const rooms = moveOutRooms(flat);
  const done = rooms.filter((r) => r.after).length;

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="ttl"><h2>Move-out record</h2></div>
          <p>On your last day, take the same photos again before you return the keys. Each room shows your move-in photos beside the new ones.</p>
        </div>
      </div>

      <div className="mo-handover">
        <label className="lab" htmlFor="mo-keys">Keys handed over on</label>
        <input id="mo-keys" type="date" value={flat.keysHandedOver ?? ""} onChange={(e) => patchFlat({ keysHandedOver: e.target.value || null })} />
        <span className="hint">{rooms.length ? `${done} of ${plural(rooms.length, "room")} photographed` : "Add rooms on the move-in tab first"}</span>
      </div>

      {rooms.map((r, i) => {
        const before = flat.photos.filter((p) => p.room === r.name);
        const after = flat.moveOutPhotos.filter((p) => p.room === r.name);
        const waiting = pending[pendingKey("moveout", r.name)] ?? 0;
        return (
          <section className="room mo-room" id={`moveout-room-${i}`} key={r.name}>
            <div className="room-head">
              <h3>{r.name}</h3>
              <span className="count">{after.length ? plural(after.length, "move-out photo") : "Not photographed yet"}</span>
            </div>
            <div className="mo-before">
              <span className="mini">At move-in</span>
              {before.length ? (
                <div className="mo-strip">
                  {before.map((p) => (
                    <button key={p.id} type="button" className={`mo-thumb c-${p.condition}`} onClick={() => onZoom(p)} aria-label={`Enlarge move-in photo P${p.n}`}>
                      {p.src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route
                        <img src={`${p.src}?w=160`} alt="" loading="lazy" />
                      ) : (
                        <span className="ph" />
                      )}
                      <span>P{p.n} · {CONDITIONS[p.condition]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hint">No move-in photos of this room.</p>
              )}
            </div>
            <span className="mini">At move-out</span>
            <div className="pgrid">
              {after.map((p) => (
                <PhotoCard key={p.id} photo={p} fresh={freshIds.has(p.id)} flatId={flat.id} setFlat={setFlat} onZoom={onZoom} />
              ))}
              {Array.from({ length: waiting }, (_, k) => (
                <div className="skeltile" key={`pending-${k}`}>
                  <span className="skel" />
                  <span className="skel w60" />
                  <small>Adding photo…</small>
                </div>
              ))}
              <button className="addtile" type="button" onClick={() => onCamera(r.name)}>
                <Icon name="camera" />
                <b>{after.length ? "Take more photos" : `Take ${r.name} photos`}</b>
                <span>Match your move-in shots: same corners, same close-ups</span>
              </button>
            </div>
          </section>
        );
      })}

      {flat.moveOutPhotos.length > 0 && <OwnerConfirm flat={flat} setFlat={setFlat} kind="moveout" />}

      <div className="actions">
        <button className="btn accent" type="button" onClick={() => onStep("check")}>
          {flat.charges.length || flat.deductionsText.trim() ? "Back to the deductions" : "Next: check the owner's deductions"}
          <Icon name="arrow" small />
        </button>
      </div>
    </>
  );
}
