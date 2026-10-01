import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Read the terms for using Sendora’s temporary file-transfer service.",
};

const sections = [
  {
    title: "Using Sendora",
    paragraphs: [
      "Sendora provides a temporary file-transfer service that lets you upload files and share them through a temporary link.",
      "No account is required to use the service. You are responsible for the files you upload and for deciding who you share your transfer links with.",
    ],
  },
  {
    title: "Your files",
    paragraphs: [
      "You retain ownership of the files you upload to Sendora. By uploading a file, you give Sendora permission to temporarily store and deliver it as needed to provide the transfer service.",
      "Sendora does not claim ownership of your files.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "You may only upload and share files that you have the right to use and distribute.",
      "You must not use Sendora to distribute unlawful content, infringe another person’s rights, transmit malicious software, or harm other people or systems.",
      "You must not try to bypass transfer limits, interfere with the service, gain unauthorized access to its systems, or use Sendora in a way that could negatively affect its operation.",
    ],
  },
  {
    title: "Transfer links",
    paragraphs: [
      "Anyone with access to a valid transfer link may be able to access its files while the transfer remains available. You are responsible for sharing links with the intended recipients and keeping them private when necessary.",
      "A transfer link stops working when the transfer expires, reaches its download limit, or is revoked.",
    ],
  },
  {
    title: "Temporary storage",
    paragraphs: [
      "Sendora is designed for temporary file transfer, not permanent file storage or backup. Files are scheduled for automatic removal after a transfer expires, is revoked, or reaches its download limit. Cleanup is not instantaneous.",
      "Keep your own copy of any file you upload to Sendora.",
    ],
  },
  {
    title: "Availability",
    paragraphs: [
      "We aim to keep Sendora available and reliable, but uninterrupted access is not guaranteed.",
      "Transfers may occasionally be unavailable because of maintenance, technical problems, network failures, or services operated by third-party infrastructure providers.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "Sendora uses security measures intended to protect transfers, including encrypted network connections and private file storage. No internet service can guarantee absolute security, and you are responsible for deciding whether Sendora is appropriate for the files you choose to share.",
      "Sendora does not currently provide end-to-end encryption.",
    ],
  },
  {
    title: "Misuse of the service",
    paragraphs: [
      "We may restrict access to or remove transfers when reasonably necessary to protect Sendora, its users, or others; comply with applicable legal obligations; or respond to misuse of the service.",
    ],
  },
  {
    title: "Limitation of responsibility",
    paragraphs: [
      "Sendora is provided as available, without a guarantee that every transfer will always be accessible or successfully delivered.",
      "To the extent permitted by applicable law, Sendora is not responsible for losses resulting from relying on the service as permanent storage, sharing a transfer link with the wrong person, or circumstances outside Sendora’s reasonable control.",
      "Nothing in these terms excludes rights or responsibilities that cannot legally be excluded.",
    ],
  },
  {
    title: "Changes to these terms",
    paragraphs: [
      "These terms may change as Sendora develops and new features are introduced. The latest version will be available on this page.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-[calc(100%-40px)] max-w-5xl flex-1 pb-20 pt-12 phone:w-[calc(100%-32px)] phone:pb-14 phone:pt-8"
    >
      <article>
        <header className="border-b border-border/80 pb-8 md:pb-10">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-hover">
            Terms
          </p>
          <h1 className="font-heading text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-balance">
            Terms of Use
          </h1>
          <p className="mt-4 text-[12px] text-muted">
            Last updated: October 2026
          </p>
          <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-muted">
            These Terms of Use apply when you use Sendora to create, share, or
            download temporary file transfers. By using Sendora, you agree to
            these terms.
          </p>
        </header>

        <div className="divide-y divide-border/80">
          {sections.map(({ title, paragraphs }) => (
            <section key={title} className="py-7 sm:py-8">
              <h2 className="font-heading text-[18px] font-semibold tracking-[-0.35px]">
                {title}
              </h2>
              <div className="mt-3 max-w-4xl space-y-3 text-[14px] leading-[1.8] text-muted">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
