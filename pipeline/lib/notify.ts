/**
 * Emails the site's owner when something needs them, such as the Anthropic
 * account running out of credit. Sends at most once a day per subject, so a
 * run that hits the same problem in three jobs sends one email.
 *
 * Needs RESEND_API_KEY and ALERTS_FROM; goes to ADMIN_EMAIL, or the site's
 * contact address when that isn't set.
 */
import { sql } from "drizzle-orm";
import { SITE } from "../../src/lib/site";
import type { JobContext } from "./job";

export async function notifyOwner(
  ctx: JobContext,
  key: string,
  subject: string,
  body: string,
): Promise<void> {
  const to = process.env.ADMIN_EMAIL || SITE.contactEmail;
  if (!process.env.RESEND_API_KEY || !process.env.ALERTS_FROM || !to) {
    ctx.log(`would notify the owner: ${subject}`);
    return;
  }
  // One email per subject per day: remembered in pipeline_state.
  const stateKey = `notify:${key}`;
  const today = new Date().toISOString().slice(0, 10);
  const prev = await ctx.db.execute<{ value: string }>(
    sql`select value::text as value from pipeline_state where key = ${stateKey}`,
  );
  if (prev[0]?.value?.includes(today)) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERTS_FROM,
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    await ctx.db.execute(sql`
      insert into pipeline_state (key, value) values (${stateKey}, ${JSON.stringify(today)}::jsonb)
      on conflict (key) do update set value = excluded.value
    `);
  } catch (err) {
    ctx.warn(`couldn't email the owner: ${(err as Error).message}`);
  }
}

export const OUT_OF_CREDIT = {
  key: "anthropic-credit",
  subject: "OpenCouncil: the Anthropic account has run out of credit",
  body: [
    "The AI meeting summaries have stopped because the Anthropic API account has no credit left.",
    "",
    "To top up: go to https://console.anthropic.com, open Settings, then Billing, and buy credits. You can also switch on auto-reload there so this doesn't happen again.",
    "",
    "Nothing else is affected. The jobs carry on from where they stopped on the next run after the top-up.",
  ].join("\n"),
};
