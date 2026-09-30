import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  return url ? [{ url: new URL("/login", url).href, changeFrequency: "monthly", priority: 1 }] : [];
}
