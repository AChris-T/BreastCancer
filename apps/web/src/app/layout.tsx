import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: { default: "BreastScan AI", template: "%s · BreastScan AI" },
  description:
    "Breast cancer subtype classification for clinicians: St Gallen rules plus an AI second reading.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A2E52",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request so the CSP nonce from proxy.ts applies.
  await connection();
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
