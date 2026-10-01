import { Icon } from "@/components/icon";

export function ShareLinkControls({
  shareUrl,
  copyState,
  onCopy,
}: {
  shareUrl: string;
  copyState: "idle" | "copied" | "error";
  onCopy: () => Promise<void>;
}) {
  return (
    <div className="px-6 py-5 phone:px-5">
      <div className="flex gap-2 phone:flex-col">
        <div className="
          flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-border/35
          px-3.5 transition-shadow focus-within:ring-1 focus-within:ring-brand/20
        ">
          <Icon name="link" className="size-4.25 text-muted" />
          <input
            id="public-share-link"
            className="
              h-11.5 w-full min-w-0 rounded-none border-0 bg-transparent text-[14px]
              text-ellipsis font-medium text-foreground outline-none phone:text-[16px]
            "
            type="text"
            value={shareUrl}
            readOnly
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Public share link"
          />
        </div>
        <button type="button" className="
          inline-flex items-center justify-center gap-2.5 rounded-xl border font-semibold
          leading-[1.4] text-center no-underline transition-colors duration-150 ease-[ease]
          motion-reduce:transition-none disabled:border-border disabled:bg-surface-subtle
          disabled:text-muted min-h-12 px-5 py-2.75 border-transparent bg-brand text-white dark:text-on-brand
          enabled:hover:bg-brand-hover enabled:active:translate-y-px shrink-0 text-[13px] shadow-sm
        " onClick={onCopy}>
          <Icon name={copyState === "copied" ? "check" : "copy"} />
          {copyState === "copied" ? "Copied" : "Copy Link"}
        </button>
      </div>
      <div aria-live="polite">
        {copyState === "copied" && <p className="feedback-enter mt-2.5 text-center text-[13px] text-success">Link copied. Ready to share.</p>}
        {copyState === "error" && (
          <p className="feedback-enter
            flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4
            py-3.25 text-[14px] leading-[1.6] text-danger wrap-anywhere mt-4
          ">Couldn’t copy the link. Select the public link above and copy it manually.</p>
        )}
      </div>
    </div>
  );
}
