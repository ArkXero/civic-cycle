// App metadata
export const APP_NAME = "Civic Cycle";
export const APP_DESCRIPTION =
  "Every School Board meeting, automatically summarized — key decisions, budget items, and policy changes surfaced for residents who don't have three hours.";

// Meeting bodies
export const MEETING_BODIES = [
  "FCPS School Board",
  "Board of Supervisors",
] as const;
export type MeetingBodyType = (typeof MEETING_BODIES)[number];

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
  { href: "/alerts", label: "My Alerts", protected: true },
  { href: "/admin/boarddocs", label: "Import", protected: true, adminOnly: true },
  { href: "/admin/dashboard", label: "Dashboard", protected: true, adminOnly: true },
];

// External links
export const EXTERNAL_LINKS = {
  fcpsBoardDocs: "https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public",
  fcpsWebsite: "https://www.fcps.edu/",
  fairfaxCounty: "https://www.fairfaxcounty.gov/",
} as const;
