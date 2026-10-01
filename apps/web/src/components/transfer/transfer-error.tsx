import { Icon } from "@/components/icon";

export function TransferError({ message }: { message: string }) {
  return (
    <div id="upload-error" className="
      flex items-start gap-2.5 rounded-lg border border-transparent bg-danger-soft px-4 py-3.25
      text-[14px] leading-[1.6] text-danger wrap-anywhere mt-5
    " role="alert">
      <Icon name="alert" className="mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
