"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Rich } from "@/i18n/rich";

/**
 * When the page was opened from a postcode (?n=<neighbourhood code>), says
 * which neighbourhood that is and outlines it on every map on the page.
 */
export function YourArea({ names, template }: { names: Record<string, string>; template: string }) {
  const code = useSearchParams().get("n");
  const name = code ? names[code] : undefined;

  useEffect(() => {
    if (!name || !code) return;
    const added: Element[] = [];
    for (const svg of document.querySelectorAll("svg[data-hoods]")) {
      const path = svg.querySelector(`[data-code="${CSS.escape(code)}"]`);
      if (!path) continue;
      const mark = path.cloneNode(true) as SVGElement;
      mark.setAttribute("fill", "none");
      mark.setAttribute("stroke", "var(--ink)");
      mark.setAttribute("stroke-width", "3");
      mark.setAttribute("pointer-events", "none");
      mark.removeAttribute("data-code");
      mark.querySelector("title")?.remove();
      svg.appendChild(mark);
      added.push(mark);
    }
    return () => added.forEach((m) => m.remove());
  }, [code, name]);

  if (!name) return null;
  return (
    <p className="mt-4 max-w-[62ch] rounded-md bg-mark px-3 py-2 text-body">
      <Rich text={template} values={{ name }} />
    </p>
  );
}
