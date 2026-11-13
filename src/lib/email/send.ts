/**
 * Sends one email through Resend. Shared by the website (confirmation
 * emails) and the pipeline (the weekly email). Needs RESEND_API_KEY and
 * ALERTS_FROM; without them nothing is sent and the caller is told so.
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribe?: string;
}

export function canSend(): boolean {
  // Without a token secret the confirm and stop links in every email would be broken.
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERTS_FROM && (process.env.EMAIL_TOKEN_SECRET || process.env.REVALIDATE_SECRET));
}

export async function sendEmail(m: Email): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSend()) return { ok: false, error: "email is not set up (RESEND_API_KEY, ALERTS_FROM)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERTS_FROM,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.unsubscribe
          ? { headers: { "List-Unsubscribe": `<${m.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
          : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
