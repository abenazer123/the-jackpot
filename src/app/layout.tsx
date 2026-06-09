import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";

import { HostPresenceProvider } from "@/components/brand/HostPresenceProvider";
import { PostHogProvider } from "@/components/brand/PostHogProvider";
import { UtmProvider } from "@/components/brand/UtmProvider";
import { siteOrigin } from "@/lib/siteOrigin";

import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const SITE_NAME = "The Jackpot Chicago";
const SITE_DESCRIPTION =
  "You found something special. A luxury group home in Chicago that sleeps 14 — five bedrooms, hot tub, cinema, game room, and a fire pit under the stars.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Tells iOS Safari to resize the LAYOUT viewport when the soft
  // keyboard opens, not just shrink the visual viewport. Means
  // 100dvh / position: fixed elements (our chat dialog) track the
  // keyboard correctly instead of being clipped or pushing the page
  // behind them. Replaces the default Next-injected viewport meta.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <UtmProvider>
            <HostPresenceProvider>{children}</HostPresenceProvider>
          </UtmProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
