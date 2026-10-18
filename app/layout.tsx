import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { env } from "@/lib/env";
import { themeBootScript } from "@/lib/theme";
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
  title: "Cartograph",
  description: "A dependency map of a public repository.",
};

const appearance = {
  variables: {
    colorPrimary: "var(--accent)",
    colorBackground: "var(--surface)",
    colorText: "var(--ink)",
    colorTextSecondary: "var(--muted)",
    colorInputBackground: "var(--canvas)",
    colorInputText: "var(--ink)",
    fontFamily: "var(--font-geist-sans), sans-serif",
    fontSize: "13px",
    borderRadius: "2px",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  env();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="theme" strategy="beforeInteractive">
          {themeBootScript()}
        </Script>
        <ClerkProvider appearance={appearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
