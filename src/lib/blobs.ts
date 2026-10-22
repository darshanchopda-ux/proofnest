import "server-only";
import { del, list } from "@vercel/blob";

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

/** Deletes every blob under a prefix, such as a flat's folder, page by page. */
export async function removeFolder(prefix: string) {
  if (!prefix || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      await removeBlobs(page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.error("Blob folder delete failed", prefix, e);
  }
}
