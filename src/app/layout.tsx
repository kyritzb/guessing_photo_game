import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guess The Photo",
  description: "A fun multiplayer photo guessing game!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        {children}
      </body>
    </html>
  );
}

