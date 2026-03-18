import Link from "next/link";
import { ArrowRight, Bell, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/constants";
import type { MeetingWithSummary } from "@/types";

async function getRecentMeetings(): Promise<MeetingWithSummary[]> {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, summary:summaries(*)")
    .eq("status", "summarized")
    .order("meeting_date", { ascending: false })
    .limit(3);

  return (meetings || []).map((meeting) => {
    const m = meeting as { summary?: unknown[] };
    return Object.assign({}, meeting, { summary: m.summary?.[0] || null });
  }) as MeetingWithSummary[];
}

export default async function Home() {
  const recentMeetings = await getRecentMeetings();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Stay Informed About
          <span className="text-primary block mt-2">
            Fairfax County Schools
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {APP_NAME} summarizes FCPS School Board meetings so you can stay
          informed in minutes, not hours. Get AI-powered summaries and keyword
          alerts delivered to your inbox.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/meetings">
              Browse Meetings
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/alerts">
              Set Up Alerts
              <Bell className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Recent Meetings */}
      {recentMeetings.length > 0 && (
        <section className="py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Recent Meeting Summaries
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/meetings">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI-Powered Summaries</CardTitle>
              <CardDescription>
                We use AI to analyze meeting transcripts and extract key
                decisions, votes, and action items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Read a 2-minute summary instead of reading a lengthy agenda.
                Every summary links back to the original BoardDocs agenda.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>
                Find discussions about topics you care about across all past
                meetings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search for &quot;bell schedules&quot;, &quot;budget&quot;, or
                any topic. Filter by date or meeting type to find exactly what
                you need.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Keyword Alerts</CardTitle>
              <CardDescription>
                Get notified when topics you care about are discussed in
                meetings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Set up alerts for keywords like your school name, &quot;property
                tax&quot;, or &quot;transportation&quot;. We&apos;ll email you
                when there&apos;s a match.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 text-center">
        <Card className="max-w-2xl mx-auto bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Stay Informed?</CardTitle>
            <CardDescription className="text-base">
              Browse recent meeting summaries or create an account to set up
              personalized keyword alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild>
                <Link href="/meetings">View Recent Meetings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/signup">Create Free Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
