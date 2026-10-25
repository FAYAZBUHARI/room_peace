import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";


export const metadata: Metadata = {
  title: "RoomPeace",
  description: "Private AI agents that help three roommates agree on household responsibilities.",
};

export const viewport: Viewport = { themeColor: "#07080b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
