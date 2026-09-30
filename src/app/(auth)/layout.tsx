import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acesso ao sistema",
  robots: { index: Boolean(siteUrl()), follow: true },
  ...(siteUrl() ? { alternates: { canonical: new URL("/login", siteUrl()).href } } : {}),
};
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
