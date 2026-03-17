import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zip | Daily Puzzle Game",
  description:
    "Draw a single continuous path across every cell. A daily logic puzzle inspired by NYT and LinkedIn games.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧩</text></svg>",
  },
  openGraph: {
    title: "Zip | Daily Puzzle Game",
    description:
      "Draw a single continuous path across every cell. A daily logic puzzle inspired by NYT and LinkedIn games.",
    images: [{ url: "/og_image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zip | Daily Puzzle Game",
    description:
      "Draw a single continuous path across every cell. A daily logic puzzle inspired by NYT and LinkedIn games.",
    images: ["/og_image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
