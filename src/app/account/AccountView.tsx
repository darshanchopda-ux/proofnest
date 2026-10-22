import { Icon } from "@/components/Icon";
import { AccountDanger, BackupPhones, SignOutEverywhere } from "./AccountParts";

type Props = {
  title: string;
  phoneAccount: boolean;
  numbers: { phone: string; display: string; primary: boolean; off: boolean }[];
  canSend: boolean;
  history: { id: string; device: string; how: string; at: string }[];
};

/** The account page itself, kept apart from loading so it can also be shown with sample data while designing. */
export function AccountView({ title, phoneAccount, numbers, canSend, history }: Props) {
  return (
    <div className="wrap narrow account">
      <header className="acc-head">
        <span className="acc-badge" aria-hidden="true"><Icon name={phoneAccount ? "chat" : "key"} /></span>
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className={phoneAccount ? "mono" : ""}>{title}</h1>
          <p className="muted">{phoneAccount ? "You sign in with a code on WhatsApp." : "You sign in with your email and password."}</p>
        </div>
      </header>

      <section className="acc-card" aria-labelledby="acc-numbers">
        <div className="acc-card-head">
          <h2 id="acc-numbers">Phone numbers</h2>
          <p>If you lose your phone or change your number, a backup keeps you in. Switch off a lost number so nobody else can use it.</p>
        </div>
        {phoneAccount ? (
          <BackupPhones numbers={numbers} canSend={canSend} />
        ) : (
          <p className="hint">Backup numbers are for accounts that sign in with WhatsApp. If you lose your phone, sign in with your email.</p>
        )}
      </section>

      <section className="acc-card" aria-labelledby="acc-history">
        <div className="acc-card-head">
          <h2 id="acc-history">Recent sign-ins</h2>
          <p>Kept for 90 days. Don&apos;t recognise one, or someone else used your phone? Sign out everywhere, then sign in again.</p>
        </div>
        {history.length ? (
          <ol className="acc-history">
            {history.map((s) => (
              <li key={s.id}>
                <b>{s.device || "Unknown device"}</b>
                <span>{s.how}</span>
                <time className="mono">{s.at}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Sign-ins from now on are listed here.</p>
        )}
        <SignOutEverywhere />
      </section>

      <section className="acc-card danger" aria-labelledby="acc-delete">
        <div className="acc-card-head">
          <h2 id="acc-delete">Delete your account</h2>
          <p>
            Deletes every flat you added, with all its photos, files and letters, also for flatmates you invited; removes you from flats you
            joined; and deletes your numbers and sign-in history. This can&apos;t be undone. Download your evidence pack first if you might need it.
          </p>
        </div>
        <AccountDanger needsPassword={!phoneAccount} />
      </section>
    </div>
  );
}
