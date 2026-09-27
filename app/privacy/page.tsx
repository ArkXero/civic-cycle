import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${APP_NAME} collects, uses, and stores user data.`,
}

const sections = [
  {
    title: 'Data collected',
    body: [
      `${APP_NAME} collects email addresses used for account sign-in, password reset, keyword alerts, and weekly digest subscriptions.`,
      'If you create an account, app also stores your preferred county or school district so meetings, alerts, and digests can match your area.',
      'If you create keyword alerts, app stores keywords, selected meeting bodies, alert status, timestamps, and unsubscribe tokens needed to manage those alerts.',
      'If you sign in with Google, authentication is handled through Supabase and Google. Civic Cycle receives account details needed to identify your account, such as your email address.',
    ],
  },
  {
    title: 'How data used',
    body: [
      'Account data used to authenticate you, keep your session active, and let you manage settings.',
      'Alert and digest data used to send requested emails when matching meetings or weekly summaries become available.',
      'County preference used to personalize meeting lists, search results, and email content.',
      'Administrative logs may record operational events such as imports, summary generation, email sends, API usage, and admin role changes so service can be monitored and debugged.',
    ],
  },
  {
    title: 'What not collected intentionally',
    body: [
      'Civic Cycle does not ask for payment data.',
      'Civic Cycle does not build advertising profiles or sell personal data.',
      'Meeting transcripts, agendas, and summaries come from public government meeting materials, not private user submissions.',
    ],
  },
  {
    title: 'Sharing and processors',
    body: [
      'Data stored and processed with service providers used to run app, including Supabase for authentication and database services, Resend for email delivery, and configured infrastructure providers for hosting.',
      'Google may process authentication data when you choose Google sign-in.',
      'Data shared only as needed to operate service, comply with law, or protect app from abuse.',
    ],
  },
  {
    title: 'Retention and control',
    body: [
      'Account profile, alert preferences, and digest subscription records remain stored while account or subscription stays active.',
      'You can stop alert or digest emails at any time through unsubscribe links included in emails. You can also change your county preference from settings while account remains active.',
      'Deleting or fully removing account data is not yet self-serve in product interface. Until dedicated workflow exists, retention may continue until project operator removes data manually.',
    ],
  },
  {
    title: 'Security and limits',
    body: [
      'Civic Cycle uses third-party authentication and database tooling instead of storing raw passwords directly in application code.',
      'No internet service can promise perfect security. Use strong password or trusted Google account and avoid sharing credentials.',
    ],
  },
  {
    title: 'Policy updates',
    body: [
      'This policy may change as product features change. Material updates should be posted on this page with revised effective date.',
      'Effective date: May 30, 2026.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/70">
            Privacy Policy
          </p>
          <h1
            className="mt-4 text-4xl text-foreground sm:text-5xl"
            style={{ fontFamily: 'var(--font-display-var), Georgia, serif' }}
          >
            How {APP_NAME} handles user data
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
            This page describes data Civic Cycle collects, why it is used, and what controls
            currently exist for accounts, alerts, and digest emails.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border/60 bg-card/50 p-6 shadow-sm sm:p-8"
            >
              <h2
                className="text-2xl text-foreground"
                style={{ fontFamily: 'var(--font-display-var), Georgia, serif' }}
              >
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/15 bg-primary/5 p-6 text-sm leading-7 text-muted-foreground">
          <p>
            By using {APP_NAME}, you agree to this policy as it exists on date you use service.
            If you do not agree, do not create account or subscribe to emails.
          </p>
          <p className="mt-3">
            Return to{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              home
            </Link>
            {' '}or{' '}
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
