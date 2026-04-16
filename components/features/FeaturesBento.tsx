import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import AISummariesHeader from "./AISummariesHeader";
import SearchFilterHeader from "./SearchFilterHeader";
import KeywordAlertsHeader from "./KeywordAlertsHeader";
import { Brain, Search, Bell } from "lucide-react";

const iconClass = "h-4 w-4 text-teal-primary";

const items = [
  {
    title: "AI-Powered Summaries",
    description:
      "Claude AI analyzes meeting agendas and extracts key decisions, votes, and action items — so you can read a 2-minute summary instead of a 3-hour agenda.",
    header: <AISummariesHeader />,
    className: "md:col-span-2",
    icon: <Brain className={iconClass} />,
  },
  {
    title: "Search & Filter",
    description:
      'Find discussions about topics you care about across all past meetings. Search for "bell schedules", "budget", or any topic and filter by date or meeting type.',
    header: <SearchFilterHeader />,
    className: "md:col-span-1",
    icon: <Search className={iconClass} />,
  },
  {
    title: "Keyword Alerts",
    description:
      'Set up alerts for keywords like your school name, "property tax", or "transportation". We\'ll email you when there\'s a match in a new meeting summary.',
    header: <KeywordAlertsHeader />,
    className: "md:col-span-3",
    icon: <Bell className={iconClass} />,
  },
];

export default function FeaturesBento() {
  return (
    <section className="py-20 px-4 bg-background">
      <h2 className="text-center text-3xl font-bold text-foreground mb-12">
        Everything you need to stay informed
      </h2>
      <BentoGrid className="max-w-4xl mx-auto md:auto-rows-[20rem]">
        {items.map((item, i) => (
          <BentoGridItem key={i} {...item} />
        ))}
      </BentoGrid>
    </section>
  );
}
