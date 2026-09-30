import Link from "next/link";
import { Rotate3d } from "lucide-react";

export function Brand() {
  return (
    <Link
      href="/"
      aria-label="Sendora home"
      className="
        group inline-flex items-center gap-2.5
        no-underline
      "
    >
      <span
        className="
          flex size-7 items-center justify-center
          rounded-lg bg-brand text-on-brand
          transition-transform duration-200
          group-hover:-rotate-6 group-hover:scale-105
          compact:size-8
        "
      >
        <Rotate3d
          className="size-5.5 -translate-x-px translate-y-px"
          strokeWidth={2.3}
        />
      </span>

      <span
        className="
          font-heading text-[22px] font-semibold
          tracking-[-0.8px] text-foreground
          compact:text-[20px]
        "
      >
        Sendora
      </span>
    </Link>
  );
}