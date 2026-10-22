import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/dal";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="usermenu">
        <Link className="btn small ghost" href="/auth/sign-in">Sign in</Link>
      </div>
    );
  }
  return (
    <form className="usermenu" action={signOut}>
      <Link className="who" href="/account" title="Your account">{user.name || user.email}</Link>
      <button className="btn small ghost" type="submit">Sign out</button>
    </form>
  );
}
