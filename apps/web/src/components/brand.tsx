import Link from "next/link";

export function Brand() {
  return (
    <Link className="
      inline-flex items-center gap-2.5 font-heading text-[22px] font-semibold tracking-[-0.9px]
      no-underline compact:text-[20px]
    " href="/" aria-label="Sendora home">
      <svg className="shrink-0 text-brand compact:size-[29px]" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M8 11h15l-4-4M24 21H9l4 4" className="stroke-on-brand" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Sendora</span>
    </Link>
  );
}
