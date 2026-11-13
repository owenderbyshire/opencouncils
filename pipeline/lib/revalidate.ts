/**
 * Tells the website which cached data changed, so pages refresh within
 * seconds of the pipeline finishing instead of waiting for their cache to
 * expire. Safe to skip: every cache also expires on its own.
 */
export async function revalidateSite(tags: string[]) {
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret || /localhost|127\.0\.0\.1/.test(site)) {
    console.log(`revalidate: skipped (${tags.length} tags)`);
    return;
  }
  // Collapse per-item tags when there are many, to keep the request small.
  const meetingTags = tags.filter((t) => t.startsWith("meeting:"));
  const other = tags.filter((t) => !t.startsWith("meeting:"));
  const send = meetingTags.length > 200 ? [...new Set([...other, "meetings"])] : tags;
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags: send }),
    });
    console.log(`revalidate: ${res.status} (${send.length} tags)`);
  } catch (err) {
    console.warn(`revalidate: failed (${(err as Error).message})`);
  }
}
