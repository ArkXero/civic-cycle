import Link from 'next/link'
import { APP_NAME, EXTERNAL_LINKS } from '@/lib/constants'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      style={{
        background: '#061820',
        borderTop: '1px solid rgba(26, 138, 154, 0.25)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-0.5" aria-hidden="true">
                <div className="w-2 h-5 rounded-sm" style={{ background: '#1A8A9A' }} />
                <div className="w-2 h-5 rounded-sm" style={{ background: '#F5A623' }} />
              </div>
              <h3
                className="text-lg text-white"
                style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
              >
                {APP_NAME}
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: '#5B8A94',
                fontFamily: 'var(--font-body-var), monospace',
              }}
            >
              Helping Fairfax County residents stay informed about local
              government decisions through AI-powered meeting summaries.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3
              className="text-sm font-bold mb-4 tracking-[0.15em]"
              style={{
                color: '#F4F8F9',
                fontFamily: 'var(--font-body-var), monospace',
              }}
            >
              QUICK LINKS
            </h3>
            <ul className="space-y-3">
              {[
                { href: '/meetings', label: 'Browse Meetings' },
                { href: '/alerts', label: 'Set Up Alerts' },
                { href: '/search', label: 'Search' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                    style={{
                      color: '#5B8A94',
                      fontFamily: 'var(--font-body-var), monospace',
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
            <h3
              className="text-sm font-bold mb-4 tracking-[0.15em]"
              style={{
                color: '#F4F8F9',
                fontFamily: 'var(--font-body-var), monospace',
              }}
            >
              OFFICIAL SOURCES
            </h3>
            <ul className="space-y-3">
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
                    className="text-sm transition-colors hover:text-white"
                    style={{
                      color: '#5B8A94',
                      fontFamily: 'var(--font-body-var), monospace',
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div
          className="mt-12 pt-8 text-center"
          style={{ borderTop: '1px solid rgba(26, 138, 154, 0.2)' }}
        >
          <p
            className="text-sm"
            style={{ color: '#5B8A94', fontFamily: 'var(--font-body-var), monospace' }}
          >
            {currentYear} {APP_NAME}. Built by a TJHSST student for the Fairfax County community.
          </p>
          <p
            className="mt-2 text-xs"
            style={{ color: 'rgba(91,138,148,0.6)', fontFamily: 'var(--font-body-var), monospace' }}
          >
            Independent project — not affiliated with FCPS or Fairfax County Government.
          </p>
        </div>
      </div>
    </footer>
  )
}
