import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Sora } from "next/font/google";
import { RadialBackground } from "@/components/background-waves";
import { SiteNavbar } from "@/components/site-navbar";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Sendora — Send files. Simple and secure.", template: "%s · Sendora" },
  description: "Share files with a private, temporary link. Set an expiry and download limit. No account required.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${dmSans.variable}`}
    >
      <body>
        <RadialBackground />
        <SiteNavbar />
        {children}
        <footer className="mt-auto px-5 py-6 text-[12px] text-muted compact:py-5 compact:text-[11px]">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 compact:flex-col compact:justify-center compact:text-center">
            <p>Send it. Share it. Gone when it’s done.</p>
            <nav aria-label="Legal" className="flex items-center gap-5">
              <Link
                href="/terms"
                className="transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
