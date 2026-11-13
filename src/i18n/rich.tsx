import Link from "next/link";
import { Fragment } from "react";

/**
 * Renders a translated sentence that contains emphasis and links without
 * splitting it into fragments, so word order can differ between languages.
 *
 *   "Members have spoken **{words}** words. [See the Record](record)"
 *
 * `**text**` becomes <strong>; `[text](key)` becomes a link to links[key].
 * `{name}` placeholders are filled from `values` before parsing.
 */
function parse(
  text: string,
  links: Record<string, string>,
  strongClassName: string,
  keyPrefix: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[(.+?)\]\((\w+)\)|\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last)
      parts.push(
        <Fragment key={`${keyPrefix}${i++}`}>
          {text.slice(last, m.index)}
        </Fragment>,
      );
    if (m[1] !== undefined) {
      const inner = parse(m[1], links, strongClassName, `${keyPrefix}${i}-`);
      const url = links[m[2]];
      parts.push(
        url ? (
          <Link key={`${keyPrefix}${i++}`} href={url}>
            {inner}
          </Link>
        ) : (
          <Fragment key={`${keyPrefix}${i++}`}>{inner}</Fragment>
        ),
      );
    } else {
      parts.push(
        <strong key={`${keyPrefix}${i++}`} className={strongClassName}>
          {m[3]}
        </strong>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length)
    parts.push(
      <Fragment key={`${keyPrefix}${i++}`}>{text.slice(last)}</Fragment>,
    );
  return parts;
}

export function Rich({
  text,
  values = {},
  links = {},
  strongClassName = "font-semibold",
}: {
  text: string;
  values?: Record<string, string | number>;
  links?: Record<string, string>;
  strongClassName?: string;
}) {
  const filled = text.replace(/\{(\w+)\}/g, (_, k: string) =>
    String(values[k] ?? `{${k}}`),
  );
  return <>{parse(filled, links, strongClassName, "r")}</>;
}
