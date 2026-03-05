import type { Metadata } from "next";
import "./globals.css";

const siteName = "Nonorace";
const description =
  "Nonogram (picross) puzzle game — race a friend on the same grid or play the daily. Use row and column clues to fill the grid; first to finish wins.";

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: ["nonogram", "picross", "griddler", "puzzle", "multiplayer", "daily puzzle", "race"],
  authors: [{ name: "Nonorace" }],
  openGraph: {
    type: "website",
    title: siteName,
    description,
    siteName,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
