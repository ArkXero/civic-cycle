import { ACTIVE_SCHOOL_DISTRICTS } from '@/lib/school-districts'

// App metadata
export const APP_NAME = "Civic Cycle";
export const APP_DESCRIPTION =
  "School board meetings, automatically summarized — key decisions, budget items, and policy changes surfaced for residents who don't have three hours.";

// Meeting bodies
export const MEETING_BODIES = [
  ...ACTIVE_SCHOOL_DISTRICTS.map((district) => district.boardBodyLabel),
  "Board of Supervisors",
] as const;
export type MeetingBodyType = string;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// API endpoints
export const API_ROUTES = {
  meetings: "/api/meetings",
  search: "/api/search",
  alerts: "/api/alerts",
} as const;

// Navigation links
export interface NavLink {
  href: string;
  label: string;
  protected?: boolean;
  adminOnly?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/calendar", label: "Calendar" },
  { href: "/alerts", label: "My Alerts", protected: true },
  { href: "/settings", label: "Settings", protected: true },
  { href: "/admin/boarddocs", label: "Import", protected: true, adminOnly: true },
  { href: "/admin/topics", label: "Topics", protected: true, adminOnly: true },
  { href: "/admin/dashboard", label: "Dashboard", protected: true, adminOnly: true },
];

// External links
export const EXTERNAL_LINKS = {
  fcpsBoardDocs: "https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public",
  fcpsWebsite: "https://www.fcps.edu/",
  fairfaxCounty: "https://www.fairfaxcounty.gov/",
} as const;
