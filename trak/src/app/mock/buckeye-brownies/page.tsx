import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Instagram, Package, Play, Target, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Buckeye Brownies Launch · Mock Project",
};

const productionRun = [
  { sku: "Classic Buckeye", qty: "2,400 boxes", ship: "Dec 8", status: "Locked" },
  { sku: "Peppermint Buckeye", qty: "1,600 boxes", ship: "Dec 9", status: "Packaging art in review" },
  { sku: "Mocha Crunch", qty: "1,200 boxes", ship: "Dec 10", status: "Waiting on ingredient delivery" },
];

const launchTimeline = [
  { date: "Nov 18", milestone: "Finalize flavor lineup & recipe tweaks", owner: "Maria (Ops)", status: "Complete" },
  { date: "Nov 25", milestone: "Shoot hero product photography", owner: "Dev (Creative)", status: "In progress" },
  { date: "Dec 2", milestone: "Schedule Klaviyo flows + SMS", owner: "Fiona (Lifecycle)", status: "Queued" },
  { date: "Dec 5", milestone: "Influencer seeding kits shipped", owner: "Logan (Growth)", status: "On track" },
  { date: "Dec 12", milestone: "Launch day livestream + giveaways", owner: "All-hands", status: "Upcoming" },
];

const contentCalendar = [
  {
    channel: "Instagram Reels",
    concept: "Behind-the-scenes: dipping buckeyes",
    publish: "Nov 27",
    owner: "Dev",
    status: "Editing",
  },
  {
    channel: "TikTok",
    concept: "Holiday countdown day 10",
    publish: "Nov 28",
    owner: "Maya",
    status: "Drafting",
  },
  {
    channel: "Email",
    concept: "VIP early access (with bundle upsell)",
    publish: "Dec 11",
    owner: "Fiona",
    status: "Approved",
  },
];

const taskBuckets = [
  {
    title: "Recipe & Production",
    icon: <Package className="h-4 w-4" />,
    items: [
      { label: "Lock final ingredient suppliers", status: "Complete" },
      { label: "Confirm allergen statements for Peppermint batch", status: "In progress" },
      { label: "QA taste test with loyal customers", status: "Upcoming" },
    ],
  },
  {
    title: "Marketing",
    icon: <Target className="h-4 w-4" />,
    items: [
      { label: "Holiday landing page refresh", status: "Complete" },
      { label: "Paid social creatives (carousel + UGC)", status: "In progress" },
      { label: "Influencer giveaway partnerships", status: "Upcoming" },
    ],
  },
  {
    title: "Launch Day Ops",
    icon: <Timer className="h-4 w-4" />,
    items: [
      { label: "Staffing schedule for packaging line", status: "Locked" },
      { label: "Allocate 200 boxes for VIP overnight ship", status: "In progress" },
      { label: "Set up live chat macros", status: "Upcoming" },
    ],
  },
];

const statusBadge = (text: string) => (
  <span className="inline-flex items-center gap-1 rounded-[999px] bg-[var(--surface-hover)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
    <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground)]" />
    {text}
  </span>
);

export default function BuckeyeBrowniesLaunchMock() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 pb-16 pt-8 text-[var(--foreground)] md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-[var(--tertiary-foreground)]">
            <span>Mock Workspace</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span>Launch Playbook</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <ArrowLeft className="h-3 w-3" />
                  Back to projects
                </Link>
                <span className="text-[var(--border-strong)]">•</span>
                <span>Buckeye Brownies</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">December Brownie Launch</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {statusBadge("In production")}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Launch window: Dec 12–15
                </span>
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3.5 w-3.5" />
                  Goal: 5,000 units sold
                </span>
              </div>
            </div>

            <div className="hidden gap-2 md:flex">
              <Button variant="outline" size="sm">Preview customer journey</Button>
              <Button size="sm">Share launch hub</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr,1fr]">
          <Card className="border-[var(--border)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Launch Snapshot</CardTitle>
              <CardDescription className="text-xs text-[var(--muted-foreground)]">
                What Buckeye Brownies needs ready before the holiday drop goes live.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Target sell-through</p>
                <p className="mt-1 text-xl font-semibold">92% in 72 hrs</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">Stretch goal: fully sold out before Christmas shipping cut-off.</p>
              </div>
              <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Key audiences</p>
                <p className="mt-1 text-sm font-medium">VIP email list, TikTok holiday shoppers, Columbus locals</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">VIP early access unlocks 24 hrs before general sale.</p>
              </div>
              <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Critical risks</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                  <li>• Peppermint drizzle supplier shipping delay.</li>
                  <li>• Overnight shipping slots fill by Dec 11.</li>
                  <li>• Influencer kits must arrive before the 8th.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--border)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Launch Day Checklist</CardTitle>
              <CardDescription className="text-xs text-[var(--muted-foreground)]">
                Snapshot owned by Logan (Growth Lead).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "SMS ready to send at 10:00am EST",
                "IG Reel scheduled + pinned",
                "Inventory buffer confirmed with Ops",
                "Giveaway winners queue prepared",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                  <p className="text-xs text-[var(--foreground)]">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr,1fr]">
          <Card className="border-[var(--border)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Production Run</CardTitle>
              <CardDescription className="text-xs text-[var(--muted-foreground)]">Coordinated with the Columbus kitchen.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sku</TableHead>
                    <TableHead>Batch Size</TableHead>
                    <TableHead>Ship Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionRun.map((row) => (
                    <TableRow key={row.sku}>
                      <TableCell className="font-medium text-[var(--foreground)]">{row.sku}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>{row.ship}</TableCell>
                      <TableCell>
                        <span className="rounded-[999px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                          {row.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[var(--border)]">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Content Calendar</CardTitle>
              <CardDescription className="text-xs text-[var(--muted-foreground)]">Owned by the Creative Pod.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {contentCalendar.map((row) => (
                <div key={row.concept} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span className="font-medium text-[var(--foreground)]">{row.channel}</span>
                    <span>{row.publish}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--foreground)]">{row.concept}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--tertiary-foreground)]">
                    <span>Owner: {row.owner}</span>
                    <span>{row.status}</span>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full">Open content board</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[var(--border)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Launch Timeline</CardTitle>
            <CardDescription className="text-xs text-[var(--muted-foreground)]">Shared with fulfillment, growth, and customer experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {launchTimeline.map((item) => (
              <div key={item.milestone} className="flex items-start gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--surface-hover)] text-xs font-semibold text-[var(--foreground)]">
                  {item.date.split(" ")[1] || item.date}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">{item.milestone}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--surface-hover)] px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> Owner: {item.owner}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] px-2 py-0.5">
                      Status: {item.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {taskBuckets.map((bucket) => (
            <Card key={bucket.title} className="border-[var(--border)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-[var(--foreground)]">{bucket.title}</CardTitle>
                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--muted-foreground)]">
                  {bucket.icon}
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                {bucket.items.map((item) => (
                  <div key={item.label} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-sm text-[var(--foreground)]">{item.label}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">{item.status}</p>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  + Add task
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-[var(--border)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Social Launch Kit</CardTitle>
            <CardDescription className="text-xs text-[var(--muted-foreground)]">Assets prepared for partners & loyal customers to repost.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Influencer dropbox",
                body: "Zip file with product shots, story frames, and SKU breakdowns.",
                cta: "Open folder",
              },
              {
                title: "Creator talking points",
                body: "Key flavor notes, allergy info, and launch mechanics for live streams.",
                cta: "View doc",
              },
              {
                title: "Holiday soundtrack",
                body: "Licensed audio bed used across reels + TikTok countdown series.",
                cta: "Play playlist",
              },
            ].map((asset) => (
              <div key={asset.title} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-sm font-medium text-[var(--foreground)]">{asset.title}</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">{asset.body}</p>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  {asset.cta}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[var(--border)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Launch Metrics</CardTitle>
            <CardDescription className="text-xs text-[var(--muted-foreground)]">Real-time dashboard for the first 72 hours after go-live.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Site sessions", "Conversion rate", "Average order value", "Repeat purchase window"].map((metric) => (
              <div key={metric} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">{metric}</p>
                <p className="mt-1 text-xl font-semibold">{metric === "Site sessions" ? "18,240" : metric === "Conversion rate" ? "4.6%" : metric === "Average order value" ? "$42.10" : "16 days"}</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">Auto-refreshes every 15 minutes when analytics is connected.</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)] md:flex-row md:items-center md:justify-between">
          <span>Built with Trak building blocks</span>
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Instagram className="h-3 w-3" /> Buckeye Brownies
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> Holiday Batch 2025
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
