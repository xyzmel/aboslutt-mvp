import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Importer",
  description: "Importer abonnementer fra e-post og bekreft forslag før de lagres.",
  robots: { index: false, follow: false },
};

export default function EmailImportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
