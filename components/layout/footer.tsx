import Link from 'next/link'
import Image from 'next/image'
import { APP_NAME, EXTERNAL_LINKS } from '@/lib/constants'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0A1E24] border-t border-[rgba(26,138,154,0.2)]">
      <div className="max-w-[1200px] mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">

          {/* About */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Image
                src="/favicon.png"
                alt=""
                width={26}
                height={26}
                aria-hidden="true"
                unoptimized
                className="rounded-md"
              />
              <span
                className="text-[15px] text-[#F4F8F9]"
                style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
              >
                {APP_NAME}
              </span>
            </div>
            <p
              className="text-[13.5px] leading-relaxed"
              style={{
                color: 'rgba(244,248,249,0.45)',
                fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Helping Fairfax County residents stay informed about local
              government decisions through AI-powered meeting summaries.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.18em] uppercase mb-4"
              style={{
                color: 'rgba(244,248,249,0.35)',
                fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Quick Links
            </p>
            <ul className="space-y-2.5">
              {[
                { href: '/meetings', label: 'Browse Meetings' },
                { href: '/alerts', label: 'Set Up Alerts' },
                { href: '/search', label: 'Search' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13.5px] transition-colors hover:text-[#F4F8F9]"
                    style={{
                      color: 'rgba(244,248,249,0.5)',
                      fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Official Sources */}
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.18em] uppercase mb-4"
              style={{
                color: 'rgba(244,248,249,0.35)',
                fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Official Sources
            </p>
            <ul className="space-y-2.5">
              {[
                { href: EXTERNAL_LINKS.fcpsWebsite, label: 'FCPS Official Website' },
                { href: EXTERNAL_LINKS.fcpsBoardDocs, label: 'FCPS BoardDocs' },
                { href: EXTERNAL_LINKS.fairfaxCounty, label: 'Fairfax County Government' },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13.5px] transition-colors hover:text-[#F4F8F9]"
                    style={{
                      color: 'rgba(244,248,249,0.5)',
                      fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
          style={{ borderTop: '1px solid rgba(26,138,154,0.15)' }}
        >
          <p
            className="text-[12px]"
            style={{
              color: 'rgba(244,248,249,0.3)',
              fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            © {currentYear} {APP_NAME}. Built by a TJHSST student for the Fairfax County community.
          </p>
          <p
            className="text-[11.5px]"
            style={{
              color: 'rgba(244,248,249,0.2)',
              fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Independent project — not affiliated with FCPS or Fairfax County Government.
          </p>
        </div>
      </div>
    </footer>
  )
}
