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
          Send <span className="text-brand">Files</span>. Simple and{" "}
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
        mx-auto mt-7 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-3 p-0 text-[12px]
        text-muted compact:gap-x-4 compact:gap-y-2.5 compact:text-[11px]
      "
        aria-label="Simple, temporary sharing"
      >
        <li className="flex items-center gap-1.5">
          <Icon className="size-3.75" name="users" />
          No Account
        </li>
        <li className="flex items-center gap-1.5">
          <Icon className="size-3.75" name="lock" />
          Private Transfers
        </li>
        <li className="flex items-center gap-1.5">
          <Icon className="size-3.75" name="clock" />
          Auto-Deleted
        </li>
      </ul>
    </main>
  );
}
