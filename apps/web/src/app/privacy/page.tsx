import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Learn what Sendora processes to provide temporary file transfers and what happens to transfer data when a transfer ends.",
};

const sections = [
  {
    title: "Files you upload",
    content: (
      <>
        <p>
          When you create a transfer, your file is uploaded to private storage
          so it can be made available through your temporary Sendora link.
          Files are transferred over encrypted connections. Sendora does not
          currently provide end-to-end encryption, so you should not treat the
          service as zero-knowledge storage.
        </p>
        <p>
          Your file remains available until the transfer expires, reaches its
          download limit, or is revoked. After a transfer ends, the file is
          scheduled for automatic deletion.
        </p>
      </>
    ),
  },
  {
    title: "Transfer information",
    content: (
      <>
        <p>
          To create and operate a transfer, Sendora stores limited information
          associated with it, including:
        </p>
        <ul className="list-disc space-y-1 pl-5 marker:text-brand-hover">
          <li>the original file name, file size, and content type;</li>
          <li>when the transfer was created and when it expires;</li>
          <li>the download limit and current download count;</li>
          <li>whether it has been revoked, exhausted, or deleted; and</li>
          <li>transfer identifiers and security data needed to manage access.</li>
        </ul>
        <p>
          For a transfer containing multiple files, your browser creates one
          ZIP archive before upload. Sendora receives and stores that archive.
        </p>
        <p>
          Transfer records remain in Sendora&apos;s database after the associated
          file is deleted. The service does not currently apply an automatic
          retention period to those records.
        </p>
      </>
    ),
  },
  {
    title: "No accounts required",
    content: (
      <>
        <p>
          You do not need an account to create or download a transfer. When you
          create one, your browser keeps a management credential that lets you
          revoke it later. Anyone with access to that browser and its saved
          site data may be able to manage the transfer.
        </p>
      </>
    ),
  },
  {
    title: "Temporary links",
    content: (
      <p>
        A valid transfer link gives access to the transfer while it is
        available. Anyone who obtains the link may be able to download the
        files, subject to the transfer&apos;s expiry and download limit. Treat
        the link as private and share it only with the people you intend.
      </p>
    ),
  },
  {
    title: "Download security",
    content: (
      <p>
        Sendora checks that a transfer is still available before starting a
        download. A short-lived download session is then used to deliver the
        file from private storage without revealing its storage location.
        Expiry, revocation, and download limits determine whether another
        download can start.
      </p>
    ),
  },
  {
    title: "Service and technical data",
    content: (
      <>
        <p>
          Sendora and the providers that run its website, API, and file storage
          may process limited technical information needed to operate, secure,
          and troubleshoot the service. This can include request information,
          timestamps, and server logs. Log availability and retention depend on
          the relevant provider settings and service plan.
        </p>
        <p>
          We do not use the contents of uploaded files for advertising. The
          Sendora web app currently has no analytics integration.
        </p>
      </>
    ),
  },
  {
    title: "When a transfer ends",
    content: (
      <>
        <p>A transfer ends when it:</p>
        <ul className="list-disc space-y-1 pl-5 marker:text-brand-hover">
          <li>reaches its expiry time;</li>
          <li>uses its permitted number of downloads; or</li>
          <li>is revoked by its creator.</li>
        </ul>
        <p>
          It then becomes unavailable for new downloads, and its associated
          file is scheduled for automatic deletion from Sendora&apos;s storage.
          Cleanup runs automatically after a short delay; it is not an instant
          deletion process.
        </p>
      </>
    ),
  },
  {
    title: "Changes to this notice",
    content: (
      <p>
        This notice may change as Sendora develops or introduces new features.
        The latest version will always be available on this page.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-[calc(100%-40px)] max-w-5xl flex-1 pb-20 pt-12 phone:w-[calc(100%-32px)] phone:pb-14 phone:pt-8"
    >
      <article>
        <header className="border-b border-border/80 pb-8 md:pb-10">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-hover">
            Privacy
          </p>
          <h1 className="font-heading text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-balance">
            Privacy at Sendora
          </h1>
          <h2 className="mt-5 font-heading text-[19px] font-medium tracking-[-0.35px] text-foreground sm:text-[21px]">
            Your files are meant to be temporary.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-muted">
            Sendora is built around temporary file transfers. You do not need
            to create an account or profile to send or receive files. This page
            explains what information Sendora processes when you use the
            service and what happens to your files and transfer data.
          </p>
        </header>

        <div className="divide-y divide-border/80">
          {sections.map(({ title, content }) => (
            <section key={title} className="py-7 sm:py-8">
              <h2 className="font-heading text-[18px] font-semibold tracking-[-0.35px]">
                {title}
              </h2>
              <div className="privacy-copy mt-3 max-w-4xl space-y-3 text-[14px] leading-[1.8] text-muted">
                {content}
              </div>
            </section>
          ))}
        </div>

        <p className="border-t border-border/80 pt-5 text-[12px] text-muted">
          Last updated: October 2026
        </p>
      </article>
    </main>
  );
}
