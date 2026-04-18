import { Resend } from "resend";

const LOGO_URL = "https://raw.githubusercontent.com/ArkXero/civic-cycle/main/public/favicon-32.png";

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeKeyword} - Civic Cycle Alert</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #0D5E6B; padding: 24px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle; padding-right: 10px;">
          <img src="${LOGO_URL}" alt="" width="32" height="32" style="display: block;">
        </td>
        <td style="vertical-align: middle;">
          <h1 style="font-family: 'Playfair Display', Georgia, serif; color: white; margin: 0; font-size: 26px; font-weight: 400; letter-spacing: 0.01em;">Civic Cycle</h1>
        </td>
      </tr>
    </table>
  </div>

  <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="font-family: 'Playfair Display', Georgia, serif; color: #1a1a1a; margin-top: 0; font-weight: 400;">Keyword Alert: &ldquo;${safeKeyword}&rdquo;</h2>

    <p style="color: #6b6b6b;">Your keyword was mentioned in a recent meeting:</p>

    <div style="background-color: #0D5E6B; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; margin: 0 0 8px 0; color: #ffffff; font-weight: 400;">${safeMeetingTitle}</h3>
      <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 14px;">${safeMeetingDate}</p>
    </div>

    <p style="color: #1a1a1a;"><strong>Excerpt:</strong></p>
    <p style="color: #6b6b6b; background-color: #fafafa; padding: 12px; border-left: 3px solid #F5A623; margin: 0 0 20px 0;">
      ${safeSummaryExcerpt}
    </p>

    <a href="${safeMeetingUrl}" style="display: inline-block; background-color: #0D5E6B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-family: 'Manrope', sans-serif;">
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
