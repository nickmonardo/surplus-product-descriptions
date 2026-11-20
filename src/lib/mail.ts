import "server-only";

// Email through Mailgun's HTTP API (TIA already sends from mg.theinfluenceagency.com).
// Without MAILGUN_API_KEY the message is logged instead of sent, which is what local
// development wants: the sign-in link appears in the server log.

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAIL_FROM ?? (domain ? `Surplus product descriptions <copy@${domain}>` : "");
  if (!key || !domain) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] MAILGUN_API_KEY or MAILGUN_DOMAIN is not set; email not sent");
    } else {
      console.log(`[mail] (not sent, no Mailgun config) to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    }
    return { sent: false };
  }
  const base = process.env.MAILGUN_API_BASE ?? "https://api.mailgun.net";
  const res = await fetch(`${base}/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`api:${key}`).toString("base64") },
    body: new URLSearchParams({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error(`[mail] Mailgun returned HTTP ${res.status}`);
    return { sent: false };
  }
  return { sent: true };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function signInMail(to: string, link: string): Mail {
  return {
    to,
    subject: "Your sign-in link: Surplus product descriptions",
    text: `Sign in to review Surplus Furniture product descriptions:\n\n${link}\n\nThe link works once, for 15 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Sign in to review Surplus Furniture product descriptions:</p><p><a href="${esc(link)}">Sign in</a></p><p style="color:#666">The link works once, for 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  };
}

export function batchReadyMail(to: string, link: string, count: number, seo: number, thin: number): Mail {
  const summary = `${count} product${count === 1 ? "" : "s"} to review: ${seo} new arrival${seo === 1 ? "" : "s"} with an SEO pass, ${thin} with thin descriptions.`;
  return {
    to,
    subject: `This week's product descriptions are ready (${count})`,
    text: `${summary}\n\nApprove, edit or reject each one here:\n${link}\n\nThe link signs you in once and works for 3 days.`,
    html: `<p>${esc(summary)}</p><p><a href="${esc(link)}">Review this week's descriptions</a></p><p style="color:#666">The link signs you in once and works for 3 days.</p>`,
  };
}
