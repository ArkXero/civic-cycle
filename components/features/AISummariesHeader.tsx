"use client";

import { GraduationCap, Users, Gavel } from "lucide-react";

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 257" fill="none" className={className} aria-hidden="true">
      <path
        d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AISummariesHeader() {
  return (
    <div className="relative w-full h-44 select-none overflow-visible">
      {/* ── Wires ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 520 140"
        preserveAspectRatio="none"
      >
        {/* People → Civic Cycle  (static) */}
        <path
          d="M 66 25 L 118 25 L 158 66 L 228 66"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border"
        />

        {/* School → Civic Cycle  (teal glow on hover) */}
        <path
          d="M 76 106 L 122 106 L 158 80 L 228 80"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border group-hover/bento:stroke-[#1A8A9A] transition-all duration-500"
        />

        {/* Civic Cycle → Claude  (gold glow on hover) */}
        <path
          d="M 292 66 L 348 66 L 372 28 L 416 28"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border group-hover/bento:stroke-[#F5A623] transition-all duration-500"
        />

        {/* Civic Cycle → Gavel  (static) */}
        <path
          d="M 292 80 L 348 80 L 372 87 L 432 87"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border"
        />
      </svg>

      {/* People icon (top-left) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center border border-border bg-background"
        style={{ left: "8%", top: "18%" }}
      >
        <Users className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* School icon (bottom-left, teal glow) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center border border-border bg-background transition-all duration-300 group-hover/bento:border-[#1A8A9A] group-hover/bento:shadow-[0_0_18px_rgba(26,138,154,0.5)]"
        style={{ left: "10%", top: "76%" }}
      >
        <GraduationCap className="w-6 h-6 text-muted-foreground transition-colors duration-300 group-hover/bento:text-[#1A8A9A]" />
      </div>

      {/* Civic Cycle icon (center) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-2xl flex items-center justify-center border border-border bg-background transition-all duration-300 group-hover/bento:border-primary group-hover/bento:shadow-[0_0_24px_rgba(26,138,154,0.4)]"
        style={{ left: "50%", top: "52%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.png" alt="Civic Cycle" className="w-11 h-11" aria-hidden="true" />
      </div>

      {/* Claude icon (top-right, gold glow) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center border border-border bg-background transition-all duration-300 group-hover/bento:border-[#F5A623] group-hover/bento:shadow-[0_0_18px_rgba(245,166,35,0.5)]"
        style={{ left: "85%", top: "20%" }}
      >
        <ClaudeIcon className="w-6 h-6 text-muted-foreground transition-colors duration-300 group-hover/bento:text-[#F5A623]" />
      </div>

      {/* Gavel icon (middle-right) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center border border-border bg-background"
        style={{ left: "88%", top: "62%" }}
      >
        <Gavel className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}
