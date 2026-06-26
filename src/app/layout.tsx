import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Historias Bíblicas Studio",
  description:
    "Genera videos bíblicos verticales (9:16) con narración LMNT, subtítulos automáticos Popis y render MP4.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-studio-bg text-studio-text antialiased">
        {children}
      </body>
    </html>
  );
}
