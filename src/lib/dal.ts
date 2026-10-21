import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth/server";

export type CurrentUser = { id: string; name: string; email: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The signed-in user, or null. Reads the session cookie, so call it inside a Suspense boundary. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Mark the caller as request-time so prerendering skips it instead of tripping over cookies().
  await connection();
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id) return null;
  return { id: String(user.id), name: String(user.name ?? ""), email: String(user.email ?? "") };
}

/** The signed-in user, or a redirect to sign-in that returns to `next` afterwards. */
export async function requireUser(next = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=" + encodeURIComponent(next));
  return user;
}
