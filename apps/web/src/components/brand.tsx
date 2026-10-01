import Image from "next/image";
import Link from "next/link";

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
      <Image
        src="/sendora-mark.png"
        alt=""
        width={35}
        height={35}
        unoptimized
        className="size-9 object-contain transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105 compact:size-10"
      />

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
