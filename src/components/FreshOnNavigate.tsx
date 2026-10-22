"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Starts its children fresh on each new visit to a page, while keeping their state for the browser's back and
 * forward buttons. With cacheComponents, Next.js otherwise restores a recently visited page exactly as it was
 * left, which shows stale flat data and old form entries (see the Next docs on preserving UI state).
 */
export function FreshOnNavigate({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
