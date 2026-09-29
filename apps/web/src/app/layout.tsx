import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { Brand } from "@/components/brand";
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
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${dmSans.variable}`}
    >
      <body>
        <a className="fixed top-3 left-3 z-10 -translate-y-[160%] rounded-lg bg-surface px-5 py-3 focus:translate-y-0" href="#main-content">Skip to content</a>
        <header className="
          mx-auto flex min-h-24 w-[calc(100%_-_64px)] max-w-[1104px] items-center justify-between gap-6
          compact:min-h-20 compact:w-[calc(100%_-_40px)]
        ">
          <Brand />
          <span className="text-[13px] text-muted compact:hidden">A little less permanent.</span>
        </header>
        {children}
        <footer className="mt-auto px-5 py-8 text-center text-[12px] text-muted compact:pb-6 compact:text-[11px]">Send it. Share it. Gone when it’s done.</footer>
      </body>
    </html>
  );
}
