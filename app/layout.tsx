import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ScrollAwareLogo } from "@/components/ui/scroll-aware-logo";
import { TubelightNavbar } from "@/components/ui/tubelight-navbar";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-var",
  weight: ["400"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-body-var",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "Fairfax County",
    "FCPS",
    "School Board",
    "meetings",
    "local government",
    "civic tech",
    "Civic Sync",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <ScrollAwareLogo />
          <main className="flex-1">{children}</main>
          <TubelightNavbar />
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
