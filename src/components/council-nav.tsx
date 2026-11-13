"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

/** Tabs for a council's pages. The current tab is marked from the URL. They wrap onto a second line on narrow screens, so none is hidden off the edge; each is 44px tall. */
export function CouncilNav({
  label,
  items,
}: {
  label: string;
  items: Array<{ segment: string | null; href: string; text: string }>;
}) {
  const current = useSelectedLayoutSegment();
  return (
    <nav aria-label={label} className="flex flex-wrap gap-x-5 sm:gap-x-6">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={current === i.segment ? "page" : undefined}
          className="inline-flex h-11 shrink-0 items-center border-b-2 border-transparent text-small font-medium text-ink-2 no-underline hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
        >
          {i.text}
        </Link>
      ))}
    </nav>
  );
}
