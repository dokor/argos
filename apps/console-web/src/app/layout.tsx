import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LangProvider } from "@/lib/i18n/LangContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Argos – Analyseur de site web",
  description:
    "Argos analyse vos headers HTTP, HTML, stack technique et performances. Rapport scoré, privé, sans login.",
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
