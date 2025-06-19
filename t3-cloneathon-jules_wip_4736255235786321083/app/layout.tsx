import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PlausibleProvider from "next-plausible";
import ClientSessionProvider from "@/components/auth/client-session-provider";
import MainNav from "@/components/layout/main-nav";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "T3 Chat",
  description: "Experience intelligent conversations with cutting-edge AI.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ClientSessionProvider>
          <ThemeProvider>
            <PlausibleProvider domain="cloneathon.t3.gg">
              <div className="flex flex-col min-h-screen bg-background text-foreground">
                <MainNav />
                <main className="flex-grow">{children}</main>
              </div>
            </PlausibleProvider>
          </ThemeProvider>
        </ClientSessionProvider>
      </body>
    </html>
  );
}
