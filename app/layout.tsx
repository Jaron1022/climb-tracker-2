import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Climb Tracker",
  description: "Track climbs, photos, and progress at your gym."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
