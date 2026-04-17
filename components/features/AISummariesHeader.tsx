"use client";

import { GraduationCap, Users, Gavel } from "lucide-react";

/** Simplified Anthropic/Claude logo — three diagonal parallel lines */
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.5 18L11 6M10.5 18L15 6M14.5 18L19 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Five icons connected to the Civic Cycle center by wires.
 *
 * Glowing wires (activate on card hover):
 *   [School]  --teal--> [Civic Cycle] --gold--> [Claude]
 *
 * Static wires (always muted, no hover change):
 *   [People]  ---------> [Civic Cycle]
 *   [Civic Cycle] -----> [Gavel]
 *
 * SVG viewBox="0 0 520 140"  preserveAspectRatio="none"
 * Coordinates are derived from CSS percentage positions × viewBox dimensions.
 *
 *   People : left  8%, top 18%  → SVG (42,  25)
 *   School : left 10%, top 76%  → SVG (52, 106)
 *   Center : left 50%, top 52%  → SVG (260, 73)
 *   Claude : left 88%, top 62%  → SVG (457, 87)
 *   Gavel  : left 85%, top 20%  → SVG (442, 28)
 */
export default function AISummariesHeader() {
  return (
    <div className="relative w-full h-44 select-none overflow-visible">
      {/* ── Wires ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 520 140"
        preserveAspectRatio="none"
      >
        {/* People → Civic Cycle  (static / no glow) */}
        <path
          d="M 66 25 L 118 25 L 158 66 L 228 66"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border"
        />

        {/* School → Civic Cycle  (teal, glows on hover) */}
        <path
          d="M 76 106 L 122 106 L 158 80 L 228 80"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border group-hover/bento:stroke-[#1A8A9A] transition-all duration-500"
        />

        {/* Civic Cycle → Claude  (gold, glows on hover) — Claude is now top-right */}
        <path
          d="M 292 66 L 348 66 L 372 28 L 416 28"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border group-hover/bento:stroke-[#F5A623] transition-all duration-500"
        />

        {/* Civic Cycle → Gavel  (static / no glow) — Gavel is now middle-right */}
        <path
          d="M 292 80 L 348 80 L 372 87 L 432 87"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border"
        />
      </svg>

      {/* ── People icon (top-left, no glow) ── */}
      <div
        className="
          absolute -translate-x-1/2 -translate-y-1/2
          w-12 h-12 rounded-full
          flex items-center justify-center
          border border-border bg-background
        "
        style={{ left: "8%", top: "18%" }}
      >
        <Users className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* ── School icon (bottom-left, teal glow) ── */}
      <div
        className="
          absolute -translate-x-1/2 -translate-y-1/2
          w-14 h-14 rounded-full
          flex items-center justify-center
          border border-border bg-background
          transition-all duration-300
          group-hover/bento:border-[#1A8A9A]
          group-hover/bento:shadow-[0_0_18px_rgba(26,138,154,0.5)]
        "
        style={{ left: "10%", top: "76%" }}
      >
        <GraduationCap className="w-6 h-6 text-muted-foreground transition-colors duration-300 group-hover/bento:text-[#1A8A9A]" />
      </div>

      {/* ── Civic Cycle icon (center) ── */}
      <div
        className="
          absolute -translate-x-1/2 -translate-y-1/2
          w-20 h-20 rounded-2xl
          flex items-center justify-center
          border border-border bg-background
          transition-all duration-300
          group-hover/bento:border-teal-primary
          group-hover/bento:shadow-[0_0_24px_rgba(26,138,154,0.4)]
        "
        style={{ left: "50%", top: "52%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.png" alt="Civic Cycle" className="w-11 h-11" aria-hidden="true" />
      </div>

      {/* ── Claude icon (top-right, gold glow) ── */}
      <div
        className="
          absolute -translate-x-1/2 -translate-y-1/2
          w-14 h-14 rounded-full
          flex items-center justify-center
          border border-border bg-background
          transition-all duration-300
          group-hover/bento:border-[#F5A623]
          group-hover/bento:shadow-[0_0_18px_rgba(245,166,35,0.5)]
        "
        style={{ left: "85%", top: "20%" }}
      >
        <ClaudeIcon className="w-6 h-6 text-muted-foreground transition-colors duration-300 group-hover/bento:text-[#F5A623]" />
      </div>

      {/* ── Gavel icon (middle-right, no glow) ── */}
      <div
        className="
          absolute -translate-x-1/2 -translate-y-1/2
          w-12 h-12 rounded-full
          flex items-center justify-center
          border border-border bg-background
        "
        style={{ left: "88%", top: "62%" }}
      >
        <Gavel className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}
