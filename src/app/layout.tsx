import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D&D Arena — AI Dungeon Master",
  description: "A browser-based D&D 5e game with an AI Dungeon Master",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}
