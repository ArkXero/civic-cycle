"use client"

import AutoScroll from "embla-carousel-auto-scroll"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"

const row1 = ["budget", "curriculum", "bell schedule", "property tax", "STEM", "facilities", "transportation", "equity"]
const row2 = ["special education", "school safety", "redistricting", "construction", "athletics", "hiring", "lunch program", "technology"]
const row3 = ["school choice", "mental health", "bus routes", "teacher pay", "AP courses", "enrollment", "snow days", "after school"]

function KeywordRow({ keywords, reverse = false }: { keywords: string[]; reverse?: boolean }) {
  return (
    <div className="relative w-full">
      <Carousel
        opts={{ loop: true, dragFree: true }}
        plugins={[AutoScroll({ playOnInit: true, speed: 0.6, direction: reverse ? "backward" : "forward" })]}
        className="w-full"
      >
        <CarouselContent className="ml-0">
          {[...keywords, ...keywords].map((kw, i) => (
            <CarouselItem key={i} className="pl-0 basis-auto">
              <span className="mx-2 inline-block rounded-full border border-teal-primary text-teal-light bg-transparent px-4 py-1.5 text-sm whitespace-nowrap">
                {kw}
              </span>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card dark:from-[#0f2535] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card dark:from-[#0f2535] to-transparent" />
    </div>
  )
}

export default function SearchFilterHeader() {
  return (
    <div className="flex flex-col gap-3 w-full overflow-hidden py-2">
      <KeywordRow keywords={row1} />
      <KeywordRow keywords={row2} reverse />
      <KeywordRow keywords={row3} />
    </div>
  )
}
