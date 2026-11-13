import { notFound } from "next/navigation";

/** Instant-navigation validation has nothing to check on a page that always 404s. */
export const instant = false;

/** Any address that doesn't match a page gets the site's own 404, inside the layout. */
export default function Missing() {
  notFound();
}
