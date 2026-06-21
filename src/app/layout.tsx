import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aboslutt.no"),
  title: {
    default: "Aboslutt | Få kontroll på abonnementene dine",
    template: "%s | Aboslutt",
  },
  description:
    "Aboslutt hjelper deg å samle abonnementer, se faste kostnader, få varsler og kutte det du ikke trenger.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Aboslutt | Få kontroll på abonnementene dine",
    description:
      "Oppdag hva du betaler for. Kutt det du ikke trenger. Hold oversikten på ett sted.",
    url: "https://www.aboslutt.no",
    siteName: "Aboslutt",
    locale: "nb_NO",
    type: "website",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
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
