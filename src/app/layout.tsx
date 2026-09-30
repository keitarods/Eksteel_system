import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { siteDescription, siteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Eksteel | Gestão financeira e operacional", template: "%s | Eksteel" },
  description: siteDescription,
  applicationName: "Eksteel System",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website", locale: "pt_BR", siteName: "Eksteel System",
    title: "Eksteel | Gestão financeira e operacional", description: siteDescription,
    ...(siteUrl() ? { images: [{ url: "/images/Eksteel-logo.png", alt: "Eksteel" }] } : {}),
  },
  twitter: { card: "summary", title: "Eksteel System", description: siteDescription },
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
