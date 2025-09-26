import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { Navbar } from "../components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WellnessAI | Personalized Mental Wellness Companion",
  description:
    "AI-driven mental wellness platform that combines personalized guidance, community support, and professional booking in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <div className="relative flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.1),_transparent_60%)] dark:bg-[linear-gradient(to_bottom,_rgba(15,23,42,0.98),_rgba(2,6,23,1))]">
            <Navbar />
            <main className="flex-1 px-4 pb-16 pt-24 text-slate-900 dark:text-slate-100">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
