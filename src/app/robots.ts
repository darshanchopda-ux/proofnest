import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages can be indexed; tenants' flats, owner links, invites and the API never are. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/flats", "/confirm", "/join", "/account", "/api", "/dev-preview"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
