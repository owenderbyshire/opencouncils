"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The path without its language prefix (/en is the internal one, /cy the Welsh one). */
const bare = (p: string) => p.replace(/^\/(en|cy)(?=\/|$)/, "") || "/";

/**
 * A sidebar link that marks itself current from the URL. It is current on its
 * own page and the pages beneath it, except those that another sidebar link
 * (`deeper`) covers more closely. Links to a part of a page (with #) are never current.
 */
export function NavLink({
  href,
  path,
  deeper,
  className,
  children,
}: {
  href: string;
  path: string;
  deeper: string[];
  className: string;
  children: React.ReactNode;
}) {
  const here = bare(usePathname());
  const under = (p: string) => here === p || here.startsWith(`${p}/`);
  const current = !path.includes("#") && path !== "/" && under(path) && !deeper.some(under);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
