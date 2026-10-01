"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icon";

const menuLinks = [
  { label: "About", href: "/about" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function SiteNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpen.current) menuButtonRef.current?.focus();
      wasOpen.current = false;
      return;
    }

    wasOpen.current = true;
    firstLinkRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
      if (event.key !== "Tab") return;

      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("#mobile-navigation a"),
      );
      const focusOrder = [menuButtonRef.current, ...links].filter(
        (element): element is HTMLButtonElement | HTMLAnchorElement =>
          element !== null,
      );
      const activeIndex = focusOrder.indexOf(
        document.activeElement as HTMLButtonElement | HTMLAnchorElement,
      );
      if (activeIndex < 0) {
        event.preventDefault();
        links[0]?.focus();
      } else if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        focusOrder.at(-1)?.focus();
      } else if (!event.shiftKey && activeIndex === focusOrder.length - 1) {
        event.preventDefault();
        focusOrder[0]?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <header className="relative z-50">
        <div className="mx-auto flex min-h-20 w-[calc(100%-64px)] max-w-5xl items-center justify-between gap-6 compact:min-h-18 compact:w-[calc(100%-40px)]">
          <Brand />

          <div className="flex items-center compact:hidden">
            <Link
              href="/about"
              className="relative px-0 py-2 text-[14px] font-medium text-foreground/80 transition-colors hover:text-brand-hover focus-visible:text-brand-hover after:absolute after:inset-x-0 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none"
            >
              About
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="hidden size-11 place-items-center rounded-xl text-foreground transition-colors hover:bg-surface-subtle compact:grid"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            <Icon name={isOpen ? "x" : "menu"} className="size-5" />
          </button>
        </div>
      </header>

      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        className={`fixed inset-x-0 bottom-0 top-18 z-40 hidden bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200 compact:block motion-reduce:transition-none ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsOpen(false)}
      />

      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed right-0 top-18 z-40 hidden h-[calc(100dvh-4.5rem)] w-[min(86vw,360px)] border-l border-border bg-surface px-7 py-8 shadow-panel compact:block compact:transition-transform compact:duration-300 compact:ease-[cubic-bezier(0.16,1,0.3,1)] compact:motion-reduce:transition-none ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <ul className="flex flex-col gap-2">
          {menuLinks.map(({ label, href }, index) => (
            <li
              key={href}
              className={`transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${isOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
              style={{ transitionDelay: isOpen ? `${70 + index * 55}ms` : "0ms" }}
            >
              <Link
                ref={index === 0 ? firstLinkRef : undefined}
                href={href}
                className="flex min-h-14 items-center rounded-xl px-4 text-[17px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-brand-hover"
                onClick={() => setIsOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
