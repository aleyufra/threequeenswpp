import type { Metadata } from "next";
import { Anton, Kaushan_Script, Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const kaushan = Kaushan_Script({
  variable: "--font-kaushan",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Three Queens — asistente de WhatsApp para tu negocio",
  description: "Un asistente de IA que responde por WhatsApp, agenda citas en tu calendario y te pasa la conversación cuando hace falta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${onest.variable} ${anton.variable} ${kaushan.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
