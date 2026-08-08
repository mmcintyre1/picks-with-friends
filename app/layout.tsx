import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";

import { NavBar } from "@/components/NavBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Condensed/bold display face used for headings, odds, and money figures -- the one
// typographic move that does the most to make this feel like a sportsbook rather than a
// generic form app, without going all the way to a literal football theme.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Picks with Friends",
  description: "Group parlay tracking for the crew.",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Picks with Friends" },
};

export const viewport: Viewport = {
  themeColor: "#0a0e16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
