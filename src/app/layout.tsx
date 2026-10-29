import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Max Outreach AI", template: "%s · Max Outreach AI" },
  description: "A thoughtful workspace for your next creative opportunity.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
