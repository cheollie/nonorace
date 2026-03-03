import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nonogram 1v1",
  description: "Race your friend in a nonogram puzzle",
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
