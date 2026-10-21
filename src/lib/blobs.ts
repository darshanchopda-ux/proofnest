import "server-only";
import { del } from "@vercel/blob";

/** Deletes private blobs, ignoring empty pathnames (example photos) and logging failures rather than throwing. */
export async function removeBlobs(pathnames: string[]) {
  const real = pathnames.filter(Boolean);
  if (!real.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(real);
  } catch (e) {
    console.error("Blob delete failed", e);
  }
}
