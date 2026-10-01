import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from "react";
import { FileSummary } from "@/components/file-summary";
import { Icon } from "@/components/icon";
import { formatFileSize } from "@/lib/format-file-size";

export function FilePicker({
  files,
  disabled,
  hidden,
  hasError,
  inputRef,
  onFilesSelected,
  onRemoveFile,
  onClearFiles,
}: {
  files: File[];
  disabled: boolean;
  hidden: boolean;
  hasError: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: (selection: FileList | null, append?: boolean) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const file = files.length === 1 ? files[0] : null;

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    onFilesSelected(event.dataTransfer.files);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(event.target.files, true);
    event.target.value = "";
  }

  function removeFile(index: number) {
    onRemoveFile(index);
    inputRef.current?.focus();
  }

  function clearFiles() {
    onClearFiles();
    inputRef.current?.focus();
  }

  return (
    <div
      className={`relative rounded-xl ${hidden ? "hidden" : ""} ${files.length ? "" : "border border-dashed"}
        transition-[background-color,border-color,box-shadow] duration-200 ease-[ease] motion-reduce:transition-none
        has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-brand
        ${isDragging ? "border-brand bg-brand-soft shadow-[inset_0_0_0_1px_var(--color-brand)]" : files.length ? "" : "border-border-strong/80 bg-surface-subtle/45"}
        ${disabled || files.length ? "" : "hover:border-brand/70 hover:bg-brand-soft/50"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled) return;
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id="upload-file"
        type="file"
        multiple
        className="sr-only"
        aria-label={files.length ? "Add Files" : "Choose Files"}
        aria-invalid={hasError}
        aria-describedby={hasError ? "upload-error" : undefined}
        disabled={disabled}
        onChange={handleChange}
      />
      {files.length > 1 ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-1 text-[13px]">
            <p className="font-semibold">{files.length} files selected</p>
            <p className="text-[12px] tabular-nums text-muted">
              {formatFileSize(
                files.reduce((total, selected) => total + selected.size, 0),
              )}{" "}
              total
            </p>
          </div>
          <ul
            className="mt-3 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-border divide-y divide-border bg-surface-subtle/45"
            aria-label="Selected files"
          >
            {files.map((selected, index) => (
              <li key={index} className="px-2.5 py-1.5">
                <FileSummary
                  filename={selected.name}
                  size={selected.size}
                  variant="list"
                >
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50 motion-reduce:transition-none"
                    disabled={disabled}
                    aria-label={`Remove ${selected.name}`}
                    onClick={() => removeFile(index)}
                  >
                    <Icon name="x" className="size-4" />
                  </button>
                </FileSummary>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-semibold">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-lg border border-border-strong px-3 text-brand-hover transition-colors hover:bg-brand-soft disabled:text-muted motion-reduce:transition-none"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Icon name="plus" className="size-3.5" />
              Add Files
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 min-h-11 rounded-lg px-2 text-danger hover:bg-danger-soft disabled:opacity-50"
              disabled={disabled}
              onClick={clearFiles}
            >
              <Icon name="trash" className="size-3.5" />
              Clear All
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Multiple files will be bundled into one ZIP. Up to 500 MB total.
          </p>
        </div>
      ) : file ? (
        <div>
          <div className="rounded-xl border border-border bg-surface-subtle/45 px-3 py-3">
            <FileSummary filename={file.name} size={file.size} variant="upload">
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50 motion-reduce:transition-none"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(0)}
              >
                <Icon name="x" className="size-4" />
              </button>
            </FileSummary>
          </div>
          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 min-h-11 rounded-lg border border-brand/50 bg-brand-soft/30 px-3 text-[13px] font-semibold text-brand-hover transition-colors hover:bg-brand-soft disabled:text-muted motion-reduce:transition-none"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="plus" className="size-4" />
            Add File
          </button>
        </div>
      ) : (
        <label
          className={`flex min-h-52 flex-col items-center justify-center px-4 py-7 text-center ${disabled ? "cursor-default" : "cursor-pointer"}`}
          htmlFor="upload-file"
        >
          <span className="mb-4 grid place-items-center text-brand-hover">
            <Icon name="upload" className="size-12" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.2px]">
            {isDragging ? "Drop it Here" : "Drop Your Files Here"}
          </span>
          <span className="mt-0.75 text-[14px] text-muted">
            or{" "}
            <span className="text-brand-hover underline underline-offset-[3px]">
              Browse Files
            </span>
          </span>
           <span className="mt-4 rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-medium text-muted">
            Up to 500 MB total <span aria-hidden="true">·</span> Any file type
          </span>
        </label>
      )}
    </div>
  );
}
