"use client";

import { switchLocalePath } from "@/i18n/config";

/** The link to this page in the other language. Copied from OpenSenedd. */
export function LangSwitch({
  to,
  text,
  label,
  fallbackHref,
  className = "",
}: {
  to: "en" | "cy";
  text: string;
  label: string;
  fallbackHref: string;
  className?: string;
}) {
  // Point the link at this page in the other language whenever someone is
  // about to use it, so it stays right after client-side navigation.
  const target = () => {
    const { pathname: p, search, hash } = window.location;
    // With two domains, the other language is on the other domain.
    return switchLocalePath(p, to) + search + hash;
  };
  const update = (e: React.SyntheticEvent<HTMLAnchorElement>) => {
    e.currentTarget.href = target();
  };
  return (
    <a
      href={fallbackHref}
      hrefLang={to}
      lang={to}
      aria-label={label}
      className={className}
      onMouseEnter={update}
      onFocus={update}
      onTouchStart={update}
      onClick={(e) => {
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          update(e);
          return;
        }
        e.preventDefault();
        window.location.assign(target());
      }}
    >
      {text}
    </a>
  );
}
