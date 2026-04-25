"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const easing = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function HeroClean() {
  const [bgVisible, setBgVisible] = useState(true);

  return (
    <section className="relative overflow-hidden border-b border-border flex min-h-[580px] hero-gradient">

      {/* Left panel — solid bg, all content */}
      <div className="flex flex-col justify-center w-full md:w-[55%] bg-background py-20 px-8 md:px-12 lg:px-16 relative z-10">

        {/* Content */}
        <div className="relative">

          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easing }}
            className="eyebrow mb-5"
            style={{ color: "var(--foreground)", opacity: 0.6 }}
          >
            Fairfax County Public Schools · School Board
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: easing }}
            className="text-foreground leading-[1.08] tracking-[-0.025em] mb-6"
            style={{
              fontFamily: "var(--font-display-var), Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(2.5rem, 5.5vw, 4rem)",
            }}
          >
            School board meetings,
            <br />
            explained{" "}
            <span className="relative inline-block">
              in minutes.
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.55, ease: easing }}
                className="absolute bottom-1 left-0 right-0 h-[3px] rounded-full origin-left"
                style={{ background: "#F5A623" }}
                aria-hidden="true"
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: easing }}
            className="text-foreground/80 leading-relaxed mb-9 max-w-[480px]"
            style={{
              fontFamily: "var(--font-body-var), ui-sans-serif, system-ui, sans-serif",
              fontSize: "17px",
            }}
          >
            Every FCPS board meeting is automatically summarized — key votes,
            budget items, and policy changes surfaced for residents who
            don&apos;t have three hours.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28, ease: easing }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <Link
              href="/meetings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[15px] font-semibold text-white bg-primary hover:bg-[#157f8e] transition-colors"
              style={{ fontFamily: "var(--font-body-var), ui-sans-serif, system-ui, sans-serif" }}
            >
              Read Latest Summary
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/meetings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[15px] font-semibold text-primary border border-[rgba(26,138,154,0.35)] hover:border-primary hover:bg-[rgba(26,138,154,0.06)] transition-colors"
              style={{ fontFamily: "var(--font-body-var), ui-sans-serif, system-ui, sans-serif" }}
            >
              Browse All Meetings
            </Link>
          </motion.div>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease: easing }}
            className="mt-12 pt-8 border-t border-border flex flex-wrap gap-8"
          >
            {[
              { value: "Free", label: "No account required to read" },
              { value: "2 min", label: "Average summary read time" },
              { value: "Every meeting", label: "Automatically summarized" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <span
                  className="text-primary"
                  style={{
                    fontFamily: "var(--font-display-var), Georgia, serif",
                    fontSize: "26px",
                    fontWeight: 400,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  className="text-foreground/60"
                  style={{
                    fontFamily: "var(--font-body-var), ui-sans-serif, system-ui, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      {/* Right panel — photo only, hidden below md */}
      <div className="hidden md:block flex-1 relative">
        {bgVisible && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero-bg.jpg"
            alt=""
            onError={() => setBgVisible(false)}
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ filter: "blur(2px)", transform: "scale(1.03)" }}
            aria-hidden="true"
          />
        )}

        {/* Feather — blends left edge of photo into solid panel */}
        <div
          className="absolute inset-y-0 left-0 w-24 z-10 dark:opacity-0"
          style={{ background: "linear-gradient(to right, #F4F8F9, transparent)" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 left-0 w-24 z-10 opacity-0 dark:opacity-100"
          style={{ background: "linear-gradient(to right, #0A1A1F, transparent)" }}
          aria-hidden="true"
        />
      </div>

    </section>
  );
}
