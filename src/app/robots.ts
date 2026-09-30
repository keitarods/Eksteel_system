import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: { userAgent: "*", allow: ["/login", "/_next/", "/images/", "/icon.png"], disallow: ["/"] },
    ...(url ? { sitemap: new URL("/sitemap.xml", url).href } : {}),
  };
}
