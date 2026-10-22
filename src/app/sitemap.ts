import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the public pages: everything else belongs to someone's account or a private link. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["", 1],
    ["/auth/sign-up", 0.6],
    ["/auth/sign-in", 0.5],
    ["/privacy", 0.4],
    ["/terms", 0.4],
    ["/status", 0.2],
  ];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency: "monthly", priority }));
}
