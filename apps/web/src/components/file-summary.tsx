import type { ReactNode } from "react";
import { Icon } from "./icon";
import { formatFileSize } from "@/lib/format-file-size";

export function FileSummary({ filename, size, detail, children, variant = "transfer" }: {
  variant?: "transfer" | "upload";
  filename: string;
  size: number;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3.5 ${variant === "upload" ? "narrow:gap-2.5" : ""}`}>
      <span className={`grid h-14 w-12 shrink-0 place-items-center rounded-lg border border-border text-brand-hover
        ${variant === "upload" ? "bg-surface" : "bg-brand-soft"}`}>
        <Icon name="file" className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold wrap-anywhere">{filename}</p>
        <p className="mt-1 text-[13px] text-muted wrap-anywhere">{formatFileSize(size)}{detail && <><span aria-hidden="true"> · </span>{detail}</>}</p>
      </div>
      {children}
    </div>
  );
}
