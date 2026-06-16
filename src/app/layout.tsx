import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aboslutt",
  description: "Finn og avslutt abonnementer du ikke trenger.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="min-h-full" lang="no">
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
