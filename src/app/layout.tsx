import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Macaw",
  description: "Gym membership management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Macaw",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased font-sans`}>
        <NextTopLoader showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
