import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOMO Firewall",
  description: "Turn impulse buys into disciplined onchain decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
