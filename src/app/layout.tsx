import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Historias Bíblicas Studio (Beta)",
  description:
    "Genera videos bíblicos verticales (9:16) con narración IA, subtítulos automáticos y render MP4.",
  icons: {
    icon: "/assets/49f5e869-df68-4bc8-b1fb-b0e1ea1c7575.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-studio-bg text-studio-text antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
