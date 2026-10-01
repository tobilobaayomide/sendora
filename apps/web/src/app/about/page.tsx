import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "About Sendora",
  description:
    "Learn how Sendora makes it simple to share files with temporary links, custom expiry times, and download limits.",
};

const steps = [
  {
    number: "01",
    title: "Choose what to send",
    description:
      "Send one file, or select several and Sendora will bundle them into a ZIP archive.",
  },
  {
    number: "02",
    title: "Set the limits",
    description:
      "Choose how long the link lasts and how many downloads it allows.",
  },
  {
    number: "03",
    title: "Share one link",
    description:
      "Send the link directly to the people who need the files.",
  },
];

export default function AboutPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-[calc(100%-40px)] max-w-5xl flex-1 pb-20 phone:w-[calc(100%-32px)] phone:pb-14"
    >
      <section className="grid min-h-[min(620px,calc(100svh-9rem))] items-center gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:py-16">
        <div className="feedback-enter max-w-2xl">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-hover">
            About Sendora
          </p>
          <h1 className="font-heading text-[clamp(2.25rem,5.2vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.065em] text-balance">
            File sharing, with an end in sight.
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-[1.75] text-muted text-balance compact:mt-4 compact:text-[15px]">
            Sendora turns your files into a temporary link. No account is needed to
            send or receive. Choose when the link expires and how many downloads
            it allows.
          </p>
        </div>

        <figure
          className="relative mx-auto grid aspect-[1.25] w-full max-w-110 place-items-center"
          aria-label="A file becomes a link, then expires"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full text-brand"
            viewBox="0 0 440 352"
            fill="none"
          >
            <defs>
              <linearGradient id="paper-front" x1="70" y1="96" x2="164" y2="250" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-brand)" stopOpacity=".2" />
                <stop offset="1" stopColor="var(--color-brand)" stopOpacity=".04" />
              </linearGradient>
              <linearGradient id="paper-side" x1="154" y1="110" x2="192" y2="230" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-brand)" stopOpacity=".28" />
                <stop offset="1" stopColor="var(--color-brand)" stopOpacity=".1" />
              </linearGradient>
              <linearGradient id="timer-face" x1="292" y1="111" x2="368" y2="223" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-surface)" />
                <stop offset="1" stopColor="var(--color-surface-subtle)" />
              </linearGradient>
              <filter id="soft-shadow" x="22" y="65" width="398" height="246" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <ellipse cx="220" cy="267" rx="164" ry="18" fill="currentColor" fillOpacity=".08" filter="url(#soft-shadow)" />
            <path d="M45 184C105 184 110 110 220 110s115 74 175 74" stroke="currentColor" strokeDasharray="4 8" strokeLinecap="round" strokeOpacity=".28" strokeWidth="2" />
            <circle cx="45" cy="184" r="4" fill="currentColor" fillOpacity=".55" />
            <circle cx="395" cy="184" r="4" fill="currentColor" fillOpacity=".55" />

            {/* Isometric file stack */}
            <g stroke="currentColor" strokeLinejoin="round">
              <path d="m69 132 58-34 61 35-59 35-60-36Z" fill="var(--color-surface-subtle)" strokeOpacity=".18" />
              <path d="m69 132 60 36v92l-60-36v-92Z" fill="url(#paper-front)" strokeOpacity=".2" />
              <path d="m129 168 59-35v92l-59 35v-92Z" fill="url(#paper-side)" strokeOpacity=".2" />
              <path d="m86 140 26-15 25 15-26 15-25-15Z" fill="var(--color-brand)" fillOpacity=".14" stroke="none" />
              <path d="m86 171 27 16m-27 1 27 16m-27 1 18 11" stroke="var(--color-brand)" strokeLinecap="round" strokeOpacity=".35" strokeWidth="3" />
              <path d="m117 118 11-7 18 11-11 7-18-11Z" fill="var(--color-brand)" fillOpacity=".34" stroke="none" />
            </g>

            {/* Central brand medallion */}
            <g transform="translate(0 24)">
              <ellipse cx="220" cy="217" rx="53" ry="17" fill="currentColor" fillOpacity=".12" />
              <path d="M167 160c0-10 24-18 53-18s53 8 53 18v47c0 10-24 18-53 18s-53-8-53-18v-47Z" fill="var(--color-brand)" fillOpacity=".15" />
              <ellipse cx="220" cy="160" rx="53" ry="18" fill="var(--color-brand)" fillOpacity=".24" />
              <ellipse cx="220" cy="157" rx="44" ry="14" fill="var(--color-surface)" stroke="var(--color-brand)" strokeOpacity=".18" />
            </g>

            {/* Dimensional expiry dial */}
            <g transform="translate(0 36)" stroke="currentColor" strokeLinejoin="round">
              <path d="m302 126 37-21 39 22-38 22-38-23Z" fill="var(--color-brand)" fillOpacity=".24" strokeOpacity=".15" />
              <path d="m302 126 38 23v71l-38-23v-71Z" fill="var(--color-brand)" fillOpacity=".16" strokeOpacity=".16" />
              <path d="m340 149 38-22v71l-38 22v-71Z" fill="var(--color-brand)" fillOpacity=".29" strokeOpacity=".16" />
              <ellipse cx="340" cy="148" rx="31" ry="18" transform="rotate(-30 340 148)" fill="url(#timer-face)" stroke="var(--color-brand)" strokeOpacity=".22" strokeWidth="1.5" />
              <path d="M340 132v15l11 7" stroke="var(--color-brand)" strokeLinecap="round" strokeWidth="2.5" />
              <circle cx="340" cy="147" r="2.5" fill="var(--color-brand)" stroke="none" />
            </g>
          </svg>

          <Image
            src="/sendora-mark.png"
            alt=""
            width={36}
            height={36}
            priority
            className="feedback-enter absolute left-1/2 top-[44.3%] size-9 -translate-x-1/2 object-contain"
          />
        </figure>
      </section>

      <section className="border-t border-border/80 py-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-[0.72fr_1.28fr] md:gap-12">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-hover">
              How it works
            </p>
            <h2 className="mt-3 max-w-sm font-heading text-[26px] font-semibold leading-[1.2] tracking-[-0.8px] text-balance">
              Three steps, then you’re done.
            </h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {steps.map((step) => (
              <li key={step.number} className="border-t border-border/80 pt-4 sm:border-t-0 sm:pt-0">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold tabular-nums text-brand-hover">
                  {step.number}
                </span>
                <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-muted">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border/80 py-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-[0.72fr_1.28fr] md:gap-12">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-hover">
              Your limits
            </p>
            <h2 className="mt-3 max-w-sm font-heading text-[26px] font-semibold leading-[1.2] tracking-[-0.8px] text-balance">
              You decide how long it stays available.
            </h2>
          </div>
          <div>
            <dl className="grid grid-cols-2 divide-x divide-border/80">
              <div className="pr-5 sm:pr-8">
                <dt className="text-[13px] text-muted">Link expiry</dt>
                <dd className="mt-2 font-heading text-[24px] font-semibold tracking-[-0.7px] sm:text-[28px]">
                  1–168 hours
                </dd>
              </div>
              <div className="pl-5 sm:pl-8">
                <dt className="text-[13px] text-muted">Download limit</dt>
                <dd className="mt-2 font-heading text-[24px] font-semibold tracking-[-0.7px] sm:text-[28px]">
                  1–100 downloads
                </dd>
              </div>
            </dl>
            <p className="mt-6 max-w-2xl text-[14px] leading-[1.7] text-muted">
              You can revoke a transfer early from the browser where you
              created it. Once a transfer expires, is revoked, or reaches its
              download limit, it becomes unavailable and its file is
              automatically removed.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border/80 py-12 md:py-14">
        <div className="grid gap-5 md:grid-cols-[0.72fr_1.28fr] md:gap-12">
          <h2 className="max-w-sm font-heading text-[26px] font-semibold leading-[1.2] tracking-[-0.8px] text-balance">
            Sending a group of files?
          </h2>
          <p className="max-w-2xl text-[14px] leading-[1.7] text-muted">
            Select up to 500 files and Sendora bundles them into one ZIP. A
            bundle can contain up to 500 MB in total. Your recipient downloads
            them together from the same temporary link.
          </p>
        </div>
      </section>

      <section className="border-t border-border/80 py-12 md:py-14">
        <div className="grid items-end gap-6 md:grid-cols-[0.72fr_1.28fr] md:gap-12">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-hover">
              Built to be temporary
            </p>
            <h2 className="mt-3 max-w-sm font-heading text-[26px] font-semibold leading-[1.2] tracking-[-0.8px] text-balance">
              Private by design. Gone when it’s done.
            </h2>
          </div>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-[14px] leading-[1.7] text-muted">
              No account is needed. Files travel over encrypted connections
              and are accessible through their temporary transfer link. Once
              the transfer ends, the files are automatically removed.
            </p>
            <Link
              href="/"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover dark:text-on-brand"
            >
              Send a file
              <Icon name="arrow-right" className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
