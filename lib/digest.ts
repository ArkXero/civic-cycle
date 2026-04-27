import { escapeHtml } from './resend'
import { formatDate, truncate } from './utils'

export interface DigestMeeting {
  id: string
  title: string
  meeting_date: string
  summary_text: string
}

interface DigestContent {
  html: string
  text: string
}

export function generateDigestContent(
  meetings: DigestMeeting[],
  appUrl: string
): DigestContent | null {
  if (meetings.length === 0) return null

  const meetingSectionsHtml = meetings
    .map((m) => {
      const safeTitle = escapeHtml(m.title)
      const safeDate = escapeHtml(formatDate(m.meeting_date))
      const safeExcerpt = escapeHtml(truncate(m.summary_text, 400))
      const meetingUrl = `${appUrl}/meetings/${m.id}`

      return `
      <div style="margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid #e0e0e0;">
        <h3 style="font-family:'Playfair Display',Georgia,serif;margin:0 0 4px 0;font-weight:400;color:#1a1a1a;">${safeTitle}</h3>
        <p style="margin:0 0 10px 0;color:#6b6b6b;font-size:14px;">${safeDate}</p>
        <p style="margin:0 0 14px 0;color:#1a1a1a;">${safeExcerpt}</p>
        <a href="${meetingUrl}" style="color:#0D5E6B;font-weight:500;text-decoration:none;">Read Full Summary &rarr;</a>
      </div>`
    })
    .join('')

  const meetingSectionsText = meetings
    .map(
      (m) =>
        `${m.title}\n${formatDate(m.meeting_date)}\n${truncate(m.summary_text, 400)}\nRead more: ${appUrl}/meetings/${m.id}`
    )
    .join('\n\n---\n\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background-color:#0D5E6B;padding:24px 20px;border-radius:8px 8px 0 0;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="vertical-align:middle;padding-right:10px;">
          <img src="https://raw.githubusercontent.com/ArkXero/civic-cycle/main/public/favicon-32.png" alt="" width="32" height="32" style="display:block;">
        </td>
        <td style="vertical-align:middle;">
          <h1 style="font-family:'Playfair Display',Georgia,serif;color:white;margin:0;font-size:26px;font-weight:400;">Civic Cycle</h1>
        </td>
      </tr>
    </table>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0 0;font-size:14px;">Weekly School Board Digest</p>
  </div>
  <div style="background-color:#ffffff;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
    <h2 style="font-family:'Playfair Display',Georgia,serif;color:#1a1a1a;margin-top:0;font-weight:400;">This Week&rsquo;s Meetings</h2>
    ${meetingSectionsHtml}
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;">
    <p style="color:#9a9a9a;font-size:12px;margin:0;">
      You&rsquo;re receiving this weekly digest from Civic Cycle.<br><br>
      <a href="{{UNSUBSCRIBE_URL}}" style="color:#9a9a9a;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`

  const text = `Civic Cycle — Weekly School Board Digest\n\n${meetingSectionsText}\n\n---\nUnsubscribe: {{UNSUBSCRIBE_URL}}`

  return { html, text }
}
