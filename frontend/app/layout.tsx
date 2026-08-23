import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cloud Media Storage",
  description: "Secure cloud file storage and sharing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
