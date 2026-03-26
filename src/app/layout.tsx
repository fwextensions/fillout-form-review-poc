import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fillout Form Review Tool",
  description: "Review Fillout forms against SF.gov standards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
