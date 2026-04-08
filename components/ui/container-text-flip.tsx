"use client";

import React, { useState, useEffect, useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ContainerTextFlipProps {
  words?: string[];
  interval?: number;
  className?: string;
  textClassName?: string;
  animationDuration?: number;
}

export function ContainerTextFlip({
  words = ["taxes", "zoning", "curriculum", "budget", "transportation", "redistricting"],
  interval = 2500,
  className,
  textClassName,
  animationDuration = 700,
}: ContainerTextFlipProps) {
  const id = useId();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [width, setWidth] = useState(100);
  const textRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.scrollWidth + 32;
      setWidth(textWidth);
    }
  }, [currentWordIndex]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(intervalId);
  }, [words, interval]);

  return (
    <motion.div
      layout
      layoutId={`words-here-${id}`}
      animate={{ width }}
      transition={{ duration: animationDuration / 2000 }}
      className={cn(
        "relative inline-block rounded-lg pt-1.5 pb-2 text-center text-lg font-bold md:text-xl",
        "dark:[background:linear-gradient(to_bottom,rgba(13,94,107,0.7),rgba(6,24,32,0.9))]",
        "dark:shadow-[inset_0_-1px_rgba(43,189,212,0.25),inset_0_0_0_1px_rgba(43,189,212,0.2),_0_4px_12px_rgba(0,0,0,0.4)]",
        "[background:linear-gradient(to_bottom,rgba(43,189,212,0.12),rgba(13,94,107,0.08))]",
        "shadow-[inset_0_-1px_rgba(43,189,212,0.3),inset_0_0_0_1px_rgba(43,189,212,0.25)]",
        className,
      )}
      key={words[currentWordIndex]}
    >
      <motion.div
        transition={{ duration: animationDuration / 1000, ease: "easeInOut" }}
        className={cn("inline-block", textClassName)}
        ref={textRef}
        layoutId={`word-div-${words[currentWordIndex]}-${id}`}
      >
        <motion.span className="inline-block">
          {words[currentWordIndex].split("").map((letter, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: index * 0.03 }}
              className="text-[#2BBDD4]"
            >
              {letter}
            </motion.span>
          ))}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
