"use client";

import { Sparkles } from "lucide-react";

const wavePath =
  "M0 40 Q 25 10, 50 40 T 100 40 T 150 40 T 200 40 T 250 40 T 300 40 T 350 40 T 400 40";

export default function AISummariesHeader() {
  return (
    <div className="flex items-center justify-between w-full h-24">
      <svg
        viewBox="0 0 400 80"
        className="w-full h-full flex-1 text-teal-primary"
        preserveAspectRatio="none"
      >
        <path
          d={wavePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="800"
          strokeDashoffset="0"
          className="group-hover/bento:animate-sine-wave"
        />
      </svg>
      <Sparkles className="h-8 w-8 flex-shrink-0 ml-4 text-teal-primary" />
    </div>
  );
}
