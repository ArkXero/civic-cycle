// App metadata
export const APP_NAME = "Fairfax Civic Digest";
export const APP_DESCRIPTION =
  "Stay informed about FCPS School Board meetings with AI-powered summaries and keyword alerts.";

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
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/alerts", label: "My Alerts", protected: true },
];

// External links
export const EXTERNAL_LINKS = {
  fcpsYoutube:
    "https://www.youtube.com/playlist?list=PLSz76NCRDYQF3hPS2qS2SGEcoO4__Yd7Z",
  fcpsWebsite: "https://www.fcps.edu/",
  fairfaxCounty: "https://www.fairfaxcounty.gov/",
} as const;
