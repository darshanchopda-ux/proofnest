const PATHS = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l3 3" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, small, className }: { name: IconName; small?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["ic", small ? "ic-s" : "", className ?? ""].join(" ").trim()}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 15 16 5l12 10v12H4z" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
      <rect x="10" y="15" width="12" height="9" rx="1.5" fill="var(--accent)" />
      <circle cx="16" cy="19.5" r="2.3" fill="var(--ink)" />
    </svg>
  );
}
