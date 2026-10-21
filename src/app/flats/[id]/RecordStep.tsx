"use client";

import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { addRoom, deletePhoto, removeRoom, updatePhoto } from "@/app/flats/actions";
import { roomStats } from "@/lib/guidance";
import { fmtDate, plural } from "@/lib/format";
import { CONDITIONS, type Condition, type FlatDTO, type FlatPatch, type PhotoDTO } from "@/lib/types";

type Props = {
  flat: FlatDTO;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  pending: Record<string, number>;
  freshIds: Set<string>;
  onFiles: (room: string, files: FileList | File[]) => void;
  onZoom: (photo: PhotoDTO) => void;
  onCopy: () => void;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
};

export function RecordStep({ flat, setFlat, pending, freshIds, onFiles, onZoom, onCopy, patchFlat }: Props) {
  const toast = useToast();
  const rooms = roomStats(flat);
  const [newRoom, setNewRoom] = useState("");

  async function submitRoom(e: FormEvent) {
    e.preventDefault();
    const name = newRoom.trim();
    if (!name) return;
    const result = await addRoom(flat.id, name);
    if (!result.ok) return toast(result.error, "bad");
    setFlat((f) => ({ ...f, rooms: result.data }));
    setNewRoom("");
  }

  async function dropRoom(name: string) {
    const result = await removeRoom(flat.id, name);
    if (!result.ok) return toast(result.error, "bad");
    setFlat((f) => ({ ...f, rooms: result.data }));
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="ttl"><h2>Move-in record</h2><span className="when">At move-in</span></div>
          <p>
            Photograph every room before you unpack. Each photo keeps its capture time and a fingerprint of the original file, so you can
            show it was never edited.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn small ghost" type="button" onClick={onCopy}><Icon name="copy" small />WhatsApp message</button>
        </div>
      </div>

      <details className="tips">
        <summary>
          <Icon name="camera" small />How to take move-in photos that hold up<Icon name="chevron" small className="chev" />
        </summary>
        <ul>
          <li>Shoot in daylight with the lights on. Stand in a corner so each photo shows two walls and the floor.</li>
          <li>Then take close-ups of every crack, stain, chip, loose hinge or seepage mark, and mark the photo Worn or Damaged.</li>
          <li>Open the wardrobe, fridge, geyser and kitchen cabinets. Owners often charge for what is inside.</li>
          <li>Add a short note to each photo. The AI reads the notes when it checks the owner&apos;s deductions.</li>
        </ul>
      </details>

      <div className="roomsbar">
        {rooms.map((r, i) => (
          <a key={r.name} className={`rchip ${r.count ? "done" : ""}`} href={`#room-${i}`}>
            {r.count ? <Icon name="check" small /> : <i className="ring" />}
            {r.name}
            <b>{r.count}</b>
          </a>
        ))}
        <form className="addroom" onSubmit={submitRoom}>
          <label className="sr" htmlFor="new-room">New room name</label>
          <input id="new-room" type="text" placeholder="Add a room" maxLength={40} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
          <button className="btn small ghost" type="submit">Add</button>
        </form>
      </div>

      {rooms.map((r, i) => (
        <Room
          key={r.name}
          index={i}
          name={r.name}
          photos={flat.photos.filter((p) => p.room === r.name)}
          pending={pending[r.name] ?? 0}
          freshIds={freshIds}
          flatId={flat.id}
          setFlat={setFlat}
          onFiles={onFiles}
          onZoom={onZoom}
          onRemove={() => dropRoom(r.name)}
        />
      ))}

      <div className="evidence-field">
        <label className="lab" htmlFor="f-evidence">Other evidence</label>
        <textarea
          id="f-evidence"
          value={flat.evidenceNotes}
          onChange={(e) => patchFlat({ evidenceNotes: e.target.value })}
          placeholder="WhatsApp messages, emails and rent agreement clauses, with dates. For example: 2 Mar 2024, owner on WhatsApp: the cracked kitchen tile is old, don't worry."
        />
        <p className="hint">The AI can cite anything you write here when it checks the owner&apos;s deductions.</p>
      </div>
    </>
  );
}

function Room({
  index,
  name,
  photos,
  pending,
  freshIds,
  flatId,
  setFlat,
  onFiles,
  onZoom,
  onRemove,
}: {
  index: number;
  name: string;
  photos: PhotoDTO[];
  pending: number;
  freshIds: Set<string>;
  flatId: string;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  onFiles: (room: string, files: FileList | File[]) => void;
  onZoom: (photo: PhotoDTO) => void;
  onRemove: () => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <section
      className={`room ${drag ? "drag" : ""}`}
      id={`room-${index}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(name, e.dataTransfer.files);
      }}
    >
      <div className="room-head">
        <h3>{name}</h3>
        <span className="count">{plural(photos.length, "photo")}</span>
        <span className="spacer" />
        {!photos.length && !pending && (
          <button className="btn small ghost" type="button" onClick={onRemove}>Remove room</button>
        )}
      </div>
      <div className="pgrid">
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} fresh={freshIds.has(p.id)} flatId={flatId} setFlat={setFlat} onZoom={onZoom} />
        ))}
        {Array.from({ length: pending }, (_, k) => (
          <div className="skeltile" key={`pending-${k}`}>
            <span className="skel" />
            <span className="skel w60" />
            <small>Adding photo…</small>
          </div>
        ))}
        <label className="addtile file-btn">
          <Icon name="camera" />
          <b>{photos.length ? "Add more" : `Add ${name} photos`}</b>
          <span>{photos.length ? "or drop photos here" : "Tap to take or pick photos, or drop them here"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={`Add photos to ${name}`}
            onChange={(e) => {
              if (e.target.files) onFiles(name, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}

function PhotoCard({
  photo,
  fresh,
  flatId,
  setFlat,
  onZoom,
}: {
  photo: PhotoDTO;
  fresh: boolean;
  flatId: string;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  onZoom: (photo: PhotoDTO) => void;
}) {
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setLocal(patch: Partial<PhotoDTO>) {
    setFlat((f) => ({ ...f, photos: f.photos.map((p) => (p.id === photo.id ? { ...p, ...patch } : p)) }));
  }

  async function setCondition(condition: Condition) {
    setLocal({ condition });
    const result = await updatePhoto(flatId, photo.id, { condition });
    if (!result.ok) toast(result.error, "bad");
  }

  function setNote(note: string) {
    setLocal({ note });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      const result = await updatePhoto(flatId, photo.id, { note });
      if (!result.ok) toast(result.error, "bad");
    }, 600);
  }

  async function remove() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    setLeaving(true);
    const result = await deletePhoto(flatId, photo.id);
    if (!result.ok) {
      setLeaving(false);
      return toast(result.error, "bad");
    }
    setTimeout(() => setFlat((f) => ({ ...f, photos: f.photos.filter((p) => p.id !== photo.id) })), 200);
  }

  const taken = photo.takenAt ? `${photo.takenFrom === "camera" ? "Taken" : "File date"} ${fmtDate(photo.takenAt, true)}` : "Capture time unknown";

  return (
    <figure className={`pcard ${photo.condition === "damaged" ? "cond-damaged" : ""} ${fresh ? "pop" : ""} ${leaving ? "leaving" : ""}`}>
      <button className="pimg" type="button" onClick={() => onZoom(photo)} aria-label={`Enlarge photo P${photo.n}`}>
        {photo.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route
          <img src={photo.src} alt={`Photo P${photo.n}, ${photo.room}`} loading="lazy" />
        ) : (
          <span className="ph">Example photo: {photo.note}</span>
        )}
        <span className="ptag">P{photo.n}</span>
      </button>
      <div className="pbody">
        <div className="seg" role="group" aria-label={`Condition of P${photo.n}`}>
          {(Object.keys(CONDITIONS) as Condition[]).map((c) => (
            <button key={c} type="button" className={`c-${c}`} aria-pressed={photo.condition === c} onClick={() => setCondition(c)}>
              {CONDITIONS[c]}
            </button>
          ))}
        </div>
        <label className="sr" htmlFor={`pn-${photo.id}`}>Note for P{photo.n}</label>
        <input
          id={`pn-${photo.id}`}
          type="text"
          value={photo.note}
          maxLength={200}
          placeholder="What does it show?"
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="pfoot">
          <span className="pmeta">
            {taken}
            {photo.sha256 && <><br />#{photo.sha256.slice(0, 12)}</>}
          </span>
          <button
            className={`iconbtn ${armed ? "armed" : ""}`}
            type="button"
            onClick={remove}
            aria-label={armed ? `Confirm deleting photo P${photo.n}` : `Delete photo P${photo.n}`}
            title={armed ? "Click again to delete" : "Delete"}
          >
            {armed ? "Sure?" : <Icon name="trash" small />}
          </button>
        </div>
      </div>
    </figure>
  );
}
