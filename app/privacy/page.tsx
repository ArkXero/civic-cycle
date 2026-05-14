import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Civic Cycle collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1
        className="text-3xl mb-2"
        style={{ fontFamily: "var(--font-display-var), Georgia, serif", fontWeight: 400 }}
      >
        Privacy Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">Effective May 13, 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="text-base font-semibold mb-3">1. Who We Are</h2>
          <p>
            Civic Cycle (<strong>civiccycle.org</strong>) is an independent civic technology project
            that summarizes Fairfax County Public Schools School Board and Board of Supervisors
            meetings using artificial intelligence. It is operated by an individual student developer
            and is not affiliated with FCPS or Fairfax County Government.
          </p>
          <p className="mt-2">
            Questions about this policy: <a href="mailto:memeronite@gmail.com" className="underline">memeronite@gmail.com</a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">2. Information We Collect</h2>

          <h3 className="text-sm font-semibold mt-4 mb-1">Account information</h3>
          <p>
            When you create an account we collect your <strong>email address</strong> and, if you
            sign in with Google, your <strong>display name</strong> as provided by Google. Display
            name is optional and you may clear it at any time.
          </p>

          <h3 className="text-sm font-semibold mt-4 mb-1">Alert preferences</h3>
          <p>
            When you create keyword alerts we store the <strong>keywords</strong> and
            meeting-body filters you choose, a record of which alert emails have been sent to you,
            and a high-entropy unsubscribe token used to generate your one-click unsubscribe link.
          </p>

          <h3 className="text-sm font-semibold mt-4 mb-1">Email digest subscription</h3>
          <p>
            All new accounts are automatically enrolled in the weekly meeting-summary digest.
            Your email address is stored in our digest subscriber list with an{" "}
            <strong>active</strong> flag. You may unsubscribe at any time via the link included
            in every digest email.
          </p>

          <h3 className="text-sm font-semibold mt-4 mb-1">Session data</h3>
          <p>
            We set <strong>authentication cookies</strong> (<code>sb-access-token</code> and{" "}
            <code>sb-refresh-token</code>) to maintain your login session. These cookies are
            marked <code>Secure</code> (HTTPS only) and <code>SameSite=Lax</code>. We do not
            set advertising or tracking cookies.
          </p>

          <h3 className="text-sm font-semibold mt-4 mb-1">What we do not collect</h3>
          <p>
            We do not collect payment information, physical address, phone number, or any
            biometric data. We do not run third-party analytics scripts (no Google Analytics,
            Mixpanel, Hotjar, or similar). We do not build behavioral profiles or sell data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Authenticate you and maintain your session</li>
            <li>Send keyword alert emails for meetings matching your saved alerts</li>
            <li>Send weekly digest emails summarizing recent meetings</li>
            <li>Display your alert preferences and account settings in the app</li>
            <li>Allow administrators to view aggregate usage statistics and manage the platform</li>
          </ul>
          <p className="mt-3">
            We do not use your information for advertising, profiling, or any purpose not listed above.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">4. Third-Party Services</h2>
          <p>Running this service requires sharing certain data with the following processors:</p>

          <div className="mt-4 space-y-4">
            <div>
              <p className="font-semibold">Supabase</p>
              <p>
                Our database and authentication provider. Your email, hashed credentials,
                OAuth metadata, alert preferences, and digest subscription status are stored
                on Supabase-hosted infrastructure. Supabase is SOC 2 Type II certified.
              </p>
            </div>
            <div>
              <p className="font-semibold">Google (OAuth)</p>
              <p>
                If you sign in with Google, Google shares your email address and display
                name with us via OAuth. We do not receive your Google password. Google&apos;s
                use of data during the OAuth flow is governed by Google&apos;s Privacy Policy.
              </p>
            </div>
            <div>
              <p className="font-semibold">Resend</p>
              <p>
                Our transactional email provider. Your email address, and the content of
                alert and digest emails (meeting titles, summaries, unsubscribe links),
                are transmitted to Resend for delivery.
              </p>
            </div>
            <div>
              <p className="font-semibold">Anthropic (Claude API)</p>
              <p>
                We send <strong>meeting transcripts</strong> — which are public government
                records from BoardDocs — to Anthropic&apos;s API for summarization. No personal
                information is transmitted to Anthropic.
              </p>
            </div>
          </div>

          <p className="mt-4">
            We do not sell your data to any party. We do not share your data with any
            service not listed above.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">5. Email Communications</h2>

          <h3 className="text-sm font-semibold mt-4 mb-1">Keyword alerts</h3>
          <p>
            Sent only when you have created an active alert and a matching meeting has been
            summarized. Each email contains a one-click unsubscribe link that permanently
            removes that alert. You can also manage and delete alerts from your Alerts page.
          </p>

          <h3 className="text-sm font-semibold mt-4 mb-1">Weekly digest</h3>
          <p>
            Sent weekly when new meeting summaries are available. All new accounts are
            enrolled automatically. Each digest email contains an unsubscribe link that
            removes you from future digests. You may also unsubscribe by contacting us directly.
          </p>

          <p className="mt-3">
            We do not send marketing emails, promotional messages, or any communication
            unrelated to meetings and your preferences.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">6. Data Retention</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Account and alert data</strong> — retained until you request deletion.
            </li>
            <li>
              <strong>Alert send history</strong> — retained indefinitely for deduplication
              (prevents re-sending the same alert). Records contain your user ID and meeting ID
              only; not email content.
            </li>
            <li>
              <strong>Digest subscription record</strong> — retained after unsubscription as a
              soft-deleted row (active = false) to honor your opt-out preference.
            </li>
            <li>
              <strong>Meeting data</strong> — BoardDocs meeting content is retained for 90 days,
              after which it is automatically deleted from our database.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">7. Your Rights</h2>
          <p>You may at any time:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Access the data associated with your account by logging in</li>
            <li>Delete individual keyword alerts from the Alerts page</li>
            <li>Unsubscribe from the weekly digest via any digest email</li>
            <li>
              Request deletion of your account and associated personal data by emailing{" "}
              <a href="mailto:memeronite@gmail.com" className="underline">memeronite@gmail.com</a>
            </li>
          </ul>
          <p className="mt-3">
            Virginia residents have additional rights under the Virginia Consumer Data Protection
            Act (VCDPA), including the right to access, correct, and delete personal data, and to
            opt out of certain processing. To exercise these rights, contact us at the email above.
            We will respond within 45 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">8. Security</h2>
          <p>
            Authentication sessions use secure, httpOnly cookies. Admin access is protected by
            role-based checks enforced server-side. Unsubscribe tokens use 256-bit random values.
            All traffic is served over HTTPS. Despite these measures, no system is perfectly
            secure; please use a strong, unique password for your account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">9. Children</h2>
          <p>
            This service is not directed at children under 13. We do not knowingly collect
            personal information from children under 13. If you believe a child has provided
            us information, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be noted by
            updating the effective date above. Continued use of the service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">11. Contact</h2>
          <p>
            <a href="mailto:memeronite@gmail.com" className="underline">memeronite@gmail.com</a>
          </p>
        </section>

      </div>
    </main>
  );
}
