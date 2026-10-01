import { Icon } from "@/components/icon";
import { TransferForm } from "@/components/transfer/transfer-form";

export default function Home() {
  return (
    <main
      id="main-content"
      className="mx-auto mt-7 w-[calc(100%-40px)] max-w-225 compact:mt-5 compact:w-[calc(100%-40px)]"
    >
      <div className="mb-7 text-center compact:mb-6">
        <h1
          className="
          font-heading text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.2] tracking-[-1.8px]
          text-balance compact:mx-auto compact:max-w-85 compact:tracking-[-1.1px]
        "
        >
          Send Files. Simple and{" "}
          <span className="text-brand">Secure</span>.
        </h1>
        <p
          className="
          mx-auto mt-4 max-w-107.5 text-[16px] leading-[1.65] text-balance text-muted compact:mt-3
          compact:max-w-70 compact:text-[14px]
        "
        >
          A temporary link for whatever comes next.
          <br />
          No account. Just send and share.
        </p>
      </div>
      <TransferForm />
      <ul
        className="
        mx-auto mt-8 flex max-w-full list-none flex-wrap items-center justify-center gap-x-3 gap-y-2 p-0
        text-[12px] text-muted compact:mt-6 compact:gap-x-2 compact:text-[11px]
      "
        aria-label="Simple, temporary sharing"
      >
        <li className="flex items-center gap-1.5 whitespace-nowrap">
          <span>No Account</span>
          <Icon className="size-4 text-brand" name="users" />
        </li>
        <li aria-hidden="true" className="h-4 w-px bg-border " />
        <li className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Private Transfers</span>
          <Icon className="size-4 text-brand" name="lock" />
        </li>
        <li aria-hidden="true" className="h-4 w-px bg-border " />
        <li className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Auto-Deleted</span>
          <Icon className="size-4 text-brand" name="clock" />
        </li>
      </ul>
    </main>
  );
}
