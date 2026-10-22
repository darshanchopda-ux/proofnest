/**
 * The Proof Seal: a rubber-stamp mark in stamp-pad violet, used only where something is proven, such as a photo
 * taken live and independently timestamped, or an owner's confirmation. Unverified things never get one.
 * Small seals (under 64px) drop the ring lettering, which would be unreadable, and keep the centre mark.
 */
type Props = {
  /** Lettering around the top of the ring, e.g. "PROOFNEST · SEALED". */
  top?: string;
  /** Lettering around the bottom, e.g. "1 MAR 2024 · 10:02 IST". */
  bottom?: string;
  /** The centre mark, e.g. a day code or "✓". */
  center: string;
  /** A short line under the centre mark. */
  sub?: string;
  size?: number;
  /** Plays the press animation once, after `delay` seconds. */
  press?: boolean;
  delay?: number;
  tilt?: number;
  /** Read by screen readers instead of the lettering. */
  label: string;
  className?: string;
};

export function ProofSeal({ top = "PROOFNEST · SEALED", bottom, center, sub, size = 96, press, delay, tilt = -8, label, className = "" }: Props) {
  const small = size < 64;
  // Path ids only need to be unique per distinct lettering; identical seals can share them.
  const id = `seal-${size}-${hash(`${top}|${bottom}`)}`;
  const style = { width: size, height: size, "--seal-tilt": `${tilt}deg`, ...(delay != null && { "--seal-delay": `${delay}s` }) } as React.CSSProperties;
  return (
    <span className={`seal ${press ? "pressed" : ""} ${className}`} style={style} role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ink" cx="60" cy="60" r="56" strokeWidth={small ? 6 : 3.2} />
        <circle className="ink" cx="60" cy="60" r={small ? 44 : 41} strokeWidth={small ? 3 : 1.4} />
        {!small && (
          <>
            <defs>
              <path id={`${id}-t`} d="M 13,60 A 47,47 0 0 1 107,60" />
              <path id={`${id}-b`} d="M 8,60 A 52,52 0 0 0 112,60" />
            </defs>
            <text fontSize="9.5" letterSpacing="1.6">
              <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">{top}</textPath>
            </text>
            {bottom && (
              <text fontSize="8.6" letterSpacing="1.1">
                <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
              </text>
            )}
          </>
        )}
        {center === "✓" ? (
          <path className="ink" d="M40 61 l13 13 l27 -29" strokeWidth={small ? 10 : 7} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <text x="60" y={sub && !small ? 62 : 68} textAnchor="middle" fontSize={small ? 30 : center.length > 4 ? 15 : 22} fontWeight={700} letterSpacing={small ? 0 : 2}>
            {center}
          </text>
        )}
        {sub && !small && (
          <text x="60" y="78" textAnchor="middle" fontSize="8" letterSpacing="1.2">{sub}</text>
        )}
      </svg>
    </span>
  );
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
