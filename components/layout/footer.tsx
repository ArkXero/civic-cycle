import Link from 'next/link'
import { APP_NAME, EXTERNAL_LINKS } from '@/lib/constants'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">{APP_NAME}</h3>
            <p className="text-sm text-muted-foreground">
              Helping Fairfax County residents stay informed about local
              government decisions through AI-powered meeting summaries.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/meetings"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Browse Meetings
                </Link>
              </li>
              <li>
                <Link
                  href="/alerts"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Set Up Alerts
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Official Sources */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Official Sources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={EXTERNAL_LINKS.fcpsWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  FCPS Official Website
                </a>
              </li>
              <li>
                <a
                  href={EXTERNAL_LINKS.fcpsYoutube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  FCPS YouTube Channel
                </a>
              </li>
              <li>
                <a
                  href={EXTERNAL_LINKS.fairfaxCounty}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Fairfax County Government
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            {currentYear} {APP_NAME}. Built by a TJHSST student for the
            Fairfax County community.
          </p>
          <p className="mt-2">
            This is an independent project and is not affiliated with FCPS or
            Fairfax County Government.
          </p>
        </div>
      </div>
    </footer>
  )
}
