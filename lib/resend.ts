import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY || "dummy");

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

/**
 * Escape special HTML characters in a string before embedding it in an
 * HTML email template. Prevents email injection / stored-XSS if AI-generated
 * summary text or user-supplied keywords ever contain HTML tags or entities.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

interface AlertEmailParams {
  to: string;
  keyword: string;
  meetingTitle: string;
  meetingDate: string;
  meetingBody: string;
  summaryExcerpt: string;
  meetingUrl: string;
  unsubscribeUrl: string;
}

export async function sendAlertEmail({
  to,
  keyword,
  meetingTitle,
  meetingDate,
  meetingBody,
  summaryExcerpt,
  meetingUrl,
  unsubscribeUrl,
}: AlertEmailParams) {
  // Escape all dynamic values before embedding in HTML
  const safeKeyword = escapeHtml(keyword);
  const safeMeetingTitle = escapeHtml(meetingTitle);
  const safeMeetingDate = escapeHtml(meetingDate);
  const safeMeetingBody = escapeHtml(meetingBody);
  const safeSummaryExcerpt = escapeHtml(summaryExcerpt);
  // URLs are used in href/action attributes — only allow http/https schemes
  const safeMeetingUrl = meetingUrl.startsWith("https://") || meetingUrl.startsWith("http://") ? meetingUrl : "#";
  const safeUnsubscribeUrl = unsubscribeUrl.startsWith("https://") || unsubscribeUrl.startsWith("http://") ? unsubscribeUrl : "#";

  const subject = `Alert: "${keyword}" mentioned in ${meetingBody} meeting`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeKeyword} - Civic Cycle Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1A8A9A; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Civic Cycle</h1>
  </div>

  <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Keyword Alert: &ldquo;${safeKeyword}&rdquo;</h2>

    <p style="color: #6b6b6b;">Your keyword was mentioned in a recent meeting:</p>

    <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${safeMeetingTitle}</h3>
      <p style="margin: 0; color: #6b6b6b; font-size: 14px;">${safeMeetingBody} &bull; ${safeMeetingDate}</p>
    </div>

    <p style="color: #1a1a1a;"><strong>Excerpt:</strong></p>
    <p style="color: #6b6b6b; background-color: #fafafa; padding: 12px; border-left: 3px solid #1A8A9A; margin: 0 0 20px 0;">
      ${safeSummaryExcerpt}
    </p>

    <a href="${safeMeetingUrl}" style="display: inline-block; background-color: #1A8A9A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Read Full Summary
    </a>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #9a9a9a; font-size: 12px; margin: 0;">
      You&rsquo;re receiving this because you set up an alert for &ldquo;${safeKeyword}&rdquo; on Civic Cycle.
      <br><br>
      <a href="${safeUnsubscribeUrl}" style="color: #9a9a9a;">Unsubscribe from this alert</a>
    </p>
  </div>
</body>
</html>
`;

  const text = `
Civic Cycle - Keyword Alert

Your keyword "${keyword}" was mentioned in a recent meeting.

${meetingTitle}
${meetingBody} • ${meetingDate}

Excerpt:
${summaryExcerpt}

Read the full summary: ${meetingUrl}

---
You're receiving this because you set up an alert for "${keyword}" on Civic Cycle.
Unsubscribe: ${unsubscribeUrl}
`;

  return resend.emails.send({
    from: `Civic Cycle <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}
