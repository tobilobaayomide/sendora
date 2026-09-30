import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { formatFileSize } from "@/lib/format-file-size";

export function FileSummary({ filename, size, detail, children, variant = "transfer" }: {
  variant?: "transfer" | "upload" | "list" | "recipient";
  filename: string;
  size: number;
  detail?: string;
  children?: ReactNode;
}) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const icon: IconName = /^(zip|rar|7z|tar|gz)$/.test(extension) ? "archive"
    : /^(jpg|jpeg|png|gif|webp|svg|heic|avif)$/.test(extension) ? "image"
    : /^(mp4|mov|webm|mkv|avi)$/.test(extension) ? "video"
    : /^(txt|pdf|md|doc|docx|csv)$/.test(extension) ? "text" : "file";
  return (
    <div className={`flex min-w-0 items-center gap-3 ${variant === "recipient" ? "flex-col text-center" : ""} ${variant === "upload" ? "narrow:gap-2.5" : ""}`}>
      <span className={`grid shrink-0 place-items-center rounded-lg text-brand-hover
        ${variant === "list" ? "size-9 bg-brand-soft" : variant === "recipient" ? "mb-2 size-16 bg-brand-soft" : "size-11 bg-brand-soft"}`}>
        <Icon name={icon} className={variant === "recipient" ? "size-7" : "size-5"} />
      </span>
      <div className={`min-w-0 ${variant === "recipient" ? "w-full" : "flex-1"} ${variant === "list" ? "flex items-center gap-3 narrow:block" : ""}`}>
        <p className={`${variant === "upload" || variant === "list" ? "text-[13px]" : "text-[15px]"} min-w-0 flex-1 truncate font-semibold`} title={filename}>{filename}</p>
        <p className={`text-[12px] text-muted ${variant === "list" ? "shrink-0 tabular-nums" : "mt-1"}`}>{formatFileSize(size)}{detail && <><span aria-hidden="true"> · </span>{detail}</>}</p>
      </div>
      {children}
    </div>
  );
}
